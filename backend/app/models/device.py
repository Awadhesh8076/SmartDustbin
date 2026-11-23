from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime
from app.core.database import Base

class DeviceConfiguration(Base):
    __tablename__ = "device_configurations"
    
    id = Column(String(20), primary_key=True, default="default")
    esp32_cam_ip = Column(String(50), default="192.168.4.10")
    esp32_devkit_ip = Column(String(50), default="192.168.4.20")
    camera_timeout_seconds = Column(Integer, default=4)
    devkit_timeout_seconds = Column(Integer, default=10)
    active_mode = Column(String(20), default="SIMULATION")  # SIMULATION or REAL_HARDWARE
    last_cam_ping = Column(DateTime, nullable=True)
    cam_status = Column(String(20), default="UNCHECKED")
    last_devkit_ping = Column(DateTime, nullable=True)
    devkit_status = Column(String(20), default="UNCHECKED")
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class ApplicationSettings(Base):
    __tablename__ = "application_settings"
    
    key = Column(String(50), primary_key=True)
    value = Column(String(255), nullable=False)
    description = Column(String(255), nullable=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
