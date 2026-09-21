import logging
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from app.core.config import settings

logger = logging.getLogger("face_recognition.matcher")


class FaceMatcher:
    """
    Cosine Similarity Matcher & Unknown-Person Rejection Engine.

    Important Biometric Standards:
    - Cosine similarity is a bounded distance metric in [-1.0, 1.0], NOT a calibrated probability.
    - We strictly use the term 'similarity score' and avoid interpreting 0.82 as '82% confidence'.
    - An initial default threshold of 0.50 is used, marked as requiring calibration on validation data.
    """

    def __init__(self, default_threshold: float = settings.DEFAULT_MATCHING_THRESHOLD):
        self.default_threshold = default_threshold

    @staticmethod
    def normalize(embedding: np.ndarray) -> np.ndarray:
        """L2-normalizes an embedding vector or batch of vectors."""
        vec = np.asarray(embedding, dtype=np.float32)
        if vec.ndim == 1:
            norm = np.linalg.norm(vec)
            if norm > 1e-9:
                return vec / norm
            return vec
        else:
            norm = np.linalg.norm(vec, axis=1, keepdims=True)
            norm = np.where(norm < 1e-9, 1e-9, norm)
            return vec / norm

    @classmethod
    def compute_cosine_similarity(cls, a: np.ndarray, b: np.ndarray) -> float:
        """Alias for cosine_similarity."""
        return cls.cosine_similarity(a, b)

    @staticmethod
    def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
        """
        ML Step: Cosine Similarity Calculation.
        For two L2-normalized 512D vectors a and b:
            cos(a, b) = (a • b) / (||a||_2 * ||b||_2) = a • b
        Returns a float similarity score bounded in [-1.0, 1.0].
        """
        vec_a = np.asarray(a, dtype=np.float32).flatten()
        vec_b = np.asarray(b, dtype=np.float32).flatten()

        # Ensure unit norm
        norm_a = np.linalg.norm(vec_a)
        norm_b = np.linalg.norm(vec_b)

        if norm_a > 1e-9:
            vec_a = vec_a / norm_a
        if norm_b > 1e-9:
            vec_b = vec_b / norm_b

        return float(np.dot(vec_a, vec_b))

    def find_best_match(
        self,
        query_embedding: np.ndarray,
        enrolled_embeddings: List[Dict[str, Any]],
        threshold: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        ML Step: 1:N Open-Set Face Identification.
        1. Compares query embedding against all enrolled embeddings or templates.
        2. Calculates cosine similarity score for each enrolled sample.
        3. Supports multiple enrollment images per person by taking maximum similarity per person.
        4. Selects highest similarity score across the entire gallery.
        5. Compares highest similarity against threshold.
        6. Unknown-Person Rejection: If highest similarity < threshold, strictly returns status='UNKNOWN'
           and person_id=None. NEVER automatically assigns an identity below the threshold.

        Args:
            query_embedding: 512D normalized numpy array.
            enrolled_embeddings: List of dicts, each with:
                - 'person_id': int
                - 'person_name': str
                - 'embedding': np.ndarray (512,)
                - 'department': Optional[str]
            threshold: Operating threshold (if None, default is used).

        Returns:
            Dict containing:
                - person_id: Optional[int]
                - person_name: str
                - similarity: float (similarity score, e.g. 0.82)
                - threshold: float
                - matched: bool (True if similarity >= threshold, False otherwise)
                - status: str ('KNOWN' or 'UNKNOWN')
                - margin: float (threshold - similarity)
                - candidate_ranking: List of top candidates with their similarity scores
        """
        operating_threshold = threshold if threshold is not None else self.default_threshold
        query_vec = np.asarray(query_embedding, dtype=np.float32).flatten()
        norm_q = np.linalg.norm(query_vec)
        if norm_q > 1e-9:
            query_vec = query_vec / norm_q

        # Case: Empty gallery / database
        if not enrolled_embeddings:
            logger.info("Gallery is empty. Returning UNKNOWN.")
            return {
                "person_id": None,
                "person_name": "UNKNOWN",
                "similarity": 0.0,
                "threshold": operating_threshold,
                "matched": False,
                "status": "UNKNOWN",
                "margin": round(operating_threshold, 4),
                "candidate_ranking": []
            }

        # Vectorized batch cosine similarity
        gallery_matrix = np.stack([item["embedding"] for item in enrolled_embeddings], axis=0)
        # Ensure gallery rows are normalized
        row_norms = np.linalg.norm(gallery_matrix, axis=1, keepdims=True)
        row_norms = np.where(row_norms < 1e-9, 1e-9, row_norms)
        gallery_matrix = gallery_matrix / row_norms

        # Matrix multiplication computes all cosine similarity scores simultaneously
        similarity_scores = np.matmul(gallery_matrix, query_vec)

        # Multi-image enrollment aggregation:
        # Group similarity scores by person_id and select the maximum score per person
        person_scores: Dict[int, Dict[str, Any]] = {}
        for idx, item in enumerate(enrolled_embeddings):
            pid = item["person_id"]
            name = item.get("person_name") or item.get("name", "Unknown")
            sim = float(similarity_scores[idx])

            if pid not in person_scores or sim > person_scores[pid]["similarity"]:
                person_scores[pid] = {
                    "person_id": pid,
                    "person_name": name,
                    "name": name,
                    "person_code": item.get("code"),
                    "code": item.get("code"),
                    "department": item.get("department"),
                    "similarity": sim,
                    "score": sim
                }

        # Rank candidates descending by similarity score
        ranked_candidates = sorted(person_scores.values(), key=lambda c: c["similarity"], reverse=True)
        top_candidate = ranked_candidates[0]
        top_similarity = top_candidate["similarity"]

        # Margin: positive if rejected (below threshold), negative if accepted
        margin = float(operating_threshold - top_similarity)

        # Unknown-person rejection mechanism:
        # Never assign identity when similarity is below the operating threshold
        if top_similarity >= operating_threshold:
            logger.info(
                "Identity match: '%s' (ID: %d) with similarity score %.4f >= threshold %.4f",
                top_candidate["person_name"], top_candidate["person_id"], top_similarity, operating_threshold
            )
            return {
                "person_id": top_candidate["person_id"],
                "person_code": top_candidate.get("person_code"),
                "code": top_candidate.get("code"),
                "person_name": top_candidate["person_name"],
                "name": top_candidate["person_name"],
                "department": top_candidate.get("department"),
                "similarity": round(top_similarity, 4),
                "similarity_score": round(top_similarity, 4),
                "threshold": operating_threshold,
                "threshold_used": operating_threshold,
                "matched": True,
                "is_unknown": False,
                "status": "KNOWN",
                "margin": round(margin, 4),
                "candidate_ranking": [
                    {
                        "person_id": c["person_id"],
                        "person_code": c.get("person_code"),
                        "person_name": c["person_name"],
                        "name": c["person_name"],
                        "similarity": round(c["similarity"], 4)
                    }
                    for c in ranked_candidates[:5]
                ]
            }
        else:
            logger.info(
                "Unknown person rejected: highest similarity score %.4f is below threshold %.4f",
                top_similarity, operating_threshold
            )
            return {
                "person_id": None,
                "person_name": "UNKNOWN",
                "name": "UNKNOWN",
                "department": None,
                "similarity": round(top_similarity, 4),
                "similarity_score": round(top_similarity, 4),
                "threshold": operating_threshold,
                "threshold_used": operating_threshold,
                "matched": False,
                "is_unknown": True,
                "status": "UNKNOWN",
                "margin": round(margin, 4),
                "candidate_ranking": [
                    {
                        "person_id": c["person_id"],
                        "person_name": c["person_name"],
                        "name": c["person_name"],
                        "similarity": round(c["similarity"], 4)
                    }
                    for c in ranked_candidates[:5]
                ]
            }

    # Alias for find_best_match
    match = find_best_match


# Singleton instance
face_matcher = FaceMatcher()
