import logging
from typing import List, Dict, Any, Optional
import numpy as np
import cv2
from insightface.app import FaceAnalysis
from app.core.config import settings

logger = logging.getLogger("face_recognition.detector")


class FaceDetector:
    """
    Face Detector module wrapping InsightFace SCRFD.
    Initialized once at application startup; supports CPU execution.
    """

    _instance: Optional["FaceDetector"] = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(FaceDetector, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(
        self,
        model_pack: str = settings.MODEL_PACK,
        det_size: tuple[int, int] = settings.DET_SIZE
    ):
        if getattr(self, "_initialized", False):
            return

        logger.info("Initializing FaceDetector with model pack '%s' on CPU...", model_pack)
        # Initialize InsightFace with CPU execution provider
        self.app = FaceAnalysis(name=model_pack, providers=["CPUExecutionProvider"])
        self.app.prepare(ctx_id=0, det_size=det_size)
        self._initialized = True
        logger.info("FaceDetector successfully initialized.")

    def detect_faces(
        self,
        image: np.ndarray,
        min_score: float = settings.DETECTION_THRESHOLD
    ) -> List[Dict[str, Any]]:
        """
        Step 1: Detect all faces in a BGR image.
        Step 2: Obtain bounding boxes and 5 facial landmarks (eyes, nose, mouth corners).
        Step 3: Filter by detection confidence score.

        Args:
            image: BGR numpy image array.
            min_score: Minimum detection confidence score.

        Returns:
            List of detected faces with 'bbox', 'landmarks', 'det_score', and raw face object.
        """
        if image is None or image.size == 0:
            return []

        # Run SCRFD scale-invariant detector
        raw_faces = self.app.get(image)

        detected = []
        h, w = image.shape[:2]

        for face in raw_faces:
            det_score = float(face.det_score)
            if det_score < min_score:
                continue

            # Clip bounding box to image boundaries
            bbox = [
                max(0, int(face.bbox[0])),
                max(0, int(face.bbox[1])),
                min(w, int(face.bbox[2])),
                min(h, int(face.bbox[3]))
            ]

            # 5 facial landmarks for canonical alignment
            landmarks = face.kps if face.kps is not None else None

            detected.append({
                "bbox": bbox,
                "landmarks": landmarks,
                "det_score": round(det_score, 4),
                "raw_face": face
            })

        logger.info("Detected %d face(s) with confidence >= %.2f", len(detected), min_score)
        return detected


# Singleton instance
face_detector = FaceDetector()
