import os
import pytest
from pathlib import Path

# Isolate testing database so running tests never wipes out the seeded gallery database
_test_db_path = Path(__file__).resolve().parent.parent / "data" / "test_face_recognition.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_test_db_path}"
