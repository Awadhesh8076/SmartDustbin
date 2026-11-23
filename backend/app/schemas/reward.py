from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

class RewardBalanceResponse(BaseModel):
    balance: int
    total_earned: int
    total_spent: int

class RewardCatalogItem(BaseModel):
    id: str
    title: str
    description: str
    coin_cost: int
    icon: str

class RewardCatalogResponse(BaseModel):
    items: List[RewardCatalogItem]

class RewardClaimRequest(BaseModel):
    reward_id: str

class RewardClaimResponse(BaseModel):
    claim_id: str
    reward_id: str
    reward_title: str
    coin_cost: int
    claim_code: str
    status: str
    balance_after: int
    message: str
    created_at: datetime

class RewardTransactionItem(BaseModel):
    id: str
    sorting_history_id: str
    category: str
    coins_awarded: int
    balance_after: int
    created_at: datetime

class RewardTransactionsResponse(BaseModel):
    total: int
    transactions: List[RewardTransactionItem]

class RewardClaimItem(BaseModel):
    id: str
    reward_id: str
    reward_title: str
    coin_cost: int
    claim_code: str
    status: str
    created_at: datetime

class RewardClaimsResponse(BaseModel):
    total: int
    claims: List[RewardClaimItem]
