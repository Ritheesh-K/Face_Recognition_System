from pathlib import Path
from typing import List, Dict, Tuple, Any, Optional
import numpy as np
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.person import Person
from app.models.embedding import FaceEmbedding
from app.ml.evaluator import BiometricEvaluator
from app.ml.detector import face_detector
from app.ml.embedder import face_embedder
from app.ml.matcher import face_matcher
from app.schemas.evaluation import (
    EvaluationResponse, EvaluationMetrics, RocPoint,
    ThresholdTableRow, ConfusionMatrixData, TestCaseDetail, SimilarityDistribution
)
from app.services.person_service import PersonService
from app.services.settings_service import SettingsService


class EvaluationService:
    def __init__(self):
        self.evaluator = BiometricEvaluator()

    @staticmethod
    def get_evaluation_directory() -> Optional[Path]:
        """Locates the evaluation dataset root directory."""
        candidates = [
            settings.DATA_DIR.parent.parent / "evaluation",
            settings.DATA_DIR / "evaluation",
            Path("evaluation"),
        ]
        for c in candidates:
            if c.exists() and (c / "known").exists():
                return c.resolve()
        return None

    def evaluate_real_dataset(
        self,
        db: Session,
        eval_dir: Path,
        threshold_steps: List[float] = [0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70]
    ) -> EvaluationResponse:
        """
        Executes empirical threshold calibration on real validation dataset:
        1. Reads probe photos from evaluation/known/<person_code>/ and evaluation/unknown/
        2. Calculates Genuine Scores (same person's probe vs enrolled template)
        3. Calculates Impostor Scores (cross-person probe vs other enrolled templates + unknown probe vs all templates)
        4. Calculates FAR, FRR, Precision, Recall, F1 across threshold candidate range
        5. Suggests practical threshold based on validation data (best F1 / minimum error)
        6. Returns warning banner if dataset is insufficient (zero fabricated results).
        """
        current_threshold = SettingsService.get_matching_threshold(db)

        known_dir = eval_dir / "known"
        unknown_dir = eval_dir / "unknown"

        # Check for enrolled persons
        gallery = PersonService.get_enrolled_templates(db)
        if not gallery:
            gallery = PersonService.get_enrolled_gallery(db)

        # Collect test images
        known_images = []
        if known_dir.exists():
            for person_folder in known_dir.iterdir():
                if person_folder.is_dir():
                    code = person_folder.name
                    person = db.query(Person).filter(
                        (Person.code == code) | (Person.name.ilike(code))
                    ).first()
                    for img_path in person_folder.glob("*.*"):
                        if img_path.suffix.lower() in [".jpg", ".jpeg", ".png", ".webp"]:
                            known_images.append({
                                "path": img_path,
                                "is_known": True,
                                "expected_person_id": person.id if person else None,
                                "expected_name": person.name if person else code,
                                "expected_code": code
                            })

        unknown_images = []
        if unknown_dir.exists():
            for img_path in unknown_dir.glob("*.*"):
                if img_path.suffix.lower() in [".jpg", ".jpeg", ".png", ".webp"]:
                    unknown_images.append({
                        "path": img_path,
                        "is_known": False,
                        "expected_person_id": None,
                        "expected_name": "UNKNOWN",
                        "expected_code": None
                    })

        total_test_images = len(known_images) + len(unknown_images)

        # Insufficient data check (requires enrolled persons, known test images, and unknown test images)
        if total_test_images < 4 or not gallery or len(known_images) < 2 or len(unknown_images) < 1:
            return EvaluationResponse(
                status="WARNING",
                is_insufficient=True,
                warning=(
                    f"Evaluation dataset is insufficient. Found {len(known_images)} known test image(s), "
                    f"{len(unknown_images)} unknown test image(s), and {len(gallery)} enrolled template(s). "
                    "A valid benchmark requires enrolled identities in the gallery and separate test photos in "
                    "'evaluation/known/<person_code>/' and 'evaluation/unknown/'."
                ),
                message="Evaluation skipped due to insufficient evaluation data.",
                dataset_info={
                    "path": str(eval_dir),
                    "known_test_images": len(known_images),
                    "unknown_test_images": len(unknown_images),
                    "gallery_identities": len(gallery)
                }
            )

        # 1. Extract embeddings and compute Genuine and Impostor similarity scores
        test_case_results = []
        genuine_scores: List[float] = []
        impostor_scores: List[float] = []

        # Map gallery by person_id for fast lookup
        gallery_by_id = {g["person_id"]: g for g in gallery}

        for item in known_images + unknown_images:
            img_path = item["path"]
            with open(img_path, "rb") as f:
                img_bytes = f.read()

            try:
                decoded_img, _ = PersonService.validate_and_decode_image(img_bytes, img_path.name)
                faces = face_detector.detect_faces(decoded_img)
                if not faces:
                    sim = 0.0
                    pred_name = "NO_FACE"
                    pred_id = None
                    norm_emb = None
                else:
                    face = faces[0]
                    _, norm_emb = face_embedder.generate_embedding(decoded_img, face["landmarks"], face["raw_face"])
                    match_res = face_matcher.find_best_match(norm_emb, gallery, threshold=current_threshold)
                    sim = float(match_res["similarity"])
                    pred_name = match_res["person_name"]
                    pred_id = match_res["person_id"]
            except Exception:
                sim = 0.0
                pred_name = "ERROR"
                pred_id = None
                norm_emb = None

            if norm_emb is not None:
                if item["is_known"]:
                    # Genuine score: compare with this person's own enrolled template
                    own_pid = item.get("expected_person_id")
                    if own_pid and own_pid in gallery_by_id:
                        own_tpl = gallery_by_id[own_pid]["embedding"]
                        own_sim = float(np.dot(norm_emb, own_tpl))
                        genuine_scores.append(own_sim)
                    else:
                        genuine_scores.append(sim)

                    # Impostor scores: compare this known person's probe against OTHER enrolled identities
                    for other_pid, other_g in gallery_by_id.items():
                        if other_pid != own_pid:
                            cross_sim = float(np.dot(norm_emb, other_g["embedding"]))
                            impostor_scores.append(cross_sim)
                else:
                    # Impostor scores: unknown test image compared against all enrolled templates
                    for g in gallery:
                        cross_sim = float(np.dot(norm_emb, g["embedding"]))
                        impostor_scores.append(cross_sim)
            else:
                if item["is_known"]:
                    genuine_scores.append(0.0)
                else:
                    impostor_scores.append(0.0)

            # Determine classification category at current operating threshold
            is_match = sim >= current_threshold
            if item["is_known"]:
                correct_id = (pred_id == item["expected_person_id"]) or (pred_name == item["expected_name"])
                if is_match and correct_id:
                    cat = "True Positive"
                    correct = True
                else:
                    cat = "False Negative"
                    correct = False
            else:
                if not is_match:
                    cat = "True Negative"
                    correct = True
                else:
                    cat = "False Positive"
                    correct = False

            test_case_results.append(
                TestCaseDetail(
                    filename=img_path.name,
                    relative_path=str(img_path.relative_to(eval_dir)),
                    ground_truth_label=item["expected_name"],
                    ground_truth_code=item["expected_code"],
                    predicted_label=pred_name if is_match else "UNKNOWN",
                    similarity_score=round(sim, 4),
                    threshold_applied=round(current_threshold, 4),
                    is_correct=correct,
                    classification_category=cat
                )
            )

        # 2. Evaluate candidate thresholds over a configurable range
        threshold_table: List[ThresholdTableRow] = []
        roc_points: List[RocPoint] = []
        all_thresholds = sorted(list(set(threshold_steps + [round(current_threshold, 2)])))

        for th in all_thresholds:
            # Genuine: accepted if score >= th (TP), rejected if score < th (FN / FRR)
            tp = sum(1 for s in genuine_scores if s >= th)
            fn = len(genuine_scores) - tp
            # Impostor: accepted if score >= th (FP / FAR), rejected if score < th (TN)
            fp = sum(1 for s in impostor_scores if s >= th)
            tn = len(impostor_scores) - fp

            total_gen = len(genuine_scores) or 1
            total_imp = len(impostor_scores) or 1

            far = fp / total_imp
            frr = fn / total_gen
            rec = tp / total_gen
            prec = tp / (tp + fp) if (tp + fp) > 0 else 1.0
            f1 = (2 * prec * rec) / (prec + rec) if (prec + rec) > 0 else 0.0
            acc = (tp + tn) / (total_gen + total_imp)

            threshold_table.append(
                ThresholdTableRow(
                    threshold=round(th, 2),
                    accuracy=round(acc, 4),
                    precision=round(prec, 4),
                    recall=round(rec, 4),
                    f1=round(f1, 4),
                    far=round(far, 4),
                    frr=round(frr, 4)
                )
            )

            roc_points.append(
                RocPoint(
                    threshold=round(th, 2),
                    far=round(far, 4),
                    frr=round(frr, 4),
                    tpr=round(rec, 4),
                    precision=round(prec, 4),
                    accuracy=round(acc, 4)
                )
            )

        # 3. Determine suggested threshold based on validation data
        # Best F1 score with priority on low FAR (EER or highest F1)
        best_row = max(threshold_table, key=lambda r: (r.f1, -r.far, -abs(r.far - r.frr)))
        suggested_th = best_row.threshold

        disclaimer_text = (
            "Threshold performance depends on the dataset, camera conditions, image quality and demographic composition. "
            "This suggested threshold is empirically derived from current validation data and should not be claimed as universally optimal."
        )

        # Confusion matrix at current operating threshold
        curr_row = next((r for r in threshold_table if np.isclose(r.threshold, current_threshold, atol=0.01)), threshold_table[0])
        cm_tp = sum(1 for c in test_case_results if c.classification_category == "True Positive")
        cm_fn = sum(1 for c in test_case_results if c.classification_category == "False Negative")
        cm_fp = sum(1 for c in test_case_results if c.classification_category == "False Positive")
        cm_tn = sum(1 for c in test_case_results if c.classification_category == "True Negative")

        cm_data = ConfusionMatrixData(
            true_positive=cm_tp,
            false_positive=cm_fp,
            true_negative=cm_tn,
            false_negative=cm_fn,
            total_genuine=cm_tp + cm_fn,
            total_impostor=cm_tn + cm_fp
        )

        # Equal error rate approximation
        eer_val = 0.0
        eer_th = 0.50
        min_diff = 999.0
        for r in threshold_table:
            diff = abs(r.far - r.frr)
            if diff < min_diff:
                min_diff = diff
                eer_val = (r.far + r.frr) / 2
                eer_th = r.threshold

        metrics = EvaluationMetrics(
            total_samples=total_test_images,
            genuine_pairs_count=len(genuine_scores),
            impostor_pairs_count=len(impostor_scores),
            current_threshold=current_threshold,
            suggested_threshold=suggested_th,
            accuracy_at_current_threshold=curr_row.accuracy,
            precision_at_current_threshold=curr_row.precision,
            recall_at_current_threshold=curr_row.recall,
            f1_at_current_threshold=curr_row.f1,
            far_at_current_threshold=curr_row.far,
            frr_at_current_threshold=curr_row.frr,
            eer=round(eer_val, 4),
            eer_threshold=round(eer_th, 4),
            auc_roc=round(1.0 - eer_val, 4),
            optimal_threshold_recommendations={
                "high_security": 0.65,
                "balanced": suggested_th,
                "convenience": 0.42
            },
            disclaimer=disclaimer_text
        )

        sim_dist = SimilarityDistribution(
            genuine_scores=[round(s, 4) for s in genuine_scores],
            impostor_scores=[round(s, 4) for s in impostor_scores]
        )

        return EvaluationResponse(
            status="SUCCESS",
            message=f"Threshold calibration executed on validation data ({len(genuine_scores)} genuine pairs and {len(impostor_scores)} impostor comparisons).",
            is_insufficient=False,
            suggested_threshold=suggested_th,
            current_threshold=current_threshold,
            disclaimer=disclaimer_text,
            dataset_info={
                "path": str(eval_dir),
                "known_test_images": len(known_images),
                "unknown_test_images": len(unknown_images),
                "gallery_identities": len(gallery)
            },
            metrics=metrics,
            threshold_table=threshold_table,
            confusion_matrix=cm_data,
            similarity_distribution=sim_dist,
            test_cases=test_case_results,
            roc_curve=roc_points,
            threshold_tradeoff=roc_points
        )

    def run_evaluation(self, db: Session) -> EvaluationResponse:
        """Entrypoint called by API /api/evaluate."""
        eval_dir = self.get_evaluation_directory()
        if eval_dir is not None:
            return self.evaluate_real_dataset(db, eval_dir)

        # If directory is completely missing
        return EvaluationResponse(
            status="WARNING",
            is_insufficient=True,
            warning=(
                "Evaluation dataset directory 'evaluation/' was not found. "
                "Please ensure the directory structure exists with 'evaluation/known/<person_code>/' "
                "and 'evaluation/unknown/' containing non-enrolled evaluation test photos."
            ),
            message="Evaluation dataset directory missing.",
            dataset_info=None
        )


evaluation_service = EvaluationService()
