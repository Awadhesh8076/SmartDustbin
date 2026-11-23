from app.api.routes_health import router as health_router
from app.api.routes_devices import router as devices_router
from app.api.routes_settings import router as settings_router
from app.api.routes_detection import router as detection_router
from app.api.routes_learning import router as learning_router
from app.api.routes_sorting import router as sorting_router
from app.api.routes_rewards import router as rewards_router
from app.api.routes_dashboard import router as dashboard_router

__all__ = [
    "health_router",
    "devices_router",
    "settings_router",
    "detection_router",
    "learning_router",
    "sorting_router",
    "rewards_router",
    "dashboard_router"
]
