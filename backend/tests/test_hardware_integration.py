import io
import asyncio
import pytest
from unittest.mock import patch, MagicMock
from fastapi import HTTPException
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from app.services.hardware_service import hardware_service
from app.core.database import SessionLocal
from app.models.sorting import SortingCommand

def test_hardware_service_jpeg_validation():
    async def run():
        # 1. Valid JPEG (> 1KB with 0xFF 0xD8)
        from PIL import ImageDraw
        img = Image.new("RGB", (320, 240), color=(120, 200, 80))
        draw = ImageDraw.Draw(img)
        for i in range(0, 320, 10):
            draw.line([(i, 0), (320 - i, 240)], fill=(i % 255, (i * 2) % 255, 150))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=95)
        valid_jpeg = buf.getvalue()
        assert len(valid_jpeg) >= 1024
        assert valid_jpeg.startswith(b'\xff\xd8')

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.content = valid_jpeg

        with patch("httpx.AsyncClient.get", return_value=mock_resp):
            result = await hardware_service.capture_frame_from_cam("192.168.4.10", timeout=3.0)
            assert result == valid_jpeg

        # 2. Invalid header (not JPEG)
        mock_resp_bad = MagicMock()
        mock_resp_bad.status_code = 200
        mock_resp_bad.content = b'GIF89a' + b'\x00' * 2000

        with patch("httpx.AsyncClient.get", return_value=mock_resp_bad):
            with pytest.raises(HTTPException) as exc_info:
                await hardware_service.capture_frame_from_cam("192.168.4.10", timeout=3.0)
            assert exc_info.value.status_code == 502
            assert "Missing JPEG header" in exc_info.value.detail

        # 3. Truncated buffer (< 1KB)
        mock_resp_trunc = MagicMock()
        mock_resp_trunc.status_code = 200
        mock_resp_trunc.content = b'\xff\xd8' + b'\x00' * 100

        with patch("httpx.AsyncClient.get", return_value=mock_resp_trunc):
            with pytest.raises(HTTPException) as exc_info:
                await hardware_service.capture_frame_from_cam("192.168.4.10", timeout=3.0)
            assert exc_info.value.status_code == 502
            assert "truncated image buffer" in exc_info.value.detail

    asyncio.run(run())

def test_devkit_sort_busy_429_handling():
    async def run():
        mock_busy_resp = MagicMock()
        mock_busy_resp.status_code = 429
        mock_busy_resp.json.return_value = {
            "status": "BUSY",
            "message": "Sorter is currently executing another cycle."
        }

        with patch("httpx.AsyncClient.get", return_value=mock_busy_resp):
            success, msg, data = await hardware_service.dispatch_devkit_sort("192.168.4.20", "PLASTIC", timeout=5.0)
            assert success is False
            assert "busy" in msg.lower()
            assert data["status"] == "BUSY"

    asyncio.run(run())

def test_device_ping_api_simulation_and_real():
    with TestClient(app) as client:
        # Simulation Mode ping
        res_sim = client.post(
            "/api/devices/test-connection",
            json={"device": "CAM", "ip": "192.168.4.10"}
        )
        assert res_sim.status_code == 200
        assert res_sim.json()["online"] is True
        assert "Simulation Mode" in res_sim.json()["status_message"]

def test_real_hardware_sorting_states_and_rewards():
    with TestClient(app) as client:
        # 1. Test Mocked Real Hardware SUCCESS
        mock_success_resp = MagicMock()
        mock_success_resp.status_code = 200
        mock_success_resp.json.return_value = {
            "status": "SUCCESS",
            "waste": "METAL",
            "message": "Sorted successfully"
        }

        with patch("httpx.AsyncClient.get", return_value=mock_success_resp):
            res = client.post(
                "/api/sorting/execute",
                json={"category": "METAL", "mode_override": "REAL_HARDWARE"}
            )
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "SUCCESS"
            assert data["mode"] == "REAL_HARDWARE"
            assert data["coins_earned"] == 5
            cmd_id = data["command_id"]

            # Verify command record in SQLite
            cmd_details = client.get(f"/api/sorting/commands/{cmd_id}").json()
            assert cmd_details["status"] == "SUCCESS"
            assert cmd_details["mode"] == "REAL_HARDWARE"

        # 2. Test Mocked Real Hardware BUSY 429
        mock_busy_resp = MagicMock()
        mock_busy_resp.status_code = 429
        mock_busy_resp.json.return_value = {
            "status": "BUSY",
            "message": "Sorter is currently executing another cycle."
        }

        with patch("httpx.AsyncClient.get", return_value=mock_busy_resp):
            res_busy = client.post(
                "/api/sorting/execute",
                json={"category": "PLASTIC", "mode_override": "REAL_HARDWARE"}
            )
            assert res_busy.status_code == 429
            assert "busy" in res_busy.json()["detail"].lower()

        # 3. Test Mocked Real Hardware TIMEOUT -> Command status must be UNKNOWN
        import httpx
        with patch("httpx.AsyncClient.get", side_effect=httpx.TimeoutException("Timeout")):
            res_timeout = client.post(
                "/api/sorting/execute",
                json={"category": "WET", "mode_override": "REAL_HARDWARE"}
            )
            assert res_timeout.status_code == 504
            assert "UNKNOWN" in res_timeout.json()["detail"]

            # Verify in DB that the latest command was set to UNKNOWN
            db = SessionLocal()
            try:
                latest_cmd = db.query(SortingCommand).filter(
                    SortingCommand.requested_category == "WET",
                    SortingCommand.mode == "REAL_HARDWARE"
                ).order_by(SortingCommand.sent_at.desc()).first()
                assert latest_cmd is not None
                assert latest_cmd.status == "UNKNOWN"
            finally:
                db.close()
