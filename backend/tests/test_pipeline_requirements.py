import io
import pytest
import numpy as np
import cv2
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.ml.matcher import FaceMatcher, face_matcher
from app.ml.detector import face_detector
from app.ml.embedder import face_embedder
from app.services.person_service import PersonService
from app.services.recognition_service import RecognitionService
from app.models.person import Person
from app.models.embedding import FaceEmbedding

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_db():
    """Ensure test database is clean before and after each test."""
    db = SessionLocal()
    try:
        db.query(FaceEmbedding).delete()
        db.query(Person).delete()
        db.commit()
    finally:
        db.close()
    yield
    db = SessionLocal()
    try:
        db.query(FaceEmbedding).delete()
        db.query(Person).delete()
        db.commit()
    finally:
        db.close()


def _make_dummy_image_bytes(brightness: int = 128) -> bytes:
    """
    Generates valid JPEG image bytes suitable for testing.

    The image is a mid-gray background (default brightness=128) overlaid
    with random noise so it passes the brightness AND blur pre-validation
    checks (mean_brightness >= 25 and Laplacian variance >= 20).
    Use brightness=0 only for tests that specifically test the darkness check.
    """
    rng = np.random.default_rng(seed=42)
    base = np.full((300, 300, 3), fill_value=brightness, dtype=np.int32)
    # Add ±30 noise so Laplacian variance >> 20 threshold
    noise = rng.integers(-30, 30, size=(300, 300, 3), dtype=np.int32)
    img = np.clip(base + noise, 0, 255).astype(np.uint8)
    _, buf = cv2.imencode(".jpg", img)
    return buf.tobytes()


# =====================================================================
# 1. Cosine Similarity & Threshold Logic Unit Tests
# =====================================================================

def test_cosine_similarity():
    """Unit test: Cosine similarity calculation between normalized vectors."""
    matcher = FaceMatcher()

    # Identical vectors: cosine similarity = 1.0
    v1 = np.random.randn(512).astype(np.float32)
    v1 = v1 / np.linalg.norm(v1)
    assert np.isclose(matcher.cosine_similarity(v1, v1), 1.0, atol=1e-5)

    # Orthogonal vectors: cosine similarity = 0.0
    v_ortho1 = np.zeros(512, dtype=np.float32)
    v_ortho1[0] = 1.0
    v_ortho2 = np.zeros(512, dtype=np.float32)
    v_ortho2[1] = 1.0
    assert np.isclose(matcher.cosine_similarity(v_ortho1, v_ortho2), 0.0, atol=1e-5)

    # Opposite vectors: cosine similarity = -1.0
    assert np.isclose(matcher.cosine_similarity(v1, -v1), -1.0, atol=1e-5)


def test_threshold_logic():
    """Unit test: Configurable threshold logic and boundary decisions."""
    matcher = FaceMatcher()
    target_emb = np.zeros(512, dtype=np.float32)
    target_emb[0] = 1.0

    gallery = [
        {"person_id": 1, "person_name": "Bob", "department": "Tech", "embedding": target_emb}
    ]

    # Query with cosine similarity = 0.55
    query_emb = np.zeros(512, dtype=np.float32)
    query_emb[0] = 0.55
    query_emb[1] = np.sqrt(1 - 0.55**2)

    # With threshold = 0.50 -> MATCH (KNOWN)
    res_low = matcher.find_best_match(query_emb, gallery, threshold=0.50)
    assert res_low["matched"] is True
    assert res_low["status"] == "KNOWN"
    assert res_low["person_id"] == 1
    assert np.isclose(res_low["similarity"], 0.55, atol=1e-3)

    # With threshold = 0.60 -> REJECTED (UNKNOWN)
    res_high = matcher.find_best_match(query_emb, gallery, threshold=0.60)
    assert res_high["matched"] is False
    assert res_high["status"] == "UNKNOWN"
    assert res_high["person_id"] is None


# =====================================================================
# 2. Unknown-Person Rejection Mechanism (Exact Example from Prompt)
# =====================================================================

