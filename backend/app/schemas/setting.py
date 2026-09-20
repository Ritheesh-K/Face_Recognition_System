from pydantic import BaseModel, Field
from typing import Optional


class SettingUpdate(BaseModel):
    matching_threshold: Optional[float] = Field(None, ge=0.05, le=0.95)
    detection_threshold: Optional[float] = Field(None, ge=0.10, le=0.99)


class SystemSettingsResponse(BaseModel):
    matching_threshold: float
    detection_threshold: float
    model_name: str
    embedding_dim: int
    similarity_metric: str
