from app.schemas.health import HealthResponse
from app.schemas.device import (
    DeviceStatusResponse,
    DevicePingRequest,
    DevicePingResponse,
    ModeSwitchRequest,
    ModeSwitchResponse
)
from app.schemas.settings import SettingsUpdate, SettingsResponse
from app.schemas.detection import DetectionScanResponse, DetectionHistoryItem, DetectionHistoryResponse
from app.schemas.learning import (
    TeachRequest,
    TeachResponse,
    LearningSampleItem,
    LearningSamplesResponse,
    ConfusionMatrixResponse
)
from app.schemas.sorting import (
    SortingExecuteRequest,
    SortingExecuteResponse,
    SortingCommandDetails,
    SortingHistoryItem,
    SortingHistoryResponse,
    SortingStatsResponse
)
from app.schemas.reward import (
    RewardBalanceResponse,
    RewardCatalogItem,
    RewardCatalogResponse,
    RewardClaimRequest,
    RewardClaimResponse,
    RewardTransactionItem,
    RewardTransactionsResponse,
    RewardClaimItem,
    RewardClaimsResponse
)
from app.schemas.dashboard import (
    DashboardStatsResponse,
    RecentActivityItem,
    DashboardRecentActivityResponse,
    AnalyticsTrendsResponse
)

__all__ = [
    "HealthResponse",
    "DeviceStatusResponse",
    "DevicePingRequest",
    "DevicePingResponse",
    "ModeSwitchRequest",
    "ModeSwitchResponse",
    "SettingsUpdate",
    "SettingsResponse",
    "DetectionScanResponse",
    "DetectionHistoryItem",
    "DetectionHistoryResponse",
    "TeachRequest",
    "TeachResponse",
    "LearningSampleItem",
    "LearningSamplesResponse",
    "ConfusionMatrixResponse",
    "SortingExecuteRequest",
    "SortingExecuteResponse",
    "SortingCommandDetails",
    "SortingHistoryItem",
    "SortingHistoryResponse",
    "SortingStatsResponse",
    "RewardBalanceResponse",
    "RewardCatalogItem",
    "RewardCatalogResponse",
    "RewardClaimRequest",
    "RewardClaimResponse",
    "RewardTransactionItem",
    "RewardTransactionsResponse",
    "RewardClaimItem",
    "RewardClaimsResponse",
    "DashboardStatsResponse",
    "RecentActivityItem",
    "DashboardRecentActivityResponse",
    "AnalyticsTrendsResponse"
]
