from typing import Optional, Dict, Any
from datetime import datetime, date
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.services.log_service import LogService
from app.services.cleanup_service import run_cleanup_once

router = APIRouter(prefix="/logs", tags=["Audit & Recognition Logs"])


@router.get("")
def get_recognition_logs(
    status: Optional[str] = Query(None, description="'MATCH', 'UNKNOWN', 'NO_FACE', or 'ALL'"),
    search: Optional[str] = Query(None, description="Search by matched identity name"),
    date_from: Optional[date] = Query(None, description="Filter logs from this date (YYYY-MM-DD), inclusive"),
    date_to: Optional[date] = Query(None, description="Filter logs up to this date (YYYY-MM-DD), inclusive"),
    limit: int = Query(25, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Retrieve paginated audit logs of recognition attempts with optional filters."""
    # Convert date to datetime boundaries for the query
    dt_from = datetime(date_from.year, date_from.month, date_from.day, 0, 0, 0) if date_from else None
    dt_to = datetime(date_to.year, date_to.month, date_to.day, 23, 59, 59) if date_to else None

    return LogService.get_logs(
        db=db,
        status=status,
        search=search,
        date_from=dt_from,
        date_to=dt_to,
        limit=limit,
        offset=offset
    )


@router.get("/stats")
def get_logs_stats(db: Session = Depends(get_db)) -> Dict[str, int]:
    """Retrieve breakdown counts of logs (total, known, unknown, no_face)."""
    return LogService.get_stats(db=db)


@router.delete("")
def clear_recognition_logs(db: Session = Depends(get_db)):
    """Clears all audit logs. This is irreversible."""
    count = LogService.clear_logs(db)
    return {"message": f"Successfully deleted {count} recognition log entries.", "cleared": True}


@router.delete("/{log_id}")
def delete_single_recognition_log(log_id: int, db: Session = Depends(get_db)):
    """Delete a single recognition log by its ID."""
    success = LogService.delete_log(db=db, log_id=log_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Recognition log record #{log_id} not found.")
    return {"message": f"Successfully deleted recognition log #{log_id}.", "deleted": True, "id": log_id}


@router.post("/cleanup")
def trigger_cleanup():
    """
    Manually trigger the image retention cleanup pass.
    Deletes probe thumbnails older than the configured IMAGE_RETENTION_DAYS.
    Returns a summary of the cleanup operation.
    """
    result = run_cleanup_once()
    return result
