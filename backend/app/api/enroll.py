from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.person import (
    PersonCreate, PersonUpdate, PersonResponse, EmbeddingResponse, EnrollmentResponse
)
from app.services.person_service import PersonService

router = APIRouter(tags=["Enrollment & Person Management"])



@router.get("/persons", response_model=List[PersonResponse])
def list_persons(
    query: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List all registered identities with enrolled image counts."""
    return PersonService.get_all_persons(db=db, query=query)


@router.post("/persons", response_model=PersonResponse, status_code=status.HTTP_201_CREATED)
def create_person(
    person_in: PersonCreate,
    db: Session = Depends(get_db)
):
    """Create a new person record."""
    person = PersonService.create_person(db, person_in)
    return PersonService.get_person_by_id(db, person.id)


@router.get("/persons/{person_id}", response_model=PersonResponse)
def get_person(
    person_id: int,
    db: Session = Depends(get_db)
):
    """Get person details with all enrolled images."""
    p = PersonService.get_person_by_id(db, person_id)
    if not p:
        raise HTTPException(status_code=404, detail="Person not found.")
    return p


@router.put("/persons/{person_id}", response_model=PersonResponse)
def update_person(
    person_id: int,
    person_in: PersonUpdate,
    db: Session = Depends(get_db)
):
    """Update person details."""
    try:
        p = PersonService.update_person(db, person_id, person_in)
        if not p:
            raise HTTPException(status_code=404, detail="Person not found.")
        return PersonService.get_person_by_id(db, person_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/persons/{person_id}")
def delete_person(
    person_id: int,
    db: Session = Depends(get_db)
):
    """Delete a person and all their enrolled embeddings."""
    success = PersonService.delete_person(db, person_id)
    if not success:
        raise HTTPException(status_code=404, detail="Person not found.")
    return {"message": "Person deleted successfully", "deleted": True}


@router.post("/persons/{person_id}/images", response_model=EmbeddingResponse)
async def upload_face_image(
    person_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Enrolls an additional face image for an existing person.
    Detects face, verifies alignment, extracts ArcFace embedding, and stores thumbnail.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image.")

    image_bytes = await file.read()
    try:
        embedding = PersonService.add_face_image_to_person(
            db=db,
            person_id=person_id,
            image_bytes=image_bytes,
            filename=file.filename or "face.jpg"
        )
        return EmbeddingResponse.model_validate(embedding)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process face: {str(e)}")


@router.delete("/embeddings/{embedding_id}")
def delete_embedding(
    embedding_id: int,
    db: Session = Depends(get_db)
):
    """Deletes a specific enrolled image."""
    success = PersonService.delete_face_embedding(db, embedding_id)
    if not success:
        raise HTTPException(status_code=404, detail="Embedding not found.")
    return {"message": "Embedding deleted successfully", "deleted": True}


@router.post("/enroll", response_model=EnrollmentResponse, status_code=status.HTTP_201_CREATED)
async def quick_enroll(
    name: str = Form(...),
    code: Optional[str] = Form(None),
    department: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    images: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    """
    Complete Face Enrollment Workflow:
    - User enters: Person name, Person code/ID, Multiple face images (at least 3).
    - For every image: validates file type, decode, exactly 1 face, quality, extracts ArcFace embedding, L2-normalizes, saves embedding and metadata.
    - Computes representative template = L2_normalize(mean(all_embeddings)).
    - Stores both individual embeddings and representative template.
    - Prevents duplicate person codes.
    - Returns 'Face enrolled successfully'.
    """
    image_tuples = []
    for img_file in images:
        content = await img_file.read()
        image_tuples.append((img_file.filename or "face.jpg", content))

    try:
        result = PersonService.enroll_person_with_images(
            db=db,
            name=name,
            code=code,
            department=department,
            notes=notes,
            image_files=image_tuples
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Enrollment failed: {str(e)}")


@router.post("/enroll/verify-photos")
async def verify_enrollment_photos(
    images: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    """
    Pre-enrollment photo verification:
    - Validates that each image has exactly 1 detectable, high-quality face.
    - Computes pairwise cosine similarity between all photos in the batch.
    - Identifies any discordant photos of different persons.
    - Checks against existing enrolled identities in the database to prevent duplicate registrations.
    """
    image_tuples = []
    for img_file in images:
        content = await img_file.read()
        image_tuples.append((img_file.filename or "face.jpg", content))

    result = PersonService.verify_photos_only(image_tuples, db=db)
    return result


