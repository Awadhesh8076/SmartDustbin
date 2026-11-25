import base64
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.device import DeviceConfiguration
from app.schemas.device import (
    DeviceStatusResponse,
    DevicePingRequest,
    DevicePingResponse,
    ModeSwitchRequest,
    ModeSwitchResponse,
    CameraTestCaptureResponse,
    DevKitTestSortRequest,
    DevKitTestSortResponse,
)
from app.services.hardware_service import hardware_service

router = APIRouter(prefix="/devices", tags=["Devices"])

def get_or_create_device_config(db: Session) -> DeviceConfiguration:
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
        db.refresh(config)
    return config

@router.get("/status", response_model=DeviceStatusResponse)
def get_device_status(db: Session = Depends(get_db)):
    config = get_or_create_device_config(db)
    
    return DeviceStatusResponse(
        active_mode="REAL_HARDWARE",
        esp32_cam_ip=config.esp32_cam_ip,
        esp32_devkit_ip=config.esp32_devkit_ip,
        cam_status=config.cam_status,
        devkit_status=config.devkit_status,
        last_cam_ping=config.last_cam_ping,
        last_devkit_ping=config.last_devkit_ping
    )

@router.post("/test-connection", response_model=DevicePingResponse)
async def test_connection(payload: DevicePingRequest, db: Session = Depends(get_db)):
    config = get_or_create_device_config(db)
    target_ip = payload.ip or (config.esp32_cam_ip if payload.device == "CAM" else config.esp32_devkit_ip)
    
    status = await hardware_service.ping_device(
        device_type=payload.device,
        ip=target_ip,
        timeout=3.0
    )
        
    now = datetime.now(timezone.utc)
    if payload.device == "CAM":
        config.cam_status = "ONLINE" if status.online else "OFFLINE"
        config.last_cam_ping = now
    else:
        config.devkit_status = "ONLINE" if status.online else "OFFLINE"
        config.last_devkit_ping = now
    db.commit()
    
    return DevicePingResponse(
        device=payload.device,
        ip=target_ip,
        online=status.online,
        status_message=status.status_message,
        latency_ms=status.latency_ms,
        details=status.details
    )

@router.post("/cam/test-capture", response_model=CameraTestCaptureResponse)
async def test_camera_capture(ip: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Directly tests the ESP32-CAM /capture endpoint, returns image byte statistics
    and an inline base64 JPEG preview for verification.
    """
    config = get_or_create_device_config(db)
    target_ip = ip or config.esp32_cam_ip

    image_bytes = await hardware_service.capture_frame_from_cam(
        ip=target_ip,
        timeout=float(config.camera_timeout_seconds)
    )

    b64_str = base64.b64encode(image_bytes).decode("utf-8")
    preview_url = f"data:image/jpeg;base64,{b64_str}"

    return CameraTestCaptureResponse(
        status="SUCCESS",
        ip=target_ip,
        bytes_received=len(image_bytes),
        format="JPEG",
        image_preview_url=preview_url,
        message=f"Received valid JPEG frame ({len(image_bytes)} bytes) from ESP32-CAM at {target_ip}."
    )

@router.post("/devkit/test-sort", response_model=DevKitTestSortResponse)
async def test_devkit_sort(payload: DevKitTestSortRequest, db: Session = Depends(get_db)):
    """
    Directly tests the physical sorting actuation on ESP32 DevKit by sending
    an explicit sorting request to GET /sort?type=...
    """
    cat = payload.category.upper()
    if cat not in ["PLASTIC", "METAL", "WET", "DRY"]:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category '{payload.category}'. Allowed: PLASTIC, METAL, WET, DRY."
        )

    config = get_or_create_device_config(db)
    target_ip = payload.ip or config.esp32_devkit_ip
    timeout = float(config.devkit_timeout_seconds)
    test_cmd_id = f"test-{uuid.uuid4()}"

    success, msg, data = await hardware_service.dispatch_devkit_sort(
        ip=target_ip,
        category=cat,
        command_id=test_cmd_id,
        timeout=timeout
    )

    if not success:
        status_code = 429 if data and data.get("status") == "BUSY" else 502
        raise HTTPException(status_code=status_code, detail=msg)

    return DevKitTestSortResponse(
        status="SUCCESS",
        ip=target_ip,
        category=cat,
        message=f"Physical sorting test confirmed by ESP32 DevKit at {target_ip}: {msg}",
        details=data
    )

@router.post("/camera/capture")
async def capture_from_camera(db: Session = Depends(get_db)):
    """
    Captures a real frame from ESP32-CAM via HardwareService,
    runs TinyML AI inference, saves the scan, and returns classification result.
    """
    config = get_or_create_device_config(db)
    
    image_bytes = await hardware_service.capture_frame_from_cam(
        ip=config.esp32_cam_ip,
        timeout=float(config.camera_timeout_seconds)
    )
    source = "ESP32_CAM"

    from app.ai.inference_service import inference_service
    prediction = inference_service.classify_image_bytes(
        image_bytes=image_bytes,
        source=source,
        db=db,
        save_scan=True
    )
    return prediction

@router.post("/mode", response_model=ModeSwitchResponse)
def set_operating_mode(payload: ModeSwitchRequest, db: Session = Depends(get_db)):
    config = get_or_create_device_config(db)
    config.active_mode = "REAL_HARDWARE"
    config.cam_status = "ONLINE"
    config.devkit_status = "ONLINE"
    db.commit()
    
    return ModeSwitchResponse(
        previous_mode="REAL_HARDWARE",
        active_mode="REAL_HARDWARE",
        message="Operating mode permanently set to REAL_HARDWARE"
    )