def test_unknown_rejection_exact_example():
    """
    Test exact prompt requirement:
    Rahul = 0.48, Arjun = 0.44, Priya = 0.39, threshold = 0.60.
    Result must be UNKNOWN, not Rahul.
    Return:
    {
        "status": "UNKNOWN",
        "person": null,
        "similarity": 0.48,
        "threshold": 0.60
    }
    """
    matcher = FaceMatcher(default_threshold=0.60)

    # Construct orthogonal bases to generate exact similarity values
    # e_q = (1, 0, 0, 0, ...)
    # e_rahul = (0.48, sqrt(1-0.48^2), 0, ...) -> dot(e_q, e_rahul) = 0.48
    # e_arjun = (0.44, 0, sqrt(1-0.44^2), ...) -> dot(e_q, e_arjun) = 0.44
    # e_priya = (0.39, 0, 0, sqrt(1-0.39^2), ...) -> dot(e_q, e_priya) = 0.39

    query_emb = np.zeros(512, dtype=np.float32)
    query_emb[0] = 1.0

    e_rahul = np.zeros(512, dtype=np.float32)
    e_rahul[0] = 0.48
    e_rahul[1] = np.sqrt(1.0 - 0.48**2)

    e_arjun = np.zeros(512, dtype=np.float32)
    e_arjun[0] = 0.44
    e_arjun[2] = np.sqrt(1.0 - 0.44**2)

    e_priya = np.zeros(512, dtype=np.float32)
    e_priya[0] = 0.39
    e_priya[3] = np.sqrt(1.0 - 0.39**2)

    gallery = [
        {"person_id": 101, "person_name": "Rahul", "embedding": e_rahul},
        {"person_id": 102, "person_name": "Arjun", "embedding": e_arjun},
        {"person_id": 103, "person_name": "Priya", "embedding": e_priya},
    ]

    result = matcher.find_best_match(query_emb, gallery, threshold=0.60)

    # Assertions on exact prompt specifications
    assert result["status"] == "UNKNOWN", "Result must be UNKNOWN"
    assert result["person_id"] is None, "Person ID must be None (null), NOT Rahul"
    assert np.isclose(result["similarity"], 0.48, atol=1e-3), "Similarity must be 0.48"
    assert result["threshold"] == 0.60, "Threshold must be 0.60"
    assert result["matched"] is False


def test_known_person_exact_example():
    """
    Test known person recognition:
    Similarity = 0.82, threshold = 0.60.
    Result must be KNOWN with person details.
    """
    matcher = FaceMatcher(default_threshold=0.60)

    query_emb = np.zeros(512, dtype=np.float32)
    query_emb[0] = 1.0

    e_rahul = np.zeros(512, dtype=np.float32)
    e_rahul[0] = 0.82
    e_rahul[1] = np.sqrt(1.0 - 0.82**2)

    gallery = [
        {"person_id": 101, "person_name": "Rahul", "department": "Tech", "embedding": e_rahul},
    ]

    result = matcher.find_best_match(query_emb, gallery, threshold=0.60)

    assert result["status"] == "KNOWN"
    assert result["person_id"] == 101
    assert result["person_name"] == "Rahul"
    assert np.isclose(result["similarity"], 0.82, atol=1e-3)
    assert result["threshold"] == 0.60
    assert result["matched"] is True


# =====================================================================
# 3. Enrollment Failure Case Tests
# =====================================================================

def test_enrollment_failure_missing_name():
    """Failure case: Missing person name raises ValueError."""
    db = SessionLocal()
    try:
        images = [("f1.jpg", _make_dummy_image_bytes()), ("f2.jpg", _make_dummy_image_bytes()), ("f3.jpg", _make_dummy_image_bytes())]
        with pytest.raises(ValueError, match="Person name is required"):
            PersonService.enroll_person_with_images(db, name="", code="P-01", department=None, notes=None, image_files=images)
    finally:
        db.close()


def test_enrollment_failure_missing_code():
    """Failure case: Missing person code raises ValueError."""
    db = SessionLocal()
    try:
        images = [("f1.jpg", _make_dummy_image_bytes()), ("f2.jpg", _make_dummy_image_bytes()), ("f3.jpg", _make_dummy_image_bytes())]
        with pytest.raises(ValueError, match="Person code/ID is required"):
            PersonService.enroll_person_with_images(db, name="Alex", code="", department=None, notes=None, image_files=images)
    finally:
        db.close()


