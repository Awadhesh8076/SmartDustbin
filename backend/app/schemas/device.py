from typing import Optional
from datetime import datetime
from pydantic import BaseModel

class DeviceStatusResponse(BaseModel):
    active_mode: str
    esp32_cam_ip: str
    esp32_devkit_ip: str
    cam_status: str
    devkit_status: str
    last_cam_ping: Optional[datetime] = None
    last_devkit_ping: Optional[datetime] = None

class DevicePingRequest(BaseModel):
    device: str  # "CAM" or "DEVKIT"
    ip: Optional[str] = None

class DevicePingResponse(BaseModel):
    device: str
    ip: str
    online: bool
    status_message: str

class ModeSwitchRequest(BaseModel):
    mode: str  # "SIMULATION" or "REAL_HARDWARE"

class ModeSwitchResponse(BaseModel):
    previous_mode: str
    active_mode: str
    message: str
