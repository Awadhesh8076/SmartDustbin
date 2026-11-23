import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Boolean, DateTime, Text, ForeignKey
from app.core.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class LearningSample(Base):
    __tablename__ = "learning_samples"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    detection_id = Column(String(36), nullable=True)
    image_path = Column(String(255), nullable=False)
    predicted_category = Column(String(20), nullable=False)
    confirmed_category = Column(String(20), nullable=False)
    was_corrected = Column(Boolean, default=False)
    original_confidence = Column(Float, default=0.0)
    feature_vector_json = Column(Text, nullable=False)  # 32-D vector
    model_version = Column(String(20), default="v1.0")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class CentroidMemory(Base):
    __tablename__ = "centroid_memory"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    category = Column(String(20), unique=True, nullable=False)  # WET, DRY, PLASTIC, METAL
    sample_count = Column(Float, default=0)
    centroid_vector_json = Column(Text, nullable=False)  # 32-D float array
    last_updated = Column(DateTime, default=lambda: datetime.now(timezone.utc))
