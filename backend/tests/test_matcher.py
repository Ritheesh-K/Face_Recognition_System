import pytest
import numpy as np
from app.ml.matcher import FaceMatcher


def test_vector_normalization():
    matcher = FaceMatcher()
    random_vec = np.random.uniform(-1, 1, size=512).astype(np.float32)
    norm_vec = matcher.normalize(random_vec)
    norm = np.linalg.norm(norm_vec)
    assert np.isclose(norm, 1.0, atol=1e-5), f"Vector norm should be 1.0, got {norm}"


def test_cosine_similarity_identical_vectors():
    matcher = FaceMatcher()
    v = matcher.normalize(np.random.randn(512).astype(np.float32))
    sim = matcher.compute_cosine_similarity(v, v)
    assert np.isclose(sim, 1.0, atol=1e-5), f"Cosine similarity of identical vectors must be 1.0, got {sim}"


def test_cosine_similarity_orthogonal_vectors():
    matcher = FaceMatcher()
    v1 = np.zeros(512, dtype=np.float32)
    v1[0] = 1.0
    v2 = np.zeros(512, dtype=np.float32)
    v2[1] = 1.0
    sim = matcher.compute_cosine_similarity(v1, v2)
    assert np.isclose(sim, 0.0, atol=1e-5), f"Cosine similarity of orthogonal vectors must be 0.0, got {sim}"


def test_strict_unknown_rejection():
    """
    CRITICAL REQUIREMENT:
    If maximum similarity is below threshold, system must NEVER assign an identity.
    It must return status='UNKNOWN', person_id=None, is_unknown=True.
    """
    matcher = FaceMatcher(default_threshold=0.50)

    # Known enrolled person "Alice"
    alice_emb = matcher.normalize(np.random.randn(512).astype(np.float32))
    gallery = [
        {"person_id": 1, "name": "Alice", "department": "AI", "embedding": alice_emb}
    ]

    # Query vector that is clearly different (impostor / unknown)
    orthogonal_emb = np.zeros(512, dtype=np.float32)
    orthogonal_emb[100] = 1.0

    result = matcher.match(orthogonal_emb, gallery, threshold=0.50)

    assert result["status"] == "UNKNOWN"
    assert result["is_unknown"] is True
    assert result["person_id"] is None
    assert result["name"] == "UNKNOWN"
    assert result["similarity_score"] < 0.50
    assert result["margin"] > 0  # threshold - score > 0


def test_multi_image_enrollment_highest_similarity():
    """
    Support multiple enrollment images per person.
    The match score should select the maximum similarity across all enrolled samples.
    """
    matcher = FaceMatcher(default_threshold=0.50)

    base = np.random.randn(512).astype(np.float32)
    v_front = matcher.normalize(base)
    # Add slight perturbation for angled photo of the same person
    v_angled = matcher.normalize(base + np.random.normal(0, 0.1, 512).astype(np.float32))

    # Another person
    bob_emb = matcher.normalize(np.random.randn(512).astype(np.float32))

    gallery = [
        {"person_id": 1, "name": "Alice", "department": "Engineering", "embedding": v_front},
        {"person_id": 1, "name": "Alice", "department": "Engineering", "embedding": v_angled},
        {"person_id": 2, "name": "Bob", "department": "Design", "embedding": bob_emb},
    ]

    # Query is identical to Alice's angled photo
    result = matcher.match(v_angled, gallery, threshold=0.50)

    assert result["status"] == "KNOWN"
    assert result["is_unknown"] is False
    assert result["person_id"] == 1
    assert result["name"] == "Alice"
    assert np.isclose(result["similarity_score"], 1.0, atol=1e-4)
