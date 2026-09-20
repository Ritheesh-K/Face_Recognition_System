from datetime import datetime
from typing import Optional
import numpy as np
from sqlalchemy import Column, Integer, String, Text, DateTime, LargeBinary
from sqlalchemy.orm import relationship
from app.core.database import Base


class Person(Base):
    __tablename__ = "persons"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False, index=True)
    code = Column(String(60), nullable=True, unique=True, index=True)
    department = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    avatar_path = Column(String(255), nullable=True)
    # Representative template embedding: L2-normalized mean vector of all enrolled photos
    template_embedding = Column(LargeBinary, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    embeddings = relationship(
        "FaceEmbedding",
        back_populates="person",
        cascade="all, delete-orphan"
    )
    logs = relationship(
        "RecognitionLog",
        back_populates="matched_person"
    )

    def get_template_embedding(self) -> Optional[np.ndarray]:
        """Returns the representative template embedding as a 512D float32 numpy array."""
        if not self.template_embedding:
            return None
        return np.frombuffer(self.template_embedding, dtype=np.float32)

    def update_representative_template(self):
        """
        Calculates and updates the representative template embedding
        by averaging all enrolled embeddings and L2-normalizing the centroid.
        """
        if not self.embeddings:
            self.template_embedding = None
            return

        all_vectors = [emb.get_numpy_embedding() for emb in self.embeddings]
        if not all_vectors:
            self.template_embedding = None
            return

        # Mean vector across all enrolled face samples
        mean_vector = np.mean(all_vectors, axis=0)
        norm = np.linalg.norm(mean_vector)
        if norm > 1e-6:
            mean_vector = mean_vector / norm
        self.template_embedding = mean_vector.astype(np.float32).tobytes()
