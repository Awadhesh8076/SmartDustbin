import io
from fastapi.testclient import TestClient
from app.main import app

def test_file_upload_security_disguised_file():
    with TestClient(app) as client:
        # A file with content-type image/jpeg but contents of an executable shell script
        fake_jpeg = b"#!/bin/bash\necho 'malicious payload'"
        res = client.post(
            "/api/detection/scan",
            files={"file": ("exploit.jpg", fake_jpeg, "image/jpeg")},
            data={"source": "UPLOAD"}
        )
        assert res.status_code == 400
        assert "Invalid image payload" in res.json()["detail"]

def test_file_upload_security_oversized_file():
    with TestClient(app) as client:
        # An image header followed by > 10MB of zeros
        oversized = b"\xff\xd8\xff\xe0" + b"\x00" * (10 * 1024 * 1024 + 50)
        res = client.post(
            "/api/detection/scan",
            files={"file": ("huge.jpg", oversized, "image/jpeg")},
            data={"source": "UPLOAD"}
        )
        assert res.status_code == 400
        assert "exceeds maximum limit" in res.json()["detail"]

def test_invalid_mode_switch_rejected():
    with TestClient(app) as client:
        res = client.post(
            "/api/devices/mode",
            json={"mode": "INVALID_MODE"}
        )
        assert res.status_code == 400
        assert "Must be SIMULATION or REAL_HARDWARE" in res.json()["detail"]

def test_claim_nonexistent_reward_returns_404():
    with TestClient(app) as client:
        res = client.post(
            "/api/rewards/claim",
            json={"reward_id": "NON_EXISTENT_R99"}
        )
        assert res.status_code == 404
        assert "not found" in res.json()["detail"]

def test_sorting_execute_empty_or_malformed_category():
    with TestClient(app) as client:
        res = client.post(
            "/api/sorting/execute",
            json={"category": ""}
        )
        assert res.status_code == 400

        res2 = client.post(
            "/api/sorting/execute",
            json={"category": "HAZARDOUS_NUCLEAR"}
        )
        assert res2.status_code == 400
