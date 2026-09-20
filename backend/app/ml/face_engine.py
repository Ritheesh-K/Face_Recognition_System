import logging
from typing import List, Dict, Any, Optional
import numpy as np
import cv2

from app.core.config import settings
from app.ml.detector import face_detector, FaceDetector
from app.ml.embedder import face_embedder, FaceEmbedder
from app.ml.matcher import face_matcher, FaceMatcher
from app.ml.aligner import FaceAligner

logger = logging.getLogger("face_recognition.engine")


class FaceEngine:
    """
    Unified Face Recognition Pipeline Facade.
    Coordinates detector, aligner, embedder, and matcher.
    """

    _instance: Optional["FaceEngine"] = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(FaceEngine, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if getattr(self, "_initialized", False):
            return
        self.detector = face_detector
        self.embedder = face_embedder
        self.matcher = face_matcher
        self.aligner = FaceAligner()
        self._initialized = True
        logger.info("FaceEngine pipeline fully initialized.")

    def process_image(
        self,
        image_bytes_or_bgr: Any,
        min_det_score: float = settings.DETECTION_THRESHOLD
    ) -> List[Dict[str, Any]]:
        """
        Decodes image, detects faces, aligns 5 landmarks, and generates normalized ArcFace embeddings.
        """
        if isinstance(image_bytes_or_bgr, bytes):
            nparr = np.frombuffer(image_bytes_or_bgr, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                raise ValueError("Could not decode image bytes into a valid image format.")
        elif isinstance(image_bytes_or_bgr, np.ndarray):
            img = image_bytes_or_bgr
        else:
            raise TypeError("Expected image bytes or numpy.ndarray.")

        # Face Detection
        detections = self.detector.detect_faces(img, min_score=min_det_score)

        results = []
        for det in detections:
            aligned_face, norm_emb = self.embedder.generate_embedding(
                image=img,
                landmarks=det["landmarks"],
                raw_face=det["raw_face"]
            )
            results.append({
                "bbox": det["bbox"],
                "confidence": det["det_score"],
                "landmarks": det["landmarks"].tolist() if det["landmarks"] is not None else None,
                "aligned_face": aligned_face,
                "embedding": norm_emb
            })

        return results


face_engine = FaceEngine()
