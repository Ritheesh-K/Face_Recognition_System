from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List

from app.ml.face_engine import face_engine
from app.schemas.recognition import FaceDetectionResult, BoundingBox

router = APIRouter(prefix="/faces", tags=["Face Detection"])


@router.post("/detect", response_model=List[FaceDetectionResult])
async def detect_faces(file: UploadFile = File(...)):
    """
    Detects all faces in the provided image and extracts 5 facial landmarks.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a valid image format.")

    image_bytes = await file.read()
    try:
        faces = face_engine.process_image(image_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Face detection failed: {str(e)}")

    results = []
    for f in faces:
        b = f["bbox"]
        results.append(
            FaceDetectionResult(
                bbox=BoundingBox(
                    x1=b[0], y1=b[1], x2=b[2], y2=b[3],
                    confidence=round(f["confidence"], 3)
                ),
                landmarks=f["landmarks"],
                detection_score=round(f["confidence"], 3)
            )
        )
    return results