def test_enrollment_failure_duplicate_code(monkeypatch):
    """Failure case: Duplicate person code is strictly prevented."""
    db = SessionLocal()
    try:
        # Pre-seed existing person
        p = Person(name="Original Person", code="EMP-007")
        db.add(p)
        db.commit()

        images = [("f1.jpg", _make_dummy_image_bytes()), ("f2.jpg", _make_dummy_image_bytes()), ("f3.jpg", _make_dummy_image_bytes())]
        with pytest.raises(ValueError, match="Duplicate person codes are not allowed"):
            PersonService.enroll_person_with_images(db, name="Duplicate Person", code="EMP-007", department=None, notes=None, image_files=images)
    finally:
        db.close()


def test_enrollment_failure_too_few_images():
    """Failure case: Fewer than 3 images rejected."""
    db = SessionLocal()
    try:
        images = [("f1.jpg", _make_dummy_image_bytes()), ("f2.jpg", _make_dummy_image_bytes())]  # Only 2 images
        with pytest.raises(ValueError, match="Enrollment requires between 3 and 5 images per person"):
            PersonService.enroll_person_with_images(db, name="Alex", code="P-02", department=None, notes=None, image_files=images)
    finally:
        db.close()


def test_enrollment_failure_too_many_images():
    """Failure case: More than 5 images rejected."""
    db = SessionLocal()
    try:
        images = [("f.jpg", _make_dummy_image_bytes()) for _ in range(6)]  # 6 images
        with pytest.raises(ValueError, match="Enrollment requires between 3 and 5 images per person"):
            PersonService.enroll_person_with_images(db, name="Alex", code="P-03", department=None, notes=None, image_files=images)
    finally:
        db.close()


def test_enrollment_failure_invalid_file_type():
    """Failure case: Unsupported file format returns 'Image could not be processed'."""
    with pytest.raises(ValueError, match="Image could not be processed"):
        PersonService.validate_and_decode_image(b"some bytes", "document.pdf")


def test_enrollment_failure_undecodable_image():
    """Failure case: Corrupted image bytes returns 'Image could not be processed'."""
    with pytest.raises(ValueError, match="Image could not be processed"):
        PersonService.validate_and_decode_image(b"CORRUPTED_NON_IMAGE_DATA_BYTES", "photo.jpg")


def test_enrollment_failure_no_face_detected():
    """Failure case: Zero faces detected returns 'No face detected.'"""
    blank_bytes = _make_dummy_image_bytes()
    with pytest.raises(ValueError, match="No face detected"):
        PersonService.process_single_enrollment_image(blank_bytes, "blank.jpg")


def test_enrollment_failure_multiple_faces(monkeypatch):
    """Failure case: Multiple faces returns 'Multiple faces detected. Please upload an image containing only one face.'"""
    blank_bytes = _make_dummy_image_bytes()

    fake_faces = [
        {"bbox": [10, 10, 80, 80], "landmarks": np.zeros((5, 2)), "det_score": 0.95, "raw_face": None},
        {"bbox": [120, 10, 190, 80], "landmarks": np.zeros((5, 2)), "det_score": 0.92, "raw_face": None},
    ]
    monkeypatch.setattr(face_detector, "detect_faces", lambda img, **kw: fake_faces)

    with pytest.raises(ValueError, match="Multiple faces detected. Please upload an image containing only one face"):
        PersonService.process_single_enrollment_image(blank_bytes, "group.jpg")


def test_enrollment_failure_low_quality_face(monkeypatch):
    """Failure case: Tiny face / low score returns 'Face quality is too low.'"""
    blank_bytes = _make_dummy_image_bytes()

    # Bounding box is only 20x20 pixels (below the 40x40 threshold)
    low_res_face = [
        {"bbox": [10, 10, 30, 30], "landmarks": np.zeros((5, 2)), "det_score": 0.40, "raw_face": None}
    ]
    monkeypatch.setattr(face_detector, "detect_faces", lambda img, **kw: low_res_face)

    with pytest.raises(ValueError, match="Face quality is too low"):
        PersonService.process_single_enrollment_image(blank_bytes, "blurry.jpg")


