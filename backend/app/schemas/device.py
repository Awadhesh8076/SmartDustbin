from typing import Optional, Dict
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
    force_real: Optional[bool] = False

class DevicePingResponse(BaseModel):
    device: str
    ip: str
    online: bool
    status_message: str
    latency_ms: Optional[float] = None
    details: Optional[Dict] = None

class ModeSwitchRequest(BaseModel):
    mode: str  # "SIMULATION" or "REAL_HARDWARE"

class ModeSwitchResponse(BaseModel):
    previous_mode: str
    active_mode: str
    message: str

class CameraTestCaptureResponse(BaseModel):
    status: str
    ip: str
    bytes_received: int
    format: str
    image_preview_url: str
    message: str

class DevKitTestSortRequest(BaseModel):
    category: str
    ip: Optional[str] = None

class DevKitTestSortResponse(BaseModel):
    status: str
    ip: str
    category: str
    message: str
    details: Optional[Dict] = None
