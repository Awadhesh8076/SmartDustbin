import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict
from app.core.config import settings

class BackupService:
    def __init__(self):
        self.backup_dir = settings.STORAGE_DIR / "backups"
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        # Find db file path from DATABASE_URL sqlite:///path
        db_path_str = settings.DATABASE_URL.replace("sqlite:///", "")
        self.db_path = Path(db_path_str)

    def create_backup(self) -> Dict:
        """
        Safely creates a consistent SQLite backup using sqlite3.backup API.
        """
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        backup_filename = f"smartdustbin_backup_{timestamp}.db"
        backup_file = self.backup_dir / backup_filename

        if not self.db_path.exists():
            raise FileNotFoundError(f"Source database file not found at {self.db_path}")

        # Use sqlite3 online backup API to ensure transaction consistency
        src_conn = sqlite3.connect(str(self.db_path))
        dst_conn = sqlite3.connect(str(backup_file))
        try:
            with dst_conn:
                src_conn.backup(dst_conn, pages=100)
        finally:
            src_conn.close()
            dst_conn.close()

        file_size_bytes = backup_file.stat().st_size

        return {
            "status": "SUCCESS",
            "filename": backup_filename,
            "filepath": str(backup_file),
            "size_bytes": file_size_bytes,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

    def list_backups(self) -> List[Dict]:
        """
        Returns list of all available database backups.
        """
        backups = []
        for file in sorted(self.backup_dir.glob("*.db"), key=lambda f: f.stat().st_mtime, reverse=True):
            backups.append({
                "filename": file.name,
                "size_bytes": file.stat().st_size,
                "created_at": datetime.fromtimestamp(file.stat().st_mtime, timezone.utc).isoformat()
            })
        return backups

    def verify_integrity(self) -> Dict:
        """
        Executes PRAGMA integrity_check on the current SQLite database.
        """
        if not self.db_path.exists():
            return {"status": "ERROR", "message": "Database file does not exist yet."}

        conn = sqlite3.connect(str(self.db_path))
        try:
            cursor = conn.cursor()
            cursor.execute("PRAGMA integrity_check;")
            result = cursor.fetchall()
            is_ok = len(result) == 1 and result[0][0] == "ok"
            return {
                "status": "HEALTHY" if is_ok else "CORRUPTED",
                "details": [r[0] for r in result]
            }
        finally:
            conn.close()

backup_service = BackupService()
