from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.setting import SystemSettingsResponse, SettingUpdate
from app.services.settings_service import SettingsService

router = APIRouter(prefix="/settings", tags=["System Settings & Calibration"])


@router.get("", response_model=SystemSettingsResponse)
def get_settings(db: Session = Depends(get_db)):
    """Fetch current system configuration and operating threshold."""
    return SettingsService.get_all_settings(db)


@router.put("", response_model=SystemSettingsResponse)
def update_settings(
    update_in: SettingUpdate,
    db: Session = Depends(get_db)
):
    """Update operating matching threshold or detector score sensitivity."""
    return SettingsService.update_settings(db, update_in)
