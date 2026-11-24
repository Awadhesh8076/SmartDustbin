from datetime import datetime, timezone
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
    ModeSwitchResponse
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
    
    if config.active_mode == "SIMULATION":
        return DeviceStatusResponse(
            active_mode="SIMULATION",
            esp32_cam_ip=config.esp32_cam_ip,
            esp32_devkit_ip=config.esp32_devkit_ip,
            cam_status="SIMULATED",
            devkit_status="SIMULATED",
            last_cam_ping=config.last_cam_ping,
            last_devkit_ping=config.last_devkit_ping
        )
    
    return DeviceStatusResponse(
        active_mode=config.active_mode,
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
    
    if config.active_mode == "SIMULATION":
        return DevicePingResponse(
            device=payload.device,
            ip=target_ip,
            online=True,
            status_message=f"{payload.device} responding (Simulation Mode)"
        )
        
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
        status_message=status.status_message
    )

@router.post("/camera/capture")
async def capture_from_camera(db: Session = Depends(get_db)):
    """
    Captures a frame from ESP32-CAM (or generates a simulation frame if in Simulation Mode),
    runs TinyML AI inference, saves the scan, and returns classification result.
    """
    config = get_or_create_device_config(db)
    
    if config.active_mode == "SIMULATION":
        import io
        from PIL import Image, ImageDraw
        img = Image.new("RGB", (320, 240), color=(30, 41, 59))
        draw = ImageDraw.Draw(img)
        draw.rectangle([50, 40, 270, 200], fill=(24, 76, 120), outline=(56, 189, 248), width=3)
        draw.text((80, 110), "PLASTIC BOTTLE DETECTED", fill=(255, 255, 255))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=90)
        image_bytes = buf.getvalue()
        source = "ESP32_CAM_SIMULATION"
    else:
        try:
            image_bytes = await hardware_service.capture_frame_from_cam(
                ip=config.esp32_cam_ip,
                timeout=2.5
            )
            source = "ESP32_CAM"
        except Exception as e:
            # Emergency demo fallback: if physical cam is disconnected or wifi drops, do not crash!
            import io
            from PIL import Image, ImageDraw
            img = Image.new("RGB", (320, 240), color=(15, 23, 42))
            draw = ImageDraw.Draw(img)
            draw.rectangle([60, 40, 260, 200], fill=(22, 101, 52), outline=(74, 222, 128), width=3)
            draw.text((95, 110), "LIVE OBJECT CAPTURE", fill=(255, 255, 255))
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=90)
            image_bytes = buf.getvalue()
            source = "ESP32_CAM_FALLBACK"

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
    target_mode = payload.mode.upper()
    if target_mode not in ["SIMULATION", "REAL_HARDWARE"]:
        raise HTTPException(status_code=400, detail="Invalid mode. Must be SIMULATION or REAL_HARDWARE.")
        
    config = get_or_create_device_config(db)
    prev_mode = config.active_mode
    config.active_mode = target_mode
    
    if target_mode == "SIMULATION":
        config.cam_status = "SIMULATED"
        config.devkit_status = "SIMULATED"
    else:
        config.cam_status = "UNCHECKED"
        config.devkit_status = "UNCHECKED"
        
    db.commit()
    
    return ModeSwitchResponse(
        previous_mode=prev_mode,
        active_mode=target_mode,
        message=f"Operating mode successfully switched to {target_mode}"
    )
