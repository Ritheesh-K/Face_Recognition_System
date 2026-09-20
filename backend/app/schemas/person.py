from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class EmbeddingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    person_id: int
    image_path: str
    thumbnail_path: str
    detection_confidence: Optional[float] = None
    created_at: datetime


class PersonBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    code: Optional[str] = Field(None, max_length=60)
    department: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


class PersonCreate(PersonBase):
    pass


class PersonUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    code: Optional[str] = Field(None, max_length=60)
    department: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


class PersonResponse(PersonBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    avatar_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    image_count: int = 0
    embeddings: List[EmbeddingResponse] = []


class EnrollmentResponse(BaseModel):
    message: str = "Face enrolled successfully"
    person: PersonResponse
    enrolled_images_count: int

