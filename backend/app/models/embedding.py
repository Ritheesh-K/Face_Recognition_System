from datetime import datetime
import numpy as np
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, LargeBinary
from sqlalchemy.orm import relationship
from app.core.database import Base


class FaceEmbedding(Base):
    __tablename__ = "face_embeddings"

    id = Column(Integer, primary_key=True, index=True)
    person_id = Column(Integer, ForeignKey("persons.id", ondelete="CASCADE"), nullable=False, index=True)
    image_path = Column(String(255), nullable=False)
    thumbnail_path = Column(String(255), nullable=False)
    embedding_vector = Column(LargeBinary, nullable=False)
    detection_confidence = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    person = relationship("Person", back_populates="embeddings")

    def get_numpy_embedding(self) -> np.ndarray:
        """Deserialize raw binary bytes to normalized 512D float32 numpy vector."""
        return np.frombuffer(self.embedding_vector, dtype=np.float32)

    def set_numpy_embedding(self, vec: np.ndarray):
        """Serialize numpy vector into binary bytes."""
        vec = np.asarray(vec, dtype=np.float32)
        # Ensure normalized
        norm = np.linalg.norm(vec)
        if norm > 1e-6:
            vec = vec / norm
        self.embedding_vector = vec.tobytes()
