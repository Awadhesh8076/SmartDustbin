from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.reward import (
    RewardBalanceResponse,
    RewardCatalogResponse,
    RewardCatalogItem,
    RewardClaimRequest,
    RewardClaimResponse,
    RewardClaimsResponse,
    RewardClaimItem,
    RewardTransactionsResponse,
    RewardTransactionItem
)
from app.services.rewards_service import rewards_service

router = APIRouter(prefix="/rewards", tags=["Rewards"])

@router.get("/balance", response_model=RewardBalanceResponse)
def get_balance(db: Session = Depends(get_db)):
    """
    Returns current spendable coin balance, total earned, and total spent.
    """
    data = rewards_service.get_current_balance(db)
    return RewardBalanceResponse(**data)

@router.get("/catalog", response_model=RewardCatalogResponse)
def get_catalog():
    """
    Returns list of redeemable eco vouchers and rewards.
    """
    items = rewards_service.get_catalog()
    return RewardCatalogResponse(items=[RewardCatalogItem(**it) for it in items])

@router.post("/claim", response_model=RewardClaimResponse)
def claim_reward(
    payload: RewardClaimRequest,
    db: Session = Depends(get_db)
):
    """
    Redeems coins for a selected catalog reward. Generates an ECO-XXXXX voucher code.
    """
    claim = rewards_service.claim_reward(payload.reward_id, db)
    balance_info = rewards_service.get_current_balance(db)
    return RewardClaimResponse(
        claim_id=claim.id,
        reward_id=claim.reward_id,
        reward_title=claim.reward_title,
        coin_cost=claim.coin_cost,
        claim_code=claim.claim_code,
        status=claim.status,
        balance_after=balance_info["balance"],
        message=f"Successfully claimed '{claim.reward_title}'! Use code: {claim.claim_code}",
        created_at=claim.created_at
    )

@router.get("/claims", response_model=RewardClaimsResponse)
def get_claims(
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    Returns history of claimed rewards with vouchers.
    """
    claims = rewards_service.get_claims(db, limit=limit)
    items = [
        RewardClaimItem(
            id=c.id,
            reward_id=c.reward_id,
            reward_title=c.reward_title,
            coin_cost=c.coin_cost,
            claim_code=c.claim_code,
            status=c.status,
            created_at=c.created_at
        )
        for c in claims
    ]
    return RewardClaimsResponse(total=len(items), claims=items)

@router.get("/history", response_model=RewardTransactionsResponse)
def get_transactions(
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    Returns history of coin credit transactions from confirmed sorting operations.
    """
    txns = rewards_service.get_transactions(db, limit=limit)
    items = [
        RewardTransactionItem(
            id=t.id,
            sorting_history_id=t.sorting_history_id,
            category=t.category,
            coins_awarded=t.coins_awarded,
            balance_after=t.balance_after,
            created_at=t.created_at
        )
        for t in txns
    ]
    return RewardTransactionsResponse(total=len(items), transactions=items)
