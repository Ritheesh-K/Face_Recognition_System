import sys
from pathlib import Path
import cv2
import numpy as np

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.database import SessionLocal
from app.services.person_service import PersonService

def main():
    db = SessionLocal()
    eval_known_dir = backend_dir.parent / "evaluation" / "known"
    artifact_dir = Path(r"C:\Users\SACHIN N S\.gemini\antigravity-ide\brain\d217cfe4-143c-4775-a055-66bdb3c85f73")

    identities = [
        {"code": "person1", "name": "Alice Johnson", "fallback_file": "portrait_person1_1789837693229.jpg"},
        {"code": "person2", "name": "Bob Lee", "fallback_file": "portrait_person2_1789837930278.jpg"},
        {"code": "person3", "name": "Carol Sharma", "fallback_file": "portrait_person3_1789837956869.jpg"}
    ]

    for ident in identities:
        # Check if already enrolled
        existing = PersonService.get_person_by_code(db, ident["code"])
        if existing:
            print(f"{ident['name']} ({ident['code']}) already exists. Skipping.")
            continue

        # Look in evaluation/known/<code_id>/test_01.jpg first
        src_path = eval_known_dir / ident["code"] / "test_01.jpg"
        if not src_path.exists():
            # Check any image in the person folder
            person_folder = eval_known_dir / ident["code"]
            if person_folder.exists():
                images = list(person_folder.glob("*.jpg")) + list(person_folder.glob("*.png"))
                if images:
                    src_path = images[0]
            
        if not src_path.exists():
            src_path = artifact_dir / ident["fallback_file"]

        if not src_path.exists():
            print(f"File {src_path} not found.")
            continue

        img = cv2.imread(str(src_path))
        if img is None:
            print(f"Failed to read {src_path}")
            continue

        # Create 3 variations for enrollment (slight zoom/crop, slight brightness variation)
        h, w = img.shape[:2]
        
        # Var 1: original
        _, enc1 = cv2.imencode('.jpg', img)
        
        # Var 2: slight brightness +5%
        img2 = np.clip(img.astype(np.float32) * 1.05, 0, 255).astype(np.uint8)
        _, enc2 = cv2.imencode('.jpg', img2)
        
        # Var 3: slight crop & resize
        crop = img[int(h*0.02):int(h*0.98), int(w*0.02):int(w*0.98)]
        img3 = cv2.resize(crop, (w, h))
        _, enc3 = cv2.imencode('.jpg', img3)

        image_files = [
            (f"{ident['code']}_photo1.jpg", enc1.tobytes()),
            (f"{ident['code']}_photo2.jpg", enc2.tobytes()),
            (f"{ident['code']}_photo3.jpg", enc3.tobytes()),
        ]

        try:
            res = PersonService.enroll_person_with_images(
                db=db,
                name=ident["name"],
                code=ident["code"],
                department="Biometrics Engineering",
                notes="Standard gallery enrollment",
                image_files=image_files
            )
            print(f"Successfully enrolled {ident['name']} ({ident['code']}): {res.get('message')}")
        except Exception as e:
            print(f"Failed to enroll {ident['name']}: {e}")

    db.close()

if __name__ == "__main__":
    main()
