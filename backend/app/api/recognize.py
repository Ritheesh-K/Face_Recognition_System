from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.recognition import RecognitionResponse
from app.services.recognition_service import RecognitionService

router = APIRouter(tags=["Face Recognition & Identification"])


@router.post("/recognize", response_model=RecognitionResponse)
async def recognize_faces(
    file: UploadFile = File(...),
    threshold: Optional[float] = Form(None),
    db: Session = Depends(get_db)
):
    """
    1:N Face Identification with strict unknown-person rejection.
    Detects faces, generates ArcFace embeddings, computes cosine similarity
    against all enrolled identities, and assigns identity ONLY if score >= threshold.
    Otherwise returns 'UNKNOWN'.
    """
    if threshold is not None and (threshold < 0.0 or threshold > 1.0):
        raise HTTPException(status_code=400, detail="Threshold must be a decimal value between 0.00 and 1.00.")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload JPG, PNG, or WEBP images.")

    image_bytes = await file.read()
    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="The uploaded image file is empty or corrupted.")

    response = RecognitionService.identify_faces(
        db=db,
        image_bytes=image_bytes,
        threshold_override=threshold
    )
    return response
