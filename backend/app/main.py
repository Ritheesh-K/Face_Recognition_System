import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import Base, engine
from app.models import Person, FaceEmbedding, RecognitionLog, SystemSetting
from app.ml.face_engine import face_engine
from app.api import api_router
from app.services.cleanup_service import start_cleanup_daemon, stop_cleanup_daemon

logger = logging.getLogger("face_recognition.main")

# Ensure database tables exist immediately
Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    print("[Startup] Database tables initialized.")
    # Warm up face engine singleton
    _ = face_engine
    print("[Startup] Face recognition engine warmed up.")
    # Start background retention-cleanup daemon
    _cleanup_thread = start_cleanup_daemon()
    print(f"[Startup] Image retention cleanup daemon started (retention={settings.IMAGE_RETENTION_DAYS}d).")
    yield
    # Signal cleanup daemon to stop gracefully
    stop_cleanup_daemon()
    print("[Shutdown] Retention cleanup daemon stopped.")
    print("[Shutdown] Cleaning up resources.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Production-grade local Face Recognition Identification System with ArcFace, RetinaFace/SCRFD, and unknown-person rejection.",
    version="1.0.0",
    lifespan=lifespan
)

# Global unhandled exception handler to prevent leaking stack traces
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled server exception at %s %s: %s", request.method, request.url.path, str(exc), exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred while processing your request. Please try again or verify system logs."}
    )

# Enable CORS for local Vite dev server and production frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded images and thumbnails
app.mount("/media", StaticFiles(directory=str(settings.DATA_DIR)), name="media")

# Include REST API endpoints
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["System Health"])
@app.get("/api/health", tags=["System Health"])
def healthcheck():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "detector": "InsightFace SCRFD",
        "embedder": "ArcFace 512D ONNX",
        "execution_provider": "CPUExecutionProvider",
        "database": "SQLite (local)"
    }
