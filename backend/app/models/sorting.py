import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey
from app.core.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class SortingCommand(Base):
    __tablename__ = "sorting_commands"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    detection_id = Column(String(36), nullable=True)
    requested_category = Column(String(20), nullable=False)
    target_chute_angle = Column(Integer, nullable=False)  # 45, 90, 135, 180
    mode = Column(String(20), default="SIMULATION")  # SIMULATION or REAL_HARDWARE
    status = Column(String(20), default="PENDING")  # PENDING, SENT, IN_PROGRESS, SUCCESS, FAILED, UNKNOWN
    device_ip = Column(String(50), nullable=True)
    retry_count = Column(Integer, default=0)
    error_message = Column(String(255), nullable=True)
    sent_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)

class SortingHistory(Base):
    __tablename__ = "sorting_histories"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    command_id = Column(String(36), unique=True, nullable=False)
    category = Column(String(20), nullable=False)
    mode = Column(String(20), default="SIMULATION")
    result_status = Column(String(20), default="SUCCESS")  # SUCCESS, FAILED
    execution_duration_seconds = Column(Float, default=2.7)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
