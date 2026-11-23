import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime
from app.core.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class RewardTransaction(Base):
    __tablename__ = "reward_transactions"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    sorting_history_id = Column(String(36), unique=True, nullable=False)
    category = Column(String(20), nullable=False)
    coins_awarded = Column(Integer, nullable=False)  # 5, 3, 2, 1
    balance_after = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class RewardClaim(Base):
    __tablename__ = "reward_claims"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    reward_id = Column(String(20), nullable=False)  # R1, R2, R3, R4
    reward_title = Column(String(100), nullable=False)
    coin_cost = Column(Integer, nullable=False)
    claim_code = Column(String(20), unique=True, nullable=False)  # ECO-XXXXX
    status = Column(String(20), default="CLAIMED")  # CLAIMED, REDEEMED
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
