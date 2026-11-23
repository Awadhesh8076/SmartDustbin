import io
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app

def test_scan_with_valid_image():
    with TestClient(app) as client:
        img = Image.new("RGB", (100, 100), color=(50, 120, 200))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        
        res = client.post(
            "/api/detection/scan",
            files={"file": ("test.jpg", buf.getvalue(), "image/jpeg")},
            data={"source": "BROWSER_CAMERA"}
        )
        assert res.status_code == 200
        data = res.json()
        assert "detection_id" in data
        assert "category" in data
        assert "confidence" in data
        assert "probabilities" in data
        assert "image_url" in data

def test_scan_with_invalid_file_rejected():
    with TestClient(app) as client:
        res = client.post(
            "/api/detection/scan",
            files={"file": ("test.txt", b"not an image", "text/plain")},
            data={"source": "UPLOAD"}
        )
        assert res.status_code == 400

def test_teach_and_history_workflow():
    with TestClient(app) as client:
        # 1. Scan an image
        img = Image.new("RGB", (128, 128), color=(30, 200, 50))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        
        scan_res = client.post(
            "/api/detection/scan",
            files={"file": ("wet_sample.jpg", buf.getvalue(), "image/jpeg")},
            data={"source": "UPLOAD"}
        )
        assert scan_res.status_code == 200
        det_id = scan_res.json()["detection_id"]
        
        # 2. Teach category WET
        teach_res = client.post(
            "/api/learning/teach",
            json={"detection_id": det_id, "confirmed_category": "WET"}
        )
        assert teach_res.status_code == 200
        assert teach_res.json()["confirmed_category"] == "WET"
        
        # 3. Check history contains this scan
        hist_res = client.get("/api/detection/history?limit=5")
        assert hist_res.status_code == 200
        items = hist_res.json()["items"]
        assert any(item["id"] == det_id for item in items)
