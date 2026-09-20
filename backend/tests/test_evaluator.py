import pytest
import numpy as np
from app.ml.evaluator import BiometricEvaluator


def test_evaluator_metrics():
    evaluator = BiometricEvaluator()

    # Synthetic genuine scores (high similarity ~0.8) and impostor scores (low similarity ~0.2)
    genuine = np.array([0.75, 0.82, 0.88, 0.65, 0.90], dtype=np.float32)
    impostor = np.array([0.10, 0.22, 0.15, 0.35, 0.42], dtype=np.float32)

    metrics = evaluator.evaluate_threshold(genuine, impostor, threshold=0.50)

    # All 5 genuine >= 0.50 -> TPR = 1.0, FRR = 0.0
    assert metrics["tpr"] == 1.0
    assert metrics["frr"] == 0.0
    # All 5 impostors < 0.50 -> FAR = 0.0
    assert metrics["far"] == 0.0
    assert metrics["accuracy"] == 1.0


def test_evaluator_roc_and_eer():
    evaluator = BiometricEvaluator()

    np.random.seed(123)
    genuine = np.random.normal(0.75, 0.05, 100)
    impostor = np.random.normal(0.20, 0.05, 100)

    roc_curve = evaluator.compute_roc_curve(genuine, impostor, num_points=20)
    assert len(roc_curve) == 20

    eer_val, eer_th = evaluator.calculate_eer(roc_curve)
    assert 0.0 <= eer_val <= 1.0
    assert 0.10 <= eer_th <= 0.90

    auc = evaluator.calculate_auc(roc_curve)
    assert 0.5 <= auc <= 1.0
