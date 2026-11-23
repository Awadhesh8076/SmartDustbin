from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

class TeachRequest(BaseModel):
    detection_id: str
    confirmed_category: str

class TeachResponse(BaseModel):
    status: str
    sample_id: str
    confirmed_category: str
    was_corrected: bool
    model_version: str
    total_samples: int
    immediate_new_prediction: str
    immediate_new_confidence: float
    message: str

class LearningSampleItem(BaseModel):
    id: str
    detection_id: Optional[str] = None
    image_url: str
    predicted_category: str
    confirmed_category: str
    was_corrected: bool
    original_confidence: float
    model_version: str
    created_at: datetime

class LearningSamplesResponse(BaseModel):
    total: int
    samples: List[LearningSampleItem]

class ConfusionMatrixResponse(BaseModel):
    matrix: dict
    total_samples: int
    accuracy_percent: float
    categories: List[str]
