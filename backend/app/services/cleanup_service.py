"""
Cleanup Service — Image Retention Policy Enforcement
=====================================================
Runs as a background daemon thread launched at application startup.
Deletes stored probe/query thumbnails that exceed the configured
IMAGE_RETENTION_DAYS retention window.

PRIVACY NOTE:
  Probe images stored during recognition are considered biometric-adjacent
  data. This service ensures they are not retained indefinitely.
  The enrolled face embeddings in the database are NOT deleted by this service
  (they are removed only through the explicit DELETE /api/persons endpoint).
"""

import logging
import os
import threading
import time
from datetime import datetime, timedelta
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger("face_recognition.cleanup")


def _delete_old_files(directory: Path, retention_days: int) -> int:
    """
    Scan *directory* and delete files older than *retention_days*.
    Returns the count of deleted files.
    """
    if not directory.exists():
        return 0

    cutoff = datetime.now() - timedelta(days=retention_days)
    deleted = 0

    for file_path in directory.iterdir():
        if not file_path.is_file():
            continue
        try:
            mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
            if mtime < cutoff:
                file_path.unlink()
                deleted += 1
                # Log filename only — never log biometric content
                logger.info("Retention cleanup: removed expired file '%s' (modified %s)", file_path.name, mtime.date())
        except Exception as exc:
            logger.warning("Retention cleanup: could not process '%s': %s", file_path.name, exc)

    return deleted


def run_cleanup_once() -> dict:
    """
    Execute a single cleanup pass across the thumbnails directory.
    Returns a summary dict suitable for logging or health checks.
    """
    retention_days = settings.IMAGE_RETENTION_DAYS
    if retention_days <= 0:
        logger.info("Retention cleanup: disabled (IMAGE_RETENTION_DAYS=%d)", retention_days)
        return {"status": "disabled", "deleted": 0}

    logger.info(
        "Retention cleanup: scanning '%s' for files older than %d day(s).",
        settings.THUMBNAILS_DIR,
        retention_days,
    )

    deleted = _delete_old_files(settings.THUMBNAILS_DIR, retention_days)

    logger.info("Retention cleanup: finished. Deleted %d file(s).", deleted)
    return {
        "status": "ok",
        "deleted": deleted,
        "retention_days": retention_days,
        "directory": str(settings.THUMBNAILS_DIR),
    }


# ---------------------------------------------------------------------------
# Background daemon thread
# ---------------------------------------------------------------------------

_CLEANUP_INTERVAL_SECONDS = 24 * 60 * 60  # Run once every 24 hours
_stop_event = threading.Event()


def _cleanup_loop():
    """Infinite loop that runs cleanup once per day until the stop event is set."""
    logger.info(
        "Retention cleanup daemon started. Interval: %d seconds, Retention: %d days.",
        _CLEANUP_INTERVAL_SECONDS,
        settings.IMAGE_RETENTION_DAYS,
    )
    # Run immediately at startup to catch any stale files from previous sessions
    run_cleanup_once()

    while not _stop_event.wait(timeout=_CLEANUP_INTERVAL_SECONDS):
        run_cleanup_once()

    logger.info("Retention cleanup daemon stopped.")


def start_cleanup_daemon() -> threading.Thread:
    """
    Launch the cleanup daemon as a background daemon thread.
    The thread will be automatically killed when the main process exits.
    Should be called once from the application lifespan startup handler.
    """
    thread = threading.Thread(target=_cleanup_loop, name="retention-cleanup", daemon=True)
    thread.start()
    logger.info("Retention cleanup daemon thread launched (id=%d).", thread.ident)
    return thread


def stop_cleanup_daemon():
    """Signal the cleanup daemon to stop gracefully."""
    _stop_event.set()
