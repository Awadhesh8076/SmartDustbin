import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, Text
from app.core.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class WasteDetection(Base):
    __tablename__ = "waste_detections"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    image_path = Column(String(255), nullable=False)
    detected_category = Column(String(20), nullable=False)  # PLASTIC, METAL, DRY, WET, UNKNOWN
    confidence = Column(Float, nullable=False, default=0.0)
    confidence_level = Column(String(10), nullable=False, default="LOW")  # HIGH, MEDIUM, LOW
    probabilities_json = Column(Text, nullable=True)  # JSON string of class probabilities
    feature_vector_json = Column(Text, nullable=True)  # 32-D vector JSON string
    model_version = Column(String(20), default="v1.0")
    source = Column(String(30), default="BROWSER_CAMERA")  # BROWSER_CAMERA, UPLOAD, ESP32_CAM
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
