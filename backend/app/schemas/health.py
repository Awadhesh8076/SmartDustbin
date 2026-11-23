from typing import Dict, Any
from pydantic import BaseModel

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    active_mode: str
    database: str
    storage_ready: bool
