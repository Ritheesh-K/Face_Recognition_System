import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.database import SessionLocal
from app.core.config import settings
from app.models.person import Person
from app.models.embedding import FaceEmbedding
from app.models.recognition_log import RecognitionLog

def clear_all_data():
    db = SessionLocal()
    try:
        # Count existing records
        num_logs = db.query(RecognitionLog).count()
        num_embeddings = db.query(FaceEmbedding).count()
        num_persons = db.query(Person).count()

        print(f"Current database state:")
        print(f" - Enrolled Persons: {num_persons}")
        print(f" - Face Embeddings: {num_embeddings}")
        print(f" - Recognition Logs: {num_logs}")

        # Delete database records
        db.query(RecognitionLog).delete()
        db.query(FaceEmbedding).delete()
        db.query(Person).delete()
        db.commit()

        # Clean image directories
        deleted_files = 0
        for folder_name in ["uploads", "thumbnails", "faces"]:
            folder = settings.DATA_DIR / folder_name
            if folder.exists() and folder.is_dir():
                for item in folder.iterdir():
                    if item.is_file():
                        try:
                            item.unlink()
                            deleted_files += 1
                        except OSError as e:
                            print(f"Warning: Could not delete {item}: {e}")

        print("\nAll data successfully cleared!")
        print(f" - Deleted {num_persons} persons and {num_embeddings} embeddings from database.")
        print(f" - Deleted {num_logs} recognition history logs from database.")
        print(f" - Removed {deleted_files} stored image files from disk.")
        print("System is now completely clean and ready for new enrollments and testing.")

    finally:
        db.close()

if __name__ == "__main__":
    clear_all_data()
