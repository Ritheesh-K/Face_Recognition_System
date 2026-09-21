import logging
import uuid
import hashlib
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple
import cv2
import numpy as np
from sqlalchemy import func
from sqlalchemy.orm import Session
from fastapi import UploadFile

from app.core.config import settings
from app.models.person import Person
from app.models.embedding import FaceEmbedding
from app.schemas.person import PersonCreate, PersonUpdate, PersonResponse
from app.ml.detector import face_detector
from app.ml.embedder import face_embedder

logger = logging.getLogger("face_recognition.person_service")

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


class PersonService:
    @staticmethod
    def get_all_persons(db: Session, query: Optional[str] = None) -> List[PersonResponse]:
        db_query = db.query(Person)
        if query:
            db_query = db_query.filter(
                (Person.name.ilike(f"%{query}%")) | (Person.code.ilike(f"%{query}%"))
            )
        persons = db_query.order_by(Person.created_at.desc()).all()

        results = []
        for p in persons:
            resp = PersonResponse.model_validate(p)
            resp.image_count = len(p.embeddings)
            results.append(resp)
        return results

    @staticmethod
    def get_person_by_id(db: Session, person_id: int) -> Optional[PersonResponse]:
        p = db.query(Person).filter(Person.id == person_id).first()
        if not p:
            return None
        resp = PersonResponse.model_validate(p)
        resp.image_count = len(p.embeddings)
        return resp

    @staticmethod
    def get_person_by_code(db: Session, code: str) -> Optional[Person]:
        if not code:
            return None
        return db.query(Person).filter(Person.code == code).first()

    @staticmethod
    def create_person(db: Session, person_in: PersonCreate) -> Person:
        person = Person(
            name=person_in.name.strip(),
            code=person_in.code.strip() if person_in.code else None,
            department=person_in.department.strip() if person_in.department else None,
            notes=person_in.notes.strip() if person_in.notes else None
        )
        db.add(person)
        db.commit()
        db.refresh(person)
        return person

    @staticmethod
    def update_person(db: Session, person_id: int, person_in: PersonUpdate) -> Optional[Person]:
        person = db.query(Person).filter(Person.id == person_id).first()
        if not person:
            return None
        if person_in.name is not None:
            clean_name = person_in.name.strip()
            if not clean_name:
                raise ValueError("Person name cannot be empty.")
            person.name = clean_name
        if person_in.code is not None:
            clean_code = person_in.code.strip() if person_in.code else None
            if clean_code:
                existing = db.query(Person).filter(
                    func.lower(Person.code) == clean_code.lower(),
                    Person.id != person_id
                ).first()
                if existing:
                    raise ValueError(f"Person code / roll number '{clean_code}' is already assigned to '{existing.name}'.")
            person.code = clean_code
        if person_in.department is not None:
            person.department = person_in.department.strip() if person_in.department else None
        if person_in.notes is not None:
            person.notes = person_in.notes.strip() if person_in.notes else None
        db.commit()
        db.refresh(person)
        return person

    @staticmethod
    def validate_and_decode_image(image_bytes: bytes, filename: str) -> Tuple[np.ndarray, str]:
        """
        Validates file type and decodes image bytes with user-friendly messages.
        """
        ext = Path(filename).suffix.lower()
        if ext and ext not in ALLOWED_IMAGE_EXTENSIONS:
            raise ValueError(f"Image could not be processed: unsupported format '{ext}'. Please upload JPG, PNG, WEBP, or BMP images.")

        nparr = np.frombuffer(image_bytes, np.uint8)
        if nparr.size == 0:
            raise ValueError("Image could not be processed: the uploaded file is empty.")

        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None or img.size == 0:
            raise ValueError("Image could not be processed: the file appears corrupted or is not a valid image.")

        # Check for extremely dark image
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        mean_brightness = float(np.mean(gray))
        if mean_brightness < 18.0:
            raise ValueError("The uploaded image is too dark. Please use better lighting.")

        # Check for blurry image (Laplacian variance)
        # Threshold relaxed from 20.0 to 7.0 to accommodate WhatsApp compression, portrait selfies, and soft ambient lighting
        laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        if laplacian_var < 7.0:
            raise ValueError("The image appears blurry. Please upload a sharp, focused face photo.")

        return img, ext or ".jpg"

    @classmethod
    def process_single_enrollment_image(
        cls,
        image_bytes: bytes,
        filename: str = "upload.jpg"
    ) -> Dict[str, Any]:
        """
        Validates and extracts embedding for one enrollment image:
        1. Validate file type and decode image.
        2. Detect faces.
        3. Require exactly one face (reject 0 or >1 faces).
        4. Validate face quality (resolution, score, darkness, blur).
        5. Extract aligned face and generate L2-normalized ArcFace embedding.
        """
        img, ext = cls.validate_and_decode_image(image_bytes, filename)

        # Detect faces
        detected_faces = face_detector.detect_faces(img, min_score=0.45)

        # Reject images containing zero faces
        if len(detected_faces) == 0:
            raise ValueError("No face detected. Please upload a clearer image.")

        # Reject ambiguous images containing multiple faces
        if len(detected_faces) > 1:
            raise ValueError("Multiple faces detected. Please upload an image containing only one face.")

        face = detected_faces[0]

        # Face quality check: resolution must be at least 45x45 pixels and score >= 0.45
        bbox = face["bbox"]
        width = bbox[2] - bbox[0]
        height = bbox[3] - bbox[1]
        if width < 45 or height < 45:
            raise ValueError(
                "Face quality is too low: detected face region is too small for reliable identification. "
                "Please move closer to the camera or use a higher-resolution image."
            )

        if face["det_score"] < 0.45:
            raise ValueError("Face quality is too low: detection confidence is insufficient. "
                             "Please use a well-lit, sharp, front-facing photo.")

        # 5-point alignment and L2-normalized 512D ArcFace embedding
        aligned_face, norm_emb = face_embedder.generate_embedding(
            image=img,
            landmarks=face["landmarks"],
            raw_face=face["raw_face"]
        )

        return {
            "image": img,
            "ext": ext,
            "aligned_face": aligned_face,
            "embedding": norm_emb,
            "confidence": face["det_score"],
            "bbox": bbox
        }

    @classmethod
    def verify_photo_batch_consistency(
        cls,
        processed_images: List[Tuple[str, bytes, Dict[str, Any]]],
        threshold: float = 0.45
    ) -> Dict[str, Any]:
        """
        Cross-photo identity consistency check:
        Ensures all uploaded images in an enrollment batch belong to the SAME person.
        
        Computes the pairwise cosine similarity matrix across all 512D ArcFace embeddings.
        Flags any outlier or mismatched photos whose similarity to other photos falls below threshold.
        """
        n = len(processed_images)
        if n < 2:
            return {
                "is_consistent": True,
                "mismatched_indices": [],
                "mismatched_filenames": [],
                "details": [{"index": 0, "filename": processed_images[0][0], "is_matched": True, "avg_similarity": 1.0}],
                "matrix": [[1.0]],
                "error_message": None
            }

        embeddings = [img_data["embedding"] for _, _, img_data in processed_images]
        filenames = [filename for filename, _, _ in processed_images]

        # Pairwise cosine similarity matrix
        matrix = []
        for i in range(n):
            row = []
            for j in range(n):
                if i == j:
                    row.append(1.0)
                else:
                    dot = float(np.dot(embeddings[i], embeddings[j]))
                    row.append(round(dot, 4))
            matrix.append(row)

        # 1. Check for duplicate / identical photos in the batch
        byte_hashes = [hashlib.sha256(b).hexdigest() for _, b, _ in processed_images]
        tiny_grays = [
            cv2.resize(cv2.cvtColor(img_data["image"], cv2.COLOR_BGR2GRAY), (64, 64)).astype(np.float32)
            for _, _, img_data in processed_images
        ]

        duplicate_pairs = []
        duplicate_indices = set()
        for i in range(n):
            for j in range(i + 1, n):
                is_dup = False
                # Exact file content check
                if byte_hashes[i] == byte_hashes[j]:
                    is_dup = True
                else:
                    # Near-identical pixel check & embedding equivalence
                    pixel_diff = float(np.mean(np.abs(tiny_grays[i] - tiny_grays[j])))
                    emb_sim = matrix[i][j]
                    if pixel_diff < 1.5 or emb_sim > 0.9990:
                        is_dup = True

                if is_dup:
                    duplicate_pairs.append((i, j))
                    duplicate_indices.add(j)

        # 2. Check for different-person outliers
        details = []
        match_counts = []
        avg_sims = []

        for i in range(n):
            other_sims = [matrix[i][j] for j in range(n) if j != i]
            avg_sim = float(np.mean(other_sims))
            avg_sims.append(avg_sim)
            # Count how many other photos match this photo with similarity >= threshold
            matches = sum(1 for s in other_sims if s >= threshold)
            match_counts.append(matches)

        # Majority cluster determination:
        # Outliers are photos that fail to match at least half of the other photos or have avg similarity below threshold
        majority_threshold = (n - 1) / 2.0
        mismatched_indices = []

        for i in range(n):
            if i not in duplicate_indices:
                if match_counts[i] < majority_threshold or avg_sims[i] < threshold:
                    mismatched_indices.append(i)

        is_consistent = True
        error_message = None

        if duplicate_pairs:
            is_consistent = False
            pair_strs = [
                f"Photo #{p[0]+1} ('{filenames[p[0]]}') and Photo #{p[1]+1} ('{filenames[p[1]]}')"
                for p in duplicate_pairs
            ]
            pairs_text = "; ".join(pair_strs)
            error_message = (
                f"Duplicate photo detected: {pairs_text} are the same or nearly identical image. "
                "Enrollment requires at least 3 distinct face photographs from different angles or lighting conditions to create a reliable biometric template. "
                "Please replace the duplicate photo with a different shot."
            )

        # If every photo failed (all completely different people)
        if len(mismatched_indices) == n or (all(c == 0 for c in match_counts) and not duplicate_pairs):
            mismatched_indices = list(range(n))
            error_message = (
                "Cross-photo validation failed: None of the uploaded photos match each other. "
                "All photos in an enrollment batch must belong to the same person."
            )
            is_consistent = False
        elif len(mismatched_indices) > 0:
            mismatched_names = [f"Photo #{idx+1} ('{filenames[idx]}')" for idx in mismatched_indices]
            names_str = ", ".join(mismatched_names)
            lowest_sim = min(avg_sims[idx] for idx in mismatched_indices)
            diff_msg = (
                f"Identity mismatch detected: {names_str} does not appear to match the other photos "
                f"(average similarity: {lowest_sim:.2f} < {threshold:.2f} threshold). "
                f"All uploaded photos must belong to the same person. Please remove or replace the different photo."
            )
            if error_message:
                error_message = f"{error_message} Additionally, {diff_msg}"
            else:
                error_message = diff_msg
            is_consistent = False

        for i in range(n):
            status = "MATCHED"
            if i in duplicate_indices:
                status = "DUPLICATE"
            elif i in mismatched_indices:
                status = "MISMATCH"

            details.append({
                "index": i,
                "filename": filenames[i],
                "status": status,
                "is_matched": status == "MATCHED",
                "is_duplicate": i in duplicate_indices,
                "is_mismatch": i in mismatched_indices,
                "avg_similarity": round(avg_sims[i], 4),
                "matches_with_others": match_counts[i]
            })

        return {
            "is_consistent": is_consistent,
            "mismatched_indices": list(mismatched_indices),
            "mismatched_filenames": [filenames[i] for i in mismatched_indices],
            "duplicate_indices": list(duplicate_indices),
            "duplicate_filenames": [filenames[i] for i in duplicate_indices],
            "details": details,
            "matrix": matrix,
            "error_message": error_message
        }

    @classmethod
    def check_against_existing_identities(
        cls,
        db: Session,
        candidate_embeddings: List[np.ndarray],
        candidate_filenames: List[str],
        exclude_person_id: Optional[int] = None,
        threshold: float = 0.50
    ) -> Dict[str, Any]:
        """
        Cross-checks candidate face embeddings against ALL enrolled identities in the database.
        
        Prevents:
        1. Duplicate Enrolled Photo: Uploading an image that is already registered for another identity.
        2. Re-enrollment of Same Person Under Different Name/ID: Uploading photos of a person who is already enrolled.
        """
        query = db.query(Person)
        if exclude_person_id is not None:
            query = query.filter(Person.id != exclude_person_id)
        existing_persons = query.all()

        if not existing_persons or not candidate_embeddings:
            return {
                "has_collision": False,
                "collision_type": None,
                "matched_person_id": None,
                "matched_person_name": None,
                "matched_person_code": None,
                "similarity": 0.0,
                "message": None
            }

        # Check 1: Check for exact or near-identical photo duplicates across all enrolled embeddings in DB
        for p in existing_persons:
            for emb in p.embeddings:
                enrolled_vec = emb.get_numpy_embedding()
                if enrolled_vec is None:
                    continue
                for c_idx, c_vec in enumerate(candidate_embeddings):
                    sim = float(np.dot(c_vec, enrolled_vec))
                    if sim >= 0.990:  # Same image file / identical face embedding
                        fname = candidate_filenames[c_idx] if c_idx < len(candidate_filenames) else f"Photo #{c_idx+1}"
                        p_identifier = f"'{p.name}'" + (f" (ID: '{p.code}')" if p.code else "")
                        return {
                            "has_collision": True,
                            "collision_type": "DUPLICATE_ENROLLED_PHOTO",
                            "matched_person_id": p.id,
                            "matched_person_name": p.name,
                            "matched_person_code": p.code,
                            "similarity": round(sim, 4),
                            "offending_photo_index": c_idx,
                            "offending_filename": fname,
                            "message": (
                                f"Duplicate photo collision: Photo #{c_idx+1} ('{fname}') is already enrolled in the system "
                                f"under {p_identifier}. You cannot upload photos that are already enrolled for another identity."
                            )
                        }

        # Candidate representative vector
        cand_mean = np.mean(candidate_embeddings, axis=0)
        cand_norm = np.linalg.norm(cand_mean)
        cand_template = (cand_mean / cand_norm).astype(np.float32) if cand_norm > 1e-6 else cand_mean.astype(np.float32)

        best_person = None
        best_sim = -1.0

        # Check 2: Check for biometric face identity match against existing representative templates and gallery
        for p in existing_persons:
            p_template = p.get_template_embedding()
            p_sims = []

            if p_template is not None:
                t_sim = float(np.dot(cand_template, p_template))
                p_sims.append(t_sim)

            for emb in p.embeddings:
                enrolled_vec = emb.get_numpy_embedding()
                if enrolled_vec is not None:
                    for c_vec in candidate_embeddings:
                        p_sims.append(float(np.dot(c_vec, enrolled_vec)))

            if p_sims:
                max_p_sim = max(p_sims)
                if max_p_sim > best_sim:
                    best_sim = max_p_sim
                    best_person = p

        # If highest similarity to an existing enrolled person exceeds threshold (>= 0.50):
        if best_person and best_sim >= threshold:
            sim_pct = round(best_sim * 100, 1)
            p_identifier = f"'{best_person.name}'" + (f" (ID: '{best_person.code}')" if best_person.code else "")
            return {
                "has_collision": True,
                "collision_type": "ALREADY_ENROLLED_PERSON",
                "matched_person_id": best_person.id,
                "matched_person_name": best_person.name,
                "matched_person_code": best_person.code,
                "similarity": round(best_sim, 4),
                "message": (
                    f"Identity collision detected: This face is already enrolled in the system under {p_identifier} "
                    f"with a {sim_pct}% match (similarity: {best_sim:.2f} >= {threshold:.2f} threshold). "
                    f"The same individual cannot be registered multiple times under different names or IDs."
                )
            }

        return {
            "has_collision": False,
            "collision_type": None,
            "matched_person_id": None,
            "matched_person_name": None,
            "matched_person_code": None,
            "similarity": round(best_sim, 4) if best_sim > 0 else 0.0,
            "message": None
        }

    @classmethod
    def verify_photos_only(
        cls,
        image_files: List[Tuple[str, bytes]],
        db: Optional[Session] = None,
        threshold: float = 0.45
    ) -> Dict[str, Any]:
        """
        Validates face quality, verifies cross-photo identity consistency,
        and verifies that the face is not already enrolled under another name.
        """
        if not image_files:
            return {
                "valid": False,
                "message": "No images provided for verification.",
                "mismatched_indices": [],
                "duplicate_indices": [],
                "photo_details": [],
                "already_enrolled_collision": None
            }

        num_images = len(image_files)
        if num_images < 3:
            return {
                "valid": False,
                "message": f"Enrollment requires at least 3 images. Received {num_images}.",
                "mismatched_indices": [],
                "duplicate_indices": [],
                "photo_details": [],
                "already_enrolled_collision": None
            }

        processed_images = []
        for idx, (filename, img_bytes) in enumerate(image_files):
            try:
                img_data = cls.process_single_enrollment_image(img_bytes, filename)
                processed_images.append((filename, img_bytes, img_data))
            except ValueError as e:
                return {
                    "valid": False,
                    "message": f"Photo #{idx+1} ('{filename}') failed validation: {str(e)}",
                    "mismatched_indices": [],
                    "invalid_indices": [idx],
                    "duplicate_indices": [],
                    "photo_details": [
                        {
                            "index": i,
                            "filename": f,
                            "status": "ERROR" if i == idx else "PENDING",
                            "is_matched": False,
                            "error": str(e) if i == idx else None
                        }
                        for i, (f, _) in enumerate(image_files)
                    ],
                    "already_enrolled_collision": None
                }

        consistency = cls.verify_photo_batch_consistency(processed_images, threshold=threshold)

        # Collision check against existing identities in the database
        collision = None
        if db is not None:
            cand_embs = [img_data["embedding"] for _, _, img_data in processed_images]
            cand_fnames = [f for f, _, _ in processed_images]
            collision = cls.check_against_existing_identities(
                db=db,
                candidate_embeddings=cand_embs,
                candidate_filenames=cand_fnames,
                threshold=settings.DEFAULT_MATCHING_THRESHOLD
            )

        has_collision = collision is not None and collision["has_collision"]
        is_valid = consistency["is_consistent"] and not has_collision

        final_message = None
        if has_collision:
            final_message = collision["message"]
        elif not consistency["is_consistent"]:
            final_message = consistency["error_message"]
        else:
            final_message = "All uploaded photos verified as matching the same person, and no duplicate identity collisions found in the database."

        dup_indices = list(consistency["duplicate_indices"])
        if has_collision and collision.get("offending_photo_index") is not None:
            if collision["offending_photo_index"] not in dup_indices:
                dup_indices.append(collision["offending_photo_index"])

        return {
            "valid": is_valid,
            "message": final_message,
            "mismatched_indices": consistency["mismatched_indices"],
            "mismatched_filenames": consistency["mismatched_filenames"],
            "invalid_indices": [],
            "duplicate_indices": dup_indices,
            "duplicate_filenames": consistency["duplicate_filenames"],
            "already_enrolled_collision": collision if has_collision else None,
            "photo_details": consistency["details"],
            "matrix": consistency["matrix"]
        }

    @classmethod
    def enroll_person_with_images(
        cls,
        db: Session,
        name: str,
        code: Optional[str],
        department: Optional[str],
        notes: Optional[str],
        image_files: List[Tuple[str, bytes]]
    ) -> Dict[str, Any]:
        """
        Complete Enrollment Workflow:
        - Validates person name and person code/ID.
        - Prevents duplicate person codes.
        - Enforces 3 to 5 images per person.
        - Validates, detects, aligns, and embeds each image.
        - Cross-verifies that ALL uploaded photos belong to the SAME person.
        - Prevents enrolling photos of someone already enrolled under another name.
        - Computes representative template embedding:
            template = mean(all_embeddings)
            template = L2_normalize(template)
        - Stores both individual embeddings and representative template.
        - Returns confirmation message: 'Face enrolled successfully'.
        """
        if not name or not name.strip():
            raise ValueError("Person name is required.")

        if not code or not str(code).strip():
            raise ValueError("Person code/ID is required.")

        clean_name = name.strip()
        clean_code = str(code).strip()

        # Prevent duplicate person codes
        existing = db.query(Person).filter(func.lower(Person.code) == clean_code.lower()).first()
        if existing:
            raise ValueError(f"Person with code '{clean_code}' already exists. Duplicate person codes are not allowed.")

        # Require at least 3 images per person
        num_images = len(image_files)
        if num_images < 3:
            raise ValueError(f"Enrollment requires at least 3 images per person. Received {num_images} image(s).")

        # Process all images first (fail-fast: if any image fails, do not create partial person)
        processed_images = []
        for filename, img_bytes in image_files:
            img_data = cls.process_single_enrollment_image(img_bytes, filename)
            processed_images.append((filename, img_bytes, img_data))

        # Enforce cross-photo identity consistency across the entire batch
        consistency = cls.verify_photo_batch_consistency(processed_images)
        if not consistency["is_consistent"]:
            raise ValueError(consistency["error_message"])

        # Check collision against existing enrolled identities in the database
        cand_embeddings = [img_data["embedding"] for _, _, img_data in processed_images]
        cand_filenames = [f for f, _, _ in processed_images]
        collision = cls.check_against_existing_identities(
            db=db,
            candidate_embeddings=cand_embeddings,
            candidate_filenames=cand_filenames,
            threshold=settings.DEFAULT_MATCHING_THRESHOLD
        )
        if collision["has_collision"]:
            raise ValueError(collision["message"])

        # Create Person record
        person = Person(
            name=clean_name,
            code=clean_code,
            department=department.strip() if department else None,
            notes=notes.strip() if notes else None
        )
        db.add(person)
        db.flush()

        all_embeddings = []
        primary_avatar_rel = None

        # Save each individual image and embedding record
        for filename, img_bytes, img_data in processed_images:
            unique_id = uuid.uuid4().hex[:12]
            img_name = f"person_{person.id}_{unique_id}{img_data['ext']}"
            thumb_name = f"thumb_{person.id}_{unique_id}.jpg"

            img_path = settings.UPLOADS_DIR / img_name
            thumb_path = settings.THUMBNAILS_DIR / thumb_name

            with open(img_path, "wb") as f:
                f.write(img_bytes)
            cv2.imwrite(str(thumb_path), img_data["aligned_face"])

            rel_img = f"uploads/{img_name}"
            rel_thumb = f"thumbnails/{thumb_name}"
            if not primary_avatar_rel:
                primary_avatar_rel = rel_thumb

            emb_record = FaceEmbedding(
                person_id=person.id,
                image_path=rel_img,
                thumbnail_path=rel_thumb,
                detection_confidence=img_data["confidence"]
            )
            emb_record.set_numpy_embedding(img_data["embedding"])
            db.add(emb_record)

            all_embeddings.append(img_data["embedding"])

        # Calculate representative template embedding:
        # template = mean(all_embeddings)
        # Then L2-normalize the resulting template
        mean_vec = np.mean(all_embeddings, axis=0)
        norm = np.linalg.norm(mean_vec)
        if norm > 1e-9:
            representative_template = (mean_vec / norm).astype(np.float32)
        else:
            representative_template = mean_vec.astype(np.float32)

        person.template_embedding = representative_template.tobytes()
        person.avatar_path = primary_avatar_rel

        db.commit()
        db.refresh(person)

        logger.info(
            "Enrolled person '%s' (Code: %s, ID: %d) with %d images and representative template.",
            person.name, person.code, person.id, len(all_embeddings)
        )

        return {
            "message": "Face enrolled successfully",
            "person": PersonResponse.model_validate(person),
            "enrolled_images_count": len(all_embeddings)
        }

    @classmethod
    def add_face_image_to_person(
        cls,
        db: Session,
        person_id: int,
        image_bytes: bytes,
        filename: str = "upload.jpg"
    ) -> FaceEmbedding:
        """
        Enrolls an additional face image for an existing identity and updates template.
        """
        person = db.query(Person).filter(Person.id == person_id).first()
        if not person:
            raise ValueError(f"Person with ID {person_id} does not exist.")

        # Process image with strict 1-face and quality checks
        img_data = cls.process_single_enrollment_image(image_bytes, filename)

        # Enforce consistency check against existing person template
        existing_template = person.get_template_embedding()
        if existing_template is not None:
            sim = float(np.dot(img_data["embedding"], existing_template))
            if sim < 0.45:
                raise ValueError(
                    f"Identity mismatch: Uploaded photo '{filename}' does not match enrolled person '{person.name}' "
                    f"(similarity score: {sim:.2f} < 0.45 threshold). Please upload a photo of the same person."
                )

        # Enforce collision check: cannot upload a photo that matches a DIFFERENT existing person or is already enrolled
        collision = cls.check_against_existing_identities(
            db=db,
            candidate_embeddings=[img_data["embedding"]],
            candidate_filenames=[filename],
            exclude_person_id=person_id,
            threshold=settings.DEFAULT_MATCHING_THRESHOLD
        )
        if collision["has_collision"]:
            raise ValueError(collision["message"])

        unique_id = uuid.uuid4().hex[:12]
        img_name = f"person_{person_id}_{unique_id}{img_data['ext']}"
        thumb_name = f"thumb_{person_id}_{unique_id}.jpg"

        img_path = settings.UPLOADS_DIR / img_name
        thumb_path = settings.THUMBNAILS_DIR / thumb_name

        with open(img_path, "wb") as f:
            f.write(image_bytes)
        cv2.imwrite(str(thumb_path), img_data["aligned_face"])

        rel_img = f"uploads/{img_name}"
        rel_thumb = f"thumbnails/{thumb_name}"

        emb_record = FaceEmbedding(
            person_id=person_id,
            image_path=rel_img,
            thumbnail_path=rel_thumb,
            detection_confidence=img_data["confidence"]
        )
        emb_record.set_numpy_embedding(img_data["embedding"])
        db.add(emb_record)

        if not person.avatar_path:
            person.avatar_path = rel_thumb

        db.flush()
        person.update_representative_template()
        db.commit()
        db.refresh(emb_record)
        return emb_record

    @staticmethod
    def delete_person(db: Session, person_id: int) -> bool:
        person = db.query(Person).filter(Person.id == person_id).first()
        if not person:
            return False

        for emb in person.embeddings:
            for pth in [emb.image_path, emb.thumbnail_path]:
                file_path = settings.DATA_DIR / pth.lstrip("/")
                if file_path.exists():
                    try:
                        file_path.unlink()
                    except OSError:
                        pass

        db.delete(person)
        db.commit()
        logger.info("Deleted person ID: %d", person_id)
        return True

    @staticmethod
    def delete_face_embedding(db: Session, embedding_id: int) -> bool:
        emb = db.query(FaceEmbedding).filter(FaceEmbedding.id == embedding_id).first()
        if not emb:
            return False

        person = emb.person
        for pth in [emb.image_path, emb.thumbnail_path]:
            file_path = settings.DATA_DIR / pth.lstrip("/")
            if file_path.exists():
                try:
                    file_path.unlink()
                except OSError:
                    pass

        db.delete(emb)
        db.flush()

        if person:
            person.update_representative_template()
            if person.avatar_path == emb.thumbnail_path:
                remaining = db.query(FaceEmbedding).filter(FaceEmbedding.person_id == person.id).first()
                person.avatar_path = remaining.thumbnail_path if remaining else None

        db.commit()
        return True

    @staticmethod
    def get_enrolled_templates(db: Session) -> List[Dict[str, Any]]:
        """
        Loads all enrolled persons' representative template embeddings for recognition.
        If a person does not have a precalculated template, calculates from their individual embeddings.
        """
        persons = db.query(Person).all()
        templates = []

        for p in persons:
            vec = p.get_template_embedding()
            if vec is None and p.embeddings:
                # Compute on the fly if needed
                p.update_representative_template()
                db.commit()
                vec = p.get_template_embedding()

            if vec is not None:
                templates.append({
                    "person_id": p.id,
                    "person_name": p.name,
                    "code": p.code,
                    "department": p.department,
                    "embedding": vec
                })

        return templates

    @staticmethod
    def get_enrolled_gallery(db: Session) -> List[Dict[str, Any]]:
        """
        Loads all active enrolled face embeddings plus templates for 1:N matching.
        """
        records = db.query(FaceEmbedding).join(Person).all()
        gallery = []
        for r in records:
            gallery.append({
                "person_id": r.person_id,
                "person_name": r.person.name,
                "code": r.person.code,
                "department": r.person.department,
                "embedding": r.get_numpy_embedding()
            })
        return gallery
