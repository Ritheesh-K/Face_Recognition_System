import logging
import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings

# Directory paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
UPLOADS_DIR = DATA_DIR / "uploads"
THUMBNAILS_DIR = DATA_DIR / "thumbnails"
EVAL_DIR = DATA_DIR / "evaluation"

for directory in [DATA_DIR, UPLOADS_DIR, THUMBNAILS_DIR, EVAL_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

# Configure structured application logging
# CRITICAL PRIVACY RULE: Never log raw biometric float vectors or embedding arrays
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s]: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(DATA_DIR / "app.log", encoding="utf-8")
    ]
)
logger = logging.getLogger("face_recognition")


class Settings(BaseSettings):
    PROJECT_NAME: str = "Face Recognition Identification System"
    API_V1_STR: str = "/api"
    DATABASE_URL: str = f"sqlite:///{DATA_DIR / 'face_recognition.db'}"

    # InsightFace Model Configuration
    # Buffalo_sc uses SCRFD 500M detector + MobileFaceNet ArcFace 512D ONNX
    MODEL_PACK: str = "buffalo_sc"
    DET_SIZE: tuple[int, int] = (320, 320)
    DETECTION_THRESHOLD: float = 0.50

    # Initial Matching Threshold:
    # 0.50 is the initial default for cosine similarity on ArcFace embeddings.
    # Calibrated via validation data in the Evaluation Module.
    DEFAULT_MATCHING_THRESHOLD: float = 0.50

    # Biometric similarity metric
    SIMILARITY_METRIC: str = "cosine"

    # Security & Privacy Configuration
    MAX_UPLOAD_SIZE_MB: int = 10
    IMAGE_RETENTION_DAYS: int = 30  # Automatic cleanup retention threshold
    SAVE_RECOGNITION_PROBES: bool = True  # Whether to store query probe thumbnails
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"
    RATE_LIMIT_PER_MINUTE: int = 120

    # Paths
    DATA_DIR: Path = DATA_DIR
    UPLOADS_DIR: Path = UPLOADS_DIR
    THUMBNAILS_DIR: Path = THUMBNAILS_DIR
    EVAL_DIR: Path = EVAL_DIR

    def get_cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    model_config = {
        "case_sensitive": True,
        "env_file": str(BASE_DIR / ".env"),
        "extra": "ignore"
    }


settings = Settings()
