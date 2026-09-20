from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class RocPoint(BaseModel):
    threshold: float
    far: float = Field(..., description="False Acceptance Rate (FPR)")
    frr: float = Field(..., description="False Rejection Rate (1 - TPR)")
    tpr: float = Field(..., description="True Positive Rate (Recall)")
    precision: float
    accuracy: float


class ThresholdTableRow(BaseModel):
    threshold: float
    accuracy: float
    precision: float
    recall: float
    f1: float
    far: float
    frr: float


class ConfusionMatrixData(BaseModel):
    true_positive: int = 0
    false_positive: int = 0
    true_negative: int = 0
    false_negative: int = 0
    total_genuine: int = 0
    total_impostor: int = 0


class TestCaseDetail(BaseModel):
    filename: str
    relative_path: str
    ground_truth_label: str
    ground_truth_code: Optional[str] = None
    predicted_label: str
    similarity_score: float
    threshold_applied: float
    is_correct: bool
    classification_category: str  # True Positive, True Negative, False Positive, False Negative


class SimilarityDistribution(BaseModel):
    genuine_scores: List[float] = []
    impostor_scores: List[float] = []


class EvaluationMetrics(BaseModel):
    total_samples: int
    genuine_pairs_count: int
    impostor_pairs_count: int
    current_threshold: float
    suggested_threshold: float = 0.50
    accuracy_at_current_threshold: float
    precision_at_current_threshold: float
    recall_at_current_threshold: float
    f1_at_current_threshold: float = 0.0
    far_at_current_threshold: float
    frr_at_current_threshold: float
    eer: float = 0.0
    eer_threshold: float = 0.50
    auc_roc: float = 1.0
    optimal_threshold_recommendations: Dict[str, float] = {}
    disclaimer: Optional[str] = None


class EvaluationResponse(BaseModel):
    status: str
    message: str
    warning: Optional[str] = None
    is_insufficient: bool = False
    suggested_threshold: Optional[float] = None
    current_threshold: Optional[float] = None
    disclaimer: Optional[str] = None
    dataset_info: Optional[Dict[str, Any]] = None
    metrics: Optional[EvaluationMetrics] = None
    threshold_table: List[ThresholdTableRow] = []
    confusion_matrix: Optional[ConfusionMatrixData] = None
    similarity_distribution: Optional[SimilarityDistribution] = None
    test_cases: List[TestCaseDetail] = []
    roc_curve: List[RocPoint] = []
    threshold_tradeoff: List[RocPoint] = []

