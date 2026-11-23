from typing import Dict, List, Optional
from datetime import datetime
from pydantic import BaseModel

class DashboardStatsResponse(BaseModel):
    total_detected: int
    total_sorted: int
    total_failed_sorts: int
    category_counts: Dict[str, int]
    category_sorted_counts: Dict[str, int]
    total_learned_samples: int
    current_coin_balance: int
    total_coins_earned: int
    total_coins_spent: int
    active_mode: str
    cam_status: str
    devkit_status: str
    model_version: str
    estimated_accuracy: float

class RecentActivityItem(BaseModel):
    id: str
    type: str  # "DETECTION" or "SORTING"
    category: str
    status: str
    detail: str
    timestamp: datetime

class DashboardRecentActivityResponse(BaseModel):
    activities: List[RecentActivityItem]

class AnalyticsTrendsResponse(BaseModel):
    category_distribution: Dict[str, int]
    sorting_distribution: Dict[str, int]
    success_rate: float
    total_coins_earned: int
    total_claims: int
    timeline: List[dict]
