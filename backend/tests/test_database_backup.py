from fastapi.testclient import TestClient
from app.main import app
from app.core.backup_service import backup_service

def test_database_backup_and_integrity_endpoints():
    with TestClient(app) as client:
        # 1. Check integrity
        health_res = client.get("/api/settings/database-health")
        assert health_res.status_code == 200
        health_data = health_res.json()
        assert health_data["status"] == "HEALTHY"
        assert "ok" in health_data["details"]

        # 2. Create backup
        backup_res = client.post("/api/settings/backup")
        assert backup_res.status_code == 200
        backup_data = backup_res.json()
        assert backup_data["status"] == "SUCCESS"
        assert backup_data["filename"].startswith("smartdustbin_backup_")
        assert backup_data["size_bytes"] > 0

        # 3. List backups
        list_res = client.get("/api/settings/backups")
        assert list_res.status_code == 200
        all_backups = list_res.json()["backups"]
        assert len(all_backups) >= 1
        assert any(b["filename"] == backup_data["filename"] for b in all_backups)
