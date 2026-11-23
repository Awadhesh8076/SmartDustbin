from typing import Dict, Optional, List
from datetime import datetime
from pydantic import BaseModel

class DetectionScanResponse(BaseModel):
    detection_id: str
    image_url: str
    category: str
    confidence: float
    confidence_level: str
    probabilities: Dict[str, float]
    is_known_in_memory: bool
    similarity: float
    model_version: str
    requires_user_label: bool
    message: str

class DetectionHistoryItem(BaseModel):
    id: str
    image_url: str
    detected_category: str
    confidence: float
    confidence_level: str
    source: str
    created_at: datetime

class DetectionHistoryResponse(BaseModel):
    total: int
    items: List[DetectionHistoryItem]
