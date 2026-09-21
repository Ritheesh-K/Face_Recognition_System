import json
import logging
import time
import uuid
from typing import Optional, List
import cv2
import numpy as np
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.recognition_log import RecognitionLog
from app.schemas.recognition import (
    RecognitionResponse, RecognitionMatch, BoundingBox, MatchedPersonSummary
)
from app.ml.detector import face_detector
from app.ml.embedder import face_embedder
from app.ml.matcher import face_matcher
from app.services.person_service import PersonService
from app.services.settings_service import SettingsService

logger = logging.getLogger("face_recognition.recognition_service")


class RecognitionService:
    @staticmethod
    def identify_faces(
        db: Session,
        image_bytes: bytes,
        threshold_override: Optional[float] = None
    ) -> RecognitionResponse:
        """
        Recognition Pipeline:
        1. Decodes query image.
        2. Detects faces using SCRFD detector.
        3. If no faces detected, returns UNKNOWN with person=null.
        4. For each face, aligns 5 landmarks and extracts normalized 512D ArcFace embedding.
        5. Compares against all enrolled person templates using cosine similarity.
        6. Finds maximum similarity score and retrieves corresponding identity.
        7. Compares maximum similarity with configured threshold:
           - if max_similarity >= threshold: KNOWN
           - else: UNKNOWN
        8. Does NOT always return the nearest person if below threshold.
        """
        start_time = time.time()

        # Determine operating threshold
        if threshold_override is not None:
            effective_threshold = float(threshold_override)
        else:
            effective_threshold = SettingsService.get_matching_threshold(db)

        # Decode image
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            logger.error("Failed to decode image bytes into valid image.")
            return RecognitionResponse(
                status="UNKNOWN",
                person=None,
                similarity=0.0,
                threshold=round(effective_threshold, 4),
                total_faces_detected=0,
                threshold_applied=round(effective_threshold, 4),
                latency_ms=0.0,
                results=[],
                message="The uploaded image file is corrupted or could not be processed."
            )

        # Detect faces
        detected_faces = face_detector.detect_faces(img)

        # Handle zero faces detected
        if not detected_faces:
            latency = (time.time() - start_time) * 1000
            logger.info("Recognition attempt: 0 faces detected (latency: %.2f ms).", latency)

            # Audit log
            log_entry = RecognitionLog(
                matched_person_id=None,
                matched_name="NONE",
                similarity_score=0.0,
                threshold_used=effective_threshold,
                status="NO_FACE",
                detected_face_count=0,
                query_image_path=None,
                bounding_box_json=None,
                latency_ms=round(latency, 2)
            )
            db.add(log_entry)
            db.commit()

            return RecognitionResponse(
                status="UNKNOWN",
                person=None,
                similarity=0.0,
                threshold=round(effective_threshold, 4),
                total_faces_detected=0,
                threshold_applied=round(effective_threshold, 4),
                latency_ms=round(latency, 2),
                results=[],
                message="No face detected. Please upload a clearer image."
            )

        # Load enrolled templates from SQLite (compare query embedding against all enrolled person templates)
        templates = PersonService.get_enrolled_templates(db)
        if not templates:
            # Fallback to individual embeddings if templates not precalculated
            templates = PersonService.get_enrolled_gallery(db)

        if not templates:
            latency = (time.time() - start_time) * 1000
            return RecognitionResponse(
                status="UNKNOWN",
                person=None,
                similarity=0.0,
                threshold=round(effective_threshold, 4),
                total_faces_detected=len(detected_faces),
                threshold_applied=round(effective_threshold, 4),
                latency_ms=round(latency, 2),
                results=[],
                message="Recognition database is empty. Please enroll a person first."
            )

        logger.info("Matching %d detected face(s) against %d enrolled template(s)...", len(detected_faces), len(templates))

        matches: List[RecognitionMatch] = []

        for face in detected_faces:
            bbox_coords = face["bbox"]
            confidence = face["det_score"]

            # Generate aligned thumbnail and 512D ArcFace embedding
            aligned_face, norm_embedding = face_embedder.generate_embedding(
                image=img,
                landmarks=face["landmarks"],
                raw_face=face["raw_face"]
            )

            # Match against gallery with unknown rejection
            match_res = face_matcher.find_best_match(
                query_embedding=norm_embedding,
                enrolled_embeddings=templates,
                threshold=effective_threshold
            )

            # Save query crop for audit
            thumb_filename = f"query_{uuid.uuid4().hex[:12]}.jpg"
            thumb_path = settings.THUMBNAILS_DIR / thumb_filename
            cv2.imwrite(str(thumb_path), aligned_face)
            rel_query_path = f"thumbnails/{thumb_filename}"

            bbox_obj = BoundingBox(
                x1=bbox_coords[0],
                y1=bbox_coords[1],
                x2=bbox_coords[2],
                y2=bbox_coords[3],
                confidence=round(confidence, 3)
            )

            # Write recognition log
            log_entry = RecognitionLog(
                matched_person_id=match_res["person_id"],
                matched_name=match_res["person_name"],
                similarity_score=match_res["similarity"],
                threshold_used=effective_threshold,
                status=match_res["status"],
                detected_face_count=len(detected_faces),
                query_image_path=rel_query_path,
                bounding_box_json=json.dumps(bbox_coords),
                latency_ms=round((time.time() - start_time) * 1000, 2)
            )
            db.add(log_entry)

            matches.append(
                RecognitionMatch(
                    bbox=bbox_obj,
                    status=match_res["status"],
                    person_id=match_res["person_id"],
                    person_code=match_res.get("person_code"),
                    name=match_res["person_name"],
                    department=match_res.get("department"),
                    similarity_score=match_res["similarity"],
                    threshold_used=effective_threshold,
                    is_unknown=not match_res["matched"],
                    margin=match_res["margin"],
                    candidate_ranking=match_res.get("candidate_ranking")
                )
            )

        db.commit()
        total_latency = (time.time() - start_time) * 1000

        # Select best match across all detected faces
        best_match = max(matches, key=lambda m: m.similarity_score) if matches else None

        if best_match and best_match.status == "KNOWN" and not best_match.is_unknown:
            final_status = "KNOWN"
            matched_person = MatchedPersonSummary(
                id=best_match.person_id,
                name=best_match.name,
                code=best_match.person_code,
                department=best_match.department
            )
            final_similarity = round(best_match.similarity_score, 4)
            message = f"Identified as {best_match.name} with similarity {final_similarity:.2f} >= threshold {effective_threshold:.2f}."
        else:
            final_status = "UNKNOWN"
            matched_person = None
            final_similarity = round(best_match.similarity_score, 4) if best_match else 0.0
            message = "No enrolled person matched the configured threshold."

        logger.info(
            "Recognition completed in %.2f ms. Status: %s. Best similarity: %.4f (threshold: %.4f)",
            total_latency, final_status, final_similarity, effective_threshold
        )

        return RecognitionResponse(
            status=final_status,
            person=matched_person,
            similarity=final_similarity,
            threshold=round(effective_threshold, 4),
            total_faces_detected=len(detected_faces),
            threshold_applied=round(effective_threshold, 4),
            latency_ms=round(total_latency, 2),
            results=matches,
            message=message
        )