# =====================================================================
# 4. Successful Enrollment Workflow & Representative Template Tests
# =====================================================================

def test_successful_enrollment_workflow(monkeypatch):
    """
    Workflow test:
    - User enters: Person name, Person code/ID, 3 to 5 images.
    - Each image validates, extracts embedding, L2-normalizes, stores embedding & metadata.
    - Generates representative template:
        template = mean(all_embeddings)
        template = L2_normalize(template)
    - Stores both individual embeddings and representative template.
    - Returns 'Face enrolled successfully'.
    """
    img_bytes = _make_dummy_image_bytes(brightness=128)
    blank_112 = np.full((112, 112, 3), fill_value=128, dtype=np.uint8)

    fake_face = [{"bbox": [20, 20, 120, 120], "landmarks": np.zeros((5, 2)), "det_score": 0.98, "raw_face": None}]
    monkeypatch.setattr(face_detector, "detect_faces", lambda img, **kw: fake_face)

    # 3 distinct normalized embeddings for 3 photos
    emb1 = np.zeros(512, dtype=np.float32); emb1[0] = 1.0
    emb2 = np.zeros(512, dtype=np.float32); emb2[1] = 1.0
    emb3 = np.zeros(512, dtype=np.float32); emb3[2] = 1.0
    embeddings_cycle = [emb1, emb2, emb3]
    emb_idx = [0]

    def fake_generate_embedding(image, landmarks, raw_face):
        vec = embeddings_cycle[emb_idx[0] % len(embeddings_cycle)]
        emb_idx[0] += 1
        return (blank_112, vec)

    monkeypatch.setattr(face_embedder, "generate_embedding", fake_generate_embedding)

    db = SessionLocal()
    try:
        images = [("photo1.jpg", img_bytes), ("photo2.jpg", img_bytes), ("photo3.jpg", img_bytes)]
        result = PersonService.enroll_person_with_images(
            db=db,
            name="Tony Stark",
            code="TS-001",
            department="Engineering",
            notes="Iron Man",
            image_files=images
        )

        assert result["message"] == "Face enrolled successfully"
        assert result["enrolled_images_count"] == 3

        # Verify Person in DB
        person = db.query(Person).filter(Person.code == "TS-001").first()
        assert person is not None
        assert person.name == "Tony Stark"

        # Verify individual embeddings
        assert len(person.embeddings) == 3
        for emb_rec in person.embeddings:
            vec = emb_rec.get_numpy_embedding()
            assert len(vec) == 512
            assert np.isclose(np.linalg.norm(vec), 1.0, atol=1e-5)

        # Verify representative template:
        # template = mean(emb1, emb2, emb3) = (1/3, 1/3, 1/3, 0, ...)
        # L2-normalized: (1/sqrt(3), 1/sqrt(3), 1/sqrt(3), 0, ...)
        expected_mean = np.mean([emb1, emb2, emb3], axis=0)
        expected_template = expected_mean / np.linalg.norm(expected_mean)

        actual_template = person.get_template_embedding()
        assert actual_template is not None
        assert np.isclose(np.linalg.norm(actual_template), 1.0, atol=1e-5)
        assert np.allclose(actual_template, expected_template, atol=1e-4)
    finally:
        db.close()


# =====================================================================
# 5. End-to-End Recognition Service & API Endpoints
# =====================================================================

