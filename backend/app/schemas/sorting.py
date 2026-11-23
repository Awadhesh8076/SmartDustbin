from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel

class SortingExecuteRequest(BaseModel):
    category: str
    detection_id: Optional[str] = None
    mode_override: Optional[str] = None

class SortingExecuteResponse(BaseModel):
    command_id: str
    detection_id: Optional[str] = None
    status: str  # PENDING, IN_PROGRESS, SUCCESS, FAILED, UNKNOWN
    category: str
    target_angle: int
    mode: str
    coins_earned: int
    balance_after: int
    execution_duration_seconds: float
    message: str

class SortingCommandDetails(BaseModel):
    id: str
    detection_id: Optional[str] = None
    requested_category: str
    target_chute_angle: int
    mode: str
    status: str
    device_ip: Optional[str] = None
    retry_count: int
    error_message: Optional[str] = None
    sent_at: datetime
    completed_at: Optional[datetime] = None

class SortingHistoryItem(BaseModel):
    id: str
    command_id: str
    category: str
    mode: str
    result_status: str
    execution_duration_seconds: float
    coins_awarded: int
    created_at: datetime

class SortingHistoryResponse(BaseModel):
    total: int
    items: List[SortingHistoryItem]

class SortingStatsResponse(BaseModel):
    total_commands: int
    total_successful: int
    total_failed: int
    success_rate_percent: float
    category_counts: dict
    mode_counts: dict
