import logging
from typing import Optional, Tuple, Any
import numpy as np
import cv2
from insightface.utils import face_align
from app.ml.detector import face_detector

logger = logging.getLogger("face_recognition.embedder")


class FaceEmbedder:
    """
    ArcFace Embedding Service.
    Performs 5-point canonical alignment, generates ArcFace deep features,
    and applies L2-normalization to the unit hypersphere.
    """

    _instance: Optional["FaceEmbedder"] = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(FaceEmbedder, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if getattr(self, "_initialized", False):
            return

        # Uses the embedding model loaded in face_detector.app
        self.app = face_detector.app
        # Retrieve ArcFace recognition model handler
        self.rec_model = None
        for model in self.app.models.values():
            if hasattr(model, "taskname") and model.taskname == "recognition":
                self.rec_model = model
                break

        self._initialized = True
        logger.info("FaceEmbedder successfully initialized with ArcFace ONNX model.")

    @staticmethod
    def align_face(image: np.ndarray, landmarks: np.ndarray, output_size: int = 112) -> np.ndarray:
        """
        ML Step: 5-point partial affine transformation aligning facial keypoints
        to canonical ArcFace reference coordinates (112x112).
        """
        if landmarks is None or len(landmarks) != 5:
            # Fallback to direct resize if landmarks missing
            return cv2.resize(image, (output_size, output_size))
        try:
            aligned = face_align.norm_crop(image, landmark=landmarks, image_size=output_size)
            return aligned
        except Exception as e:
            logger.warning("Alignment failed, falling back to resize: %s", e)
            return cv2.resize(image, (output_size, output_size))

    @staticmethod
    def normalize_embedding(embedding: np.ndarray) -> np.ndarray:
        """
        ML Step: L2-Normalization.
        Scales the 512D vector so that its Euclidean norm is exactly 1.0:
            e = v / ||v||_2
        This ensures that the Euclidean dot product equals Cosine Similarity.
        """
        vec = np.asarray(embedding, dtype=np.float32).flatten()
        norm = np.linalg.norm(vec)
        if norm > 1e-9:
            return vec / norm
        return vec

    def generate_embedding(
        self,
        image: np.ndarray,
        landmarks: Optional[np.ndarray] = None,
        raw_face: Optional[Any] = None
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Generates aligned thumbnail and normalized 512D ArcFace embedding vector.

        Args:
            image: BGR numpy image.
            landmarks: (5, 2) facial landmark coordinates.
            raw_face: Optional pre-extracted Face object from InsightFace.

        Returns:
            Tuple of (aligned_face_thumbnail_112x112, normalized_512D_embedding).
        """
        if raw_face is not None and hasattr(raw_face, "embedding") and raw_face.embedding is not None:
            # Feature already extracted during detection pass
            aligned = self.align_face(image, landmarks)
            norm_emb = self.normalize_embedding(raw_face.embedding)
            return aligned, norm_emb

        # Align face to 112x112
        aligned = self.align_face(image, landmarks)

        # Forward pass through ArcFace ONNX model
        if self.rec_model is not None:
            raw_emb = self.rec_model.get_feat(aligned)
        else:
            # Fallback via app.get on crop
            sub_faces = self.app.get(aligned)
            if sub_faces and sub_faces[0].embedding is not None:
                raw_emb = sub_faces[0].embedding
            else:
                raw_emb = np.zeros(512, dtype=np.float32)

        norm_emb = self.normalize_embedding(raw_emb)
        return aligned, norm_emb


# Singleton instance
face_embedder = FaceEmbedder()
