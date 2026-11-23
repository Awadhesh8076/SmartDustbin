from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.config import settings
from app.core.database import get_db
from app.schemas.health import HealthResponse
from app.models.device import DeviceConfiguration

router = APIRouter(prefix="", tags=["Health"])

@router.get("/health", response_model=HealthResponse)
def check_health(db: Session = Depends(get_db)):
    # Test DB connectivity
    db_status = "connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    # Check device config
    config = db.query(DeviceConfiguration).filter(DeviceConfiguration.id == "default").first()
    active_mode = config.active_mode if config else settings.DEFAULT_MODE
    
    storage_ready = all([
        settings.SCANS_DIR.exists(),
        settings.DATASET_DIR.exists(),
        settings.MODEL_DIR.exists()
    ])
    
    return HealthResponse(
        status="healthy" if db_status == "connected" else "degraded",
        service=settings.PROJECT_NAME,
        version=settings.VERSION,
        active_mode=active_mode,
        database=db_status,
        storage_ready=storage_ready
    )
