import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_healthcheck():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "ArcFace" in data["embedder"]


def test_get_and_update_settings():
    # Get settings
    get_res = client.get("/api/settings")
    assert get_res.status_code == 200
    orig_data = get_res.json()
    assert "matching_threshold" in orig_data

    # Update threshold to 0.58
    put_res = client.put("/api/settings", json={"matching_threshold": 0.58})
    assert put_res.status_code == 200
    updated_data = put_res.json()
    assert updated_data["matching_threshold"] == 0.58

    # Restore to default 0.50
    client.put("/api/settings", json={"matching_threshold": 0.50})


def test_person_crud():
    # Create person
    create_res = client.post("/api/persons", json={
        "name": "Test Person",
        "department": "QA",
        "notes": "Automated test subject"
    })
    assert create_res.status_code == 201
    person = create_res.json()
    pid = person["id"]
    assert person["name"] == "Test Person"

    # List persons
    list_res = client.get("/api/persons")
    assert list_res.status_code == 200
    persons = list_res.json()
    assert any(p["id"] == pid for p in persons)

    # Get by ID
    get_res = client.get(f"/api/persons/{pid}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Test Person"

    # Delete person
    del_res = client.delete(f"/api/persons/{pid}")
    assert del_res.status_code == 200
    assert del_res.json()["deleted"] is True


def test_evaluation_endpoint():
    res = client.post("/api/evaluate/run")
    assert res.status_code == 200
    data = res.json()
    # With an empty gallery (no enrolled persons), evaluation returns WARNING.
    # Both WARNING and SUCCESS are valid responses depending on whether data exists.
    assert data["status"] in ("SUCCESS", "WARNING"), f"Unexpected evaluation status: {data['status']}"
    assert "metrics" in data
    assert "roc_curve" in data
    assert isinstance(data["roc_curve"], list)
    # metrics is None when there is insufficient evaluation data; only check keys when present
    if data["metrics"] is not None:
        assert "eer" in data["metrics"]
