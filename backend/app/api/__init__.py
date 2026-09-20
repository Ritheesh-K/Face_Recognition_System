from fastapi import APIRouter

from app.api.faces import router as faces_router
from app.api.enroll import router as enroll_router
from app.api.recognize import router as recognize_router
from app.api.logs import router as logs_router
from app.api.settings import router as settings_router
from app.api.evaluate import router as evaluate_router

api_router = APIRouter()
api_router.include_router(faces_router)
api_router.include_router(enroll_router)
api_router.include_router(recognize_router)
api_router.include_router(logs_router)
api_router.include_router(settings_router)
api_router.include_router(evaluate_router)

__all__ = ["api_router"]
