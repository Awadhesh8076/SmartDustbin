from pydantic import BaseModel

class SettingsUpdate(BaseModel):
    esp32_cam_ip: str
    esp32_devkit_ip: str
    camera_timeout_seconds: int = 4
    devkit_timeout_seconds: int = 10
    active_mode: str = "SIMULATION"

class SettingsResponse(BaseModel):
    esp32_cam_ip: str
    esp32_devkit_ip: str
    camera_timeout_seconds: int
    devkit_timeout_seconds: int
    active_mode: str
    storage_path: str
    database_url: str
