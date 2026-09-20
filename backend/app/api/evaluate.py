from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.evaluation import EvaluationResponse
from app.services.evaluation_service import evaluation_service

router = APIRouter(prefix="/evaluate", tags=["Evaluation & Biometric Benchmarking"])


@router.post("", response_model=EvaluationResponse)
@router.post("/run", response_model=EvaluationResponse)
def run_evaluation_benchmark(db: Session = Depends(get_db)):
    """
    Executes biometric evaluation suite:
    - Calculates TPR (Recall), FAR, FRR, Precision, Accuracy
    - Generates 40-point ROC Curve and FAR-FRR error trade-off curve
    - Calculates Equal Error Rate (EER) and Area Under ROC Curve (AUC)
    - Suggests optimal thresholds for High-Security, Balanced, and Convenience modes
    """
    return evaluation_service.run_evaluation(db=db)


@router.get("/summary", response_model=EvaluationResponse)
def get_evaluation_summary(db: Session = Depends(get_db)):
    """Fetches evaluation metrics and ROC curve."""
    return evaluation_service.run_evaluation(db=db)
