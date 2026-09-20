from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.recognition_log import RecognitionLog
from app.schemas.recognition import RecognitionLogResponse


class LogService:
    @staticmethod
    def get_logs(
        db: Session,
        status: Optional[str] = None,
        search: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        limit: int = 25,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Return paginated recognition logs with optional filters.

        Args:
            status:    Filter by status string ('MATCH', 'UNKNOWN', 'NO_FACE').
            search:    Partial match on matched_name (case-insensitive).
            date_from: Include only logs at or after this datetime.
            date_to:   Include only logs at or before this datetime.
            limit:     Maximum number of records to return (page size).
            offset:    Number of records to skip (pagination offset).

        Returns:
            Dict with 'total', 'limit', 'offset', and 'items' list.
        """
        query = db.query(RecognitionLog)

        if status and status.upper() != "ALL":
            st = status.upper()
            if st in ("KNOWN", "MATCH"):
                query = query.filter(RecognitionLog.status.in_(["KNOWN", "MATCH"]))
            else:
                query = query.filter(RecognitionLog.status == st)

        if search:
            query = query.filter(RecognitionLog.matched_name.ilike(f"%{search}%"))

        if date_from:
            query = query.filter(RecognitionLog.timestamp >= date_from)

        if date_to:
            query = query.filter(RecognitionLog.timestamp <= date_to)

        total = query.count()
        logs = (
            query.order_by(RecognitionLog.timestamp.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "items": [RecognitionLogResponse.model_validate(log) for log in logs],
        }

    @staticmethod
    def get_stats(db: Session) -> Dict[str, int]:
        """Return counts broken down by recognition outcome."""
        total = db.query(RecognitionLog).count()
        known = db.query(RecognitionLog).filter(RecognitionLog.status.in_(["MATCH", "KNOWN"])).count()
        unknown = db.query(RecognitionLog).filter(RecognitionLog.status == "UNKNOWN").count()
        no_face = db.query(RecognitionLog).filter(RecognitionLog.status == "NO_FACE").count()
        return {
            "total": total,
            "known": known,
            "unknown": unknown,
            "no_face": no_face,
        }

    @staticmethod
    def clear_logs(db: Session) -> int:
        """Delete all recognition logs. Returns the number of deleted records."""
        count = db.query(RecognitionLog).delete()
        db.commit()
        return count

    @staticmethod
    def delete_log(db: Session, log_id: int) -> bool:
        """Delete a single recognition log by ID and remove thumbnail if present."""
        log = db.query(RecognitionLog).filter(RecognitionLog.id == log_id).first()
        if not log:
            return False

        if log.query_image_path:
            from app.core.config import settings
            thumb_file = settings.DATA_DIR / log.query_image_path
            if thumb_file.exists():
                try:
                    thumb_file.unlink()
                except Exception:
                    pass

        db.delete(log)
        db.commit()
        return True
