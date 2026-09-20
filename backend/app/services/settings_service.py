from sqlalchemy.orm import Session
from app.models.setting import SystemSetting
from app.core.config import settings
from app.schemas.setting import SystemSettingsResponse, SettingUpdate


class SettingsService:
    @staticmethod
    def get_setting(db: Session, key: str, default: str) -> str:
        row = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        if row:
            return row.value
        # Create default
        row = SystemSetting(key=key, value=default)
        db.add(row)
        db.commit()
        db.refresh(row)
        return default

    @classmethod
    def get_matching_threshold(cls, db: Session) -> float:
        val = cls.get_setting(db, "matching_threshold", str(settings.DEFAULT_MATCHING_THRESHOLD))
        return float(val)

    @classmethod
    def get_detection_threshold(cls, db: Session) -> float:
        val = cls.get_setting(db, "detection_threshold", str(settings.DETECTION_THRESHOLD))
        return float(val)

    @classmethod
    def get_all_settings(cls, db: Session) -> SystemSettingsResponse:
        return SystemSettingsResponse(
            matching_threshold=cls.get_matching_threshold(db),
            detection_threshold=cls.get_detection_threshold(db),
            model_name="InsightFace MobileFaceNet / SCRFD",
            embedding_dim=512,
            similarity_metric=settings.SIMILARITY_METRIC
        )

    @classmethod
    def update_settings(cls, db: Session, update_in: SettingUpdate) -> SystemSettingsResponse:
        if update_in.matching_threshold is not None:
            row = db.query(SystemSetting).filter(SystemSetting.key == "matching_threshold").first()
            if not row:
                row = SystemSetting(key="matching_threshold", value=str(update_in.matching_threshold))
                db.add(row)
            else:
                row.value = str(update_in.matching_threshold)

        if update_in.detection_threshold is not None:
            row = db.query(SystemSetting).filter(SystemSetting.key == "detection_threshold").first()
            if not row:
                row = SystemSetting(key="detection_threshold", value=str(update_in.detection_threshold))
                db.add(row)
            else:
                row.value = str(update_in.detection_threshold)

        db.commit()
        return cls.get_all_settings(db)
