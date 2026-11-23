import random
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException

from app.core.config import settings
from app.models.reward import RewardTransaction, RewardClaim
from app.models.sorting import SortingHistory

CATALOG_ITEMS = [
    {
        "id": "R1",
        "title": "₹10 Discount Voucher",
        "description": "Get ₹10 off at partnered eco-stores",
        "coin_cost": 20,
        "icon": "🎫"
    },
    {
        "id": "R2",
        "title": "Free Coffee / Drink",
        "description": "Redeem a free drink at campus cafeteria",
        "coin_cost": 40,
        "icon": "☕"
    },
    {
        "id": "R3",
        "title": "Plant 1 Tree (Eco Donation)",
        "description": "Fund real tree plantation through your coins",
        "coin_cost": 50,
        "icon": "🌲"
    },
    {
        "id": "R4",
        "title": "₹50 UPI Cashback",
        "description": "Direct cash transfer reward to your account",
        "coin_cost": 100,
        "icon": "💳"
    }
]

REWARD_AMOUNTS = {
    "METAL": 5,
    "PLASTIC": 3,
    "DRY": 2,
    "WET": 1
}

class RewardsService:
    @staticmethod
    def get_reward_for_category(category: str) -> int:
        cat = category.upper()
        return REWARD_AMOUNTS.get(cat, 0)

    @staticmethod
    def get_current_balance(db: Session) -> Dict[str, int]:
        total_earned = db.query(func.coalesce(func.sum(RewardTransaction.coins_awarded), 0)).scalar()
        total_spent = db.query(func.coalesce(func.sum(RewardClaim.coin_cost), 0)).scalar()
        balance = int(total_earned) - int(total_spent)
        return {
            "balance": max(0, balance),
            "total_earned": int(total_earned),
            "total_spent": int(total_spent)
        }

    @staticmethod
    def credit_sorting_reward(sorting_history: SortingHistory, db: Session) -> RewardTransaction:
        """
        Atomically awards coins for a confirmed sorting operation.
        Strict duplicate protection via unique sorting_history_id.
        """
        # 1. Prevent duplicate reward credit for this sorting operation
        existing = db.query(RewardTransaction).filter(
            RewardTransaction.sorting_history_id == sorting_history.id
        ).first()
        if existing:
            return existing

        coins = RewardsService.get_reward_for_category(sorting_history.category)
        if coins <= 0:
            raise ValueError(f"Category '{sorting_history.category}' does not qualify for coin reward.")

        # Compute running balance
        balance_info = RewardsService.get_current_balance(db)
        new_balance = balance_info["balance"] + coins

        txn = RewardTransaction(
            id=str(uuid.uuid4()),
            sorting_history_id=sorting_history.id,
            category=sorting_history.category.upper(),
            coins_awarded=coins,
            balance_after=new_balance,
            created_at=datetime.now(timezone.utc)
        )
        db.add(txn)
        db.commit()
        db.refresh(txn)
        return txn

    @staticmethod
    def get_catalog() -> List[dict]:
        return CATALOG_ITEMS

    @staticmethod
    def claim_reward(reward_id: str, db: Session) -> RewardClaim:
        """
        Redeems coins for an Eco Store reward item.
        Atomic check-and-deduct transaction. Generates ECO-XXXXX claim code.
        """
        item = next((i for i in CATALOG_ITEMS if i["id"] == reward_id), None)
        if not item:
            raise HTTPException(status_code=404, detail=f"Reward '{reward_id}' not found in catalog.")

        balance_info = RewardsService.get_current_balance(db)
        if balance_info["balance"] < item["coin_cost"]:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient coins. You have {balance_info['balance']} coins but need {item['coin_cost']} coins."
            )

        # Generate unique claim code ECO-XXXXX
        code = None
        for _ in range(10):
            cand = f"ECO-{random.randint(10000, 99999)}"
            if not db.query(RewardClaim).filter(RewardClaim.claim_code == cand).first():
                code = cand
                break
        if not code:
            code = f"ECO-{random.randint(100000, 999999)}"

        claim = RewardClaim(
            id=str(uuid.uuid4()),
            reward_id=item["id"],
            reward_title=item["title"],
            coin_cost=item["coin_cost"],
            claim_code=code,
            status="CLAIMED",
            created_at=datetime.now(timezone.utc)
        )
        db.add(claim)
        db.commit()
        db.refresh(claim)
        return claim

    @staticmethod
    def get_claims(db: Session, limit: int = 50) -> List[RewardClaim]:
        return db.query(RewardClaim).order_by(RewardClaim.created_at.desc()).limit(limit).all()

    @staticmethod
    def get_transactions(db: Session, limit: int = 50) -> List[RewardTransaction]:
        return db.query(RewardTransaction).order_by(RewardTransaction.created_at.desc()).limit(limit).all()

rewards_service = RewardsService()
