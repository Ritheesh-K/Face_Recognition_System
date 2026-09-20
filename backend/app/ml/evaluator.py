from typing import List, Dict, Tuple, Any
import numpy as np


class BiometricEvaluator:
    """
    Evaluator for 1:1 and 1:N face identification systems.
    Computes FAR (False Acceptance Rate), FRR (False Rejection Rate),
    TPR (Recall), ROC curves, AUC, and EER (Equal Error Rate).
    """

    @staticmethod
    def evaluate_threshold(
        genuine_scores: np.ndarray,
        impostor_scores: np.ndarray,
        threshold: float
    ) -> Dict[str, float]:
        """
        Computes biometric verification metrics at a specific threshold.
        
        Args:
            genuine_scores: Cosine similarities between photos of the same person.
            impostor_scores: Cosine similarities between photos of different/unknown persons.
            threshold: Decision boundary.
        """
        genuine_scores = np.asarray(genuine_scores, dtype=np.float32)
        impostor_scores = np.asarray(impostor_scores, dtype=np.float32)

        total_genuine = len(genuine_scores)
        total_impostor = len(impostor_scores)

        if total_genuine == 0 or total_impostor == 0:
            return {
                "threshold": threshold,
                "tpr": 0.0,
                "far": 0.0,
                "frr": 0.0,
                "precision": 0.0,
                "accuracy": 0.0
            }

        # True Positives: genuine scores >= threshold
        tp = np.sum(genuine_scores >= threshold)
        # False Negatives: genuine scores < threshold (wrongly rejected)
        fn = np.sum(genuine_scores < threshold)
        # False Positives: impostor scores >= threshold (wrongly accepted)
        fp = np.sum(impostor_scores >= threshold)
        # True Negatives: impostor scores < threshold (correctly rejected as UNKNOWN)
        tn = np.sum(impostor_scores < threshold)

        tpr = float(tp / total_genuine)
        frr = float(fn / total_genuine)
        far = float(fp / total_impostor)

        precision = float(tp / (tp + fp)) if (tp + fp) > 0 else 1.0
        accuracy = float((tp + tn) / (total_genuine + total_impostor))

        return {
            "threshold": round(threshold, 4),
            "tpr": round(tpr, 4),
            "frr": round(frr, 4),
            "far": round(far, 4),
            "precision": round(precision, 4),
            "accuracy": round(accuracy, 4)
        }

    def compute_roc_curve(
        self,
        genuine_scores: np.ndarray,
        impostor_scores: np.ndarray,
        num_points: int = 50
    ) -> List[Dict[str, float]]:
        """
        Sweeps threshold from 0.05 to 0.95 to generate ROC and trade-off curve points.
        """
        thresholds = np.linspace(0.05, 0.95, num_points)
        curve = []
        for th in thresholds:
            metrics = self.evaluate_threshold(genuine_scores, impostor_scores, float(th))
            curve.append(metrics)
        return curve

    def calculate_eer(self, roc_points: List[Dict[str, float]]) -> Tuple[float, float]:
        """
        Finds the Equal Error Rate (EER) and the corresponding threshold
        where |FAR - FRR| is minimized.
        """
        if not roc_points:
            return 0.0, 0.50

        best_diff = float("inf")
        eer_val = 0.0
        eer_th = 0.50

        for pt in roc_points:
            diff = abs(pt["far"] - pt["frr"])
            if diff < best_diff:
                best_diff = diff
                eer_val = (pt["far"] + pt["frr"]) / 2.0
                eer_th = pt["threshold"]

        return round(float(eer_val), 4), round(float(eer_th), 4)

    def calculate_auc(self, roc_points: List[Dict[str, float]]) -> float:
        """
        Calculates Area Under the ROC Curve (AUC) using trapezoidal rule.
        """
        # Sort by FAR ascending
        sorted_points = sorted(roc_points, key=lambda p: p["far"])
        far_vals = [p["far"] for p in sorted_points]
        tpr_vals = [p["tpr"] for p in sorted_points]

        if len(far_vals) < 2:
            return 1.0

        auc = float(np.trapz(tpr_vals, far_vals))
        # Ensure AUC is bounded in [0.0, 1.0]
        return round(float(np.clip(auc, 0.0, 1.0)), 4)

    def generate_recommendations(
        self,
        roc_points: List[Dict[str, float]],
        eer_threshold: float
    ) -> Dict[str, float]:
        """
        Recommends operational thresholds based on risk profiles:
        - High Security: Strict threshold with lowest FAR (< 0.01)
        - Balanced: Equal Error Rate threshold
        - Convenience / High Recall: Low FRR (< 0.05)
        """
        high_sec_th = 0.65
        for pt in roc_points:
            if pt["far"] <= 0.01:
                high_sec_th = pt["threshold"]
                break

        convenience_th = 0.38
        for pt in reversed(roc_points):
            if pt["frr"] <= 0.05:
                convenience_th = pt["threshold"]
                break

        return {
            "high_security": round(high_sec_th, 2),
            "balanced": round(eer_threshold, 2),
            "convenience": round(convenience_th, 2)
        }
