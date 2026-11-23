from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.core.database import init_db, SessionLocal
from app.models import DeviceConfiguration
from app.ai.memory_store import memory_store
from app.api import (
    health_router,
    devices_router,
    settings_router,
    detection_router,
    learning_router,
    sorting_router,
    rewards_router,
    dashboard_router
)

# Ensure tables are created on load
init_db()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables exist
    init_db()
    
    # Initialize default device configuration and sync AI memory
    db = SessionLocal()
    try:
        config = db.query(DeviceConfiguration).filter(DeviceConfiguration.id == "default").first()
        if not config:
            config = DeviceConfiguration(
                id="default",
                esp32_cam_ip=settings.DEFAULT_ESP32_CAM_IP,
                esp32_devkit_ip=settings.DEFAULT_ESP32_DEVKIT_IP,
                active_mode=settings.DEFAULT_MODE,
                cam_status="SIMULATED",
                devkit_status="SIMULATED"
            )
            db.add(config)
            db.commit()

        # Synchronize AI memory centroids and exemplars from SQLite records
        memory_store.sync_with_db(db)
    finally:
        db.close()
        
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend API for SmartDustbin AI waste classification, IoT actuation, rewards, and simulation.",
    lifespan=lifespan
)

# Enable CORS for React frontend (Vite default port 5173, plus flexible localhost origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for stored scans and dataset
app.mount("/api/static", StaticFiles(directory=str(settings.STORAGE_DIR)), name="static")

# Register routers
app.include_router(health_router, prefix=settings.API_PREFIX)
app.include_router(devices_router, prefix=settings.API_PREFIX)
app.include_router(settings_router, prefix=settings.API_PREFIX)
app.include_router(detection_router, prefix=settings.API_PREFIX)
app.include_router(learning_router, prefix=settings.API_PREFIX)
app.include_router(sorting_router, prefix=settings.API_PREFIX)
app.include_router(rewards_router, prefix=settings.API_PREFIX)
app.include_router(dashboard_router, prefix=settings.API_PREFIX)

@app.get("/")
def root():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "health": f"{settings.API_PREFIX}/health",
        "docs": "/docs"
    }