def test_recognition_service_pipeline(monkeypatch):
    """Test full RecognitionService.identify_faces with template matching."""
    img_bytes = _make_dummy_image_bytes(brightness=128)
    blank_112 = np.full((112, 112, 3), fill_value=128, dtype=np.uint8)

    db = SessionLocal()
    try:
        # Enrolled person with template
        p = Person(name="Peter Parker", code="PP-101", department="Photography")
        p_template = np.zeros(512, dtype=np.float32)
        p_template[10] = 1.0
        p.template_embedding = p_template.tobytes()
        db.add(p)
        db.commit()

        # Case 1: Query image detects face with matching embedding (similarity = 1.0 >= 0.60) -> KNOWN
        fake_face = [{"bbox": [15, 15, 95, 95], "landmarks": np.zeros((5, 2)), "det_score": 0.98, "raw_face": None}]
        monkeypatch.setattr(face_detector, "detect_faces", lambda img, **kw: fake_face)
        monkeypatch.setattr(face_embedder, "generate_embedding", lambda image, landmarks=None, raw_face=None, **kw: (blank_112, p_template))

        resp_known = RecognitionService.identify_faces(db, img_bytes, threshold_override=0.60)
        assert resp_known.status == "KNOWN"
        assert resp_known.person is not None
        assert resp_known.person.name == "Peter Parker"
        assert resp_known.person.id == p.id
        assert np.isclose(resp_known.similarity, 1.0, atol=1e-3)
        assert resp_known.threshold == 0.60

        # Case 2: Query image detects unknown face with similarity 0.45 < 0.60 -> UNKNOWN
        unknown_emb = np.zeros(512, dtype=np.float32)
        unknown_emb[10] = 0.45
        unknown_emb[11] = np.sqrt(1.0 - 0.45**2)
        monkeypatch.setattr(face_embedder, "generate_embedding", lambda image, landmarks=None, raw_face=None, **kw: (blank_112, unknown_emb))

        resp_unknown = RecognitionService.identify_faces(db, img_bytes, threshold_override=0.60)
        assert resp_unknown.status == "UNKNOWN"
        assert resp_unknown.person is None
        assert np.isclose(resp_unknown.similarity, 0.45, atol=1e-3)
        assert resp_unknown.threshold == 0.60

        # Case 3: Zero faces detected -> UNKNOWN with person=null
        monkeypatch.setattr(face_detector, "detect_faces", lambda img, **kw: [])
        resp_noface = RecognitionService.identify_faces(db, img_bytes, threshold_override=0.60)
        assert resp_noface.status == "UNKNOWN"
        assert resp_noface.person is None
        assert resp_noface.total_faces_detected == 0
        assert resp_noface.similarity == 0.0
    finally:
        db.close()


def test_api_enroll_and_recognize(monkeypatch):
    """Test FastAPI /api/enroll and /api/recognize endpoints end-to-end."""
    img_bytes = _make_dummy_image_bytes(brightness=128)
    blank_112 = np.full((112, 112, 3), fill_value=128, dtype=np.uint8)

    fake_face = [{"bbox": [20, 20, 100, 100], "landmarks": np.zeros((5, 2)), "det_score": 0.99, "raw_face": None}]
    fake_emb = np.zeros(512, dtype=np.float32)
    fake_emb[5] = 1.0
    monkeypatch.setattr(face_detector, "detect_faces", lambda img, **kw: fake_face)
    monkeypatch.setattr(face_embedder, "generate_embedding", lambda image, landmarks=None, raw_face=None, **kw: (blank_112, fake_emb))


    # 1. POST /api/enroll with 3 images
    files = [
        ("images", ("face1.jpg", io.BytesIO(img_bytes), "image/jpeg")),
        ("images", ("face2.jpg", io.BytesIO(img_bytes), "image/jpeg")),
        ("images", ("face3.jpg", io.BytesIO(img_bytes), "image/jpeg")),
    ]
    data = {
        "name": "Natasha Romanoff",
        "code": "NR-007",
        "department": "Espionage"
    }
    enroll_resp = client.post("/api/enroll", data=data, files=files)
    assert enroll_resp.status_code == 201
    enroll_json = enroll_resp.json()
    assert enroll_json["message"] == "Face enrolled successfully"
    assert enroll_json["enrolled_images_count"] == 3
    assert enroll_json["person"]["name"] == "Natasha Romanoff"

    # 2. POST /api/recognize with matching face
    recog_file = {"file": ("probe.jpg", io.BytesIO(img_bytes), "image/jpeg")}
    recog_resp = client.post("/api/recognize", files=recog_file, data={"threshold": "0.60"})
    assert recog_resp.status_code == 200
    recog_json = recog_resp.json()
    assert recog_json["status"] == "KNOWN"
    assert recog_json["person"] is not None
    assert recog_json["person"]["name"] == "Natasha Romanoff"
    assert recog_json["similarity"] >= 0.60
    assert recog_json["threshold"] == 0.60
