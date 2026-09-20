from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class RecognitionLog(Base):
    __tablename__ = "recognition_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    matched_person_id = Column(Integer, ForeignKey("persons.id", ondelete="SET NULL"), nullable=True)
    matched_name = Column(String(120), nullable=False, default="UNKNOWN")
    similarity_score = Column(Float, nullable=False)
    threshold_used = Column(Float, nullable=False)
    status = Column(String(50), nullable=False)  # MATCH/KNOWN, UNKNOWN, NO_FACE
    detected_face_count = Column(Integer, default=1, nullable=False)
    query_image_path = Column(String(255), nullable=True)
    bounding_box_json = Column(Text, nullable=True)
    latency_ms = Column(Float, nullable=False)

    matched_person = relationship("Person", back_populates="logs")
