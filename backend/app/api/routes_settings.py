from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.models.device import DeviceConfiguration
from app.schemas.settings import SettingsUpdate, SettingsResponse
from app.api.routes_devices import get_or_create_device_config
from app.core.backup_service import backup_service

router = APIRouter(prefix="/settings", tags=["Settings"])

@router.get("", response_model=SettingsResponse)
def get_settings(db: Session = Depends(get_db)):
    config = get_or_create_device_config(db)
    return SettingsResponse(
        esp32_cam_ip=config.esp32_cam_ip,
        esp32_devkit_ip=config.esp32_devkit_ip,
        camera_timeout_seconds=config.camera_timeout_seconds,
        devkit_timeout_seconds=config.devkit_timeout_seconds,
        active_mode=config.active_mode,
        storage_path=str(settings.STORAGE_DIR),
        database_url=settings.DATABASE_URL
    )

@router.put("", response_model=SettingsResponse)
def update_settings(payload: SettingsUpdate, db: Session = Depends(get_db)):
    config = get_or_create_device_config(db)
    config.esp32_cam_ip = payload.esp32_cam_ip
    config.esp32_devkit_ip = payload.esp32_devkit_ip
    config.camera_timeout_seconds = payload.camera_timeout_seconds
    config.devkit_timeout_seconds = payload.devkit_timeout_seconds
    config.active_mode = payload.active_mode
    db.commit()
    db.refresh(config)
    
    return SettingsResponse(
        esp32_cam_ip=config.esp32_cam_ip,
        esp32_devkit_ip=config.esp32_devkit_ip,
        camera_timeout_seconds=config.camera_timeout_seconds,
        devkit_timeout_seconds=config.devkit_timeout_seconds,
        active_mode=config.active_mode,
        storage_path=str(settings.STORAGE_DIR),
        database_url=settings.DATABASE_URL
    )

@router.post("/backup")
def create_database_backup():
    """
    Creates an atomic, consistent online SQLite snapshot backup.
    """
    return backup_service.create_backup()

@router.get("/backups")
def list_database_backups():
    """
    Lists all available database backup files.
    """
    return {"backups": backup_service.list_backups()}

@router.get("/database-health")
def check_database_health():
    """
    Runs SQLite PRAGMA integrity_check.
    """
    return backup_service.verify_integrity()

