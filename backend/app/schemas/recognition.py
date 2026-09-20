from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field, ConfigDict


class BoundingBox(BaseModel):
    x1: int
    y1: int
    x2: int
    y2: int
    confidence: float


class FaceDetectionResult(BaseModel):
    bbox: BoundingBox
    landmarks: Optional[List[List[float]]] = None
    detection_score: float


class RecognitionMatch(BaseModel):
    bbox: BoundingBox
    status: str = Field(..., description="'MATCH' or 'UNKNOWN'")
    person_id: Optional[int] = None
    name: str = Field(..., description="Matched name or 'UNKNOWN'")
    department: Optional[str] = None
    similarity_score: float
    threshold_used: float
    is_unknown: bool
    margin: float = Field(..., description="threshold - similarity_score (negative if matched)")
    candidate_ranking: Optional[List[dict]] = None


class MatchedPersonSummary(BaseModel):
    id: int
    name: str
    code: Optional[str] = None
    department: Optional[str] = None


class RecognitionResponse(BaseModel):
    status: str = Field(..., description="'KNOWN' or 'UNKNOWN'")
    person: Optional[MatchedPersonSummary] = Field(None, description="Matched person details if KNOWN, otherwise null")
    similarity: float = Field(0.0, description="Highest cosine similarity score")
    threshold: float = Field(0.50, description="Operating threshold used for matching decision")
    total_faces_detected: int = 0
    threshold_applied: Optional[float] = None
    latency_ms: float = 0.0
    results: List[RecognitionMatch] = []
    message: str = ""



class RecognitionLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    timestamp: datetime
    matched_person_id: Optional[int] = None
    matched_name: str
    similarity_score: float
    threshold_used: float
    status: str
    detected_face_count: int = 1
    query_image_path: Optional[str] = None
    bounding_box_json: Optional[str] = None
    latency_ms: float


class RecognitionLogFilter(BaseModel):
    status: Optional[str] = None
    search: Optional[str] = None
    person_id: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    limit: int = 50
    offset: int = 0
