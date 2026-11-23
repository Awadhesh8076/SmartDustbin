from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.sorting import SortingCommand
from app.models.reward import RewardTransaction
from app.schemas.sorting import (
    SortingExecuteRequest,
    SortingExecuteResponse,
    SortingCommandDetails,
    SortingHistoryResponse,
    SortingStatsResponse,
    SortingHistoryItem
)
from app.services.sorting_service import sorting_service

router = APIRouter(prefix="/sorting", tags=["Sorting"])

@router.post("/execute", response_model=SortingExecuteResponse)
async def execute_sorting(
    payload: SortingExecuteRequest,
    db: Session = Depends(get_db)
):
    """
    Executes a sorting command (Simulation or Real Hardware DevKit actuation).
    Returns execution status, angle, coins earned, and updated coin balance.
    """
    result = await sorting_service.execute_sorting(
        category=payload.category,
        detection_id=payload.detection_id,
        db=db,
        mode_override=payload.mode_override
    )
    return SortingExecuteResponse(**result)

@router.get("/history", response_model=SortingHistoryResponse)
def get_sorting_history(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Returns paginated sorting history records.
    """
    total, items = sorting_service.get_sorting_history(db, limit=limit, offset=offset)
    history_items = []
    hist_ids = [it.id for it in items]
    txns = {}
    if hist_ids:
        for t in db.query(RewardTransaction).filter(RewardTransaction.sorting_history_id.in_(hist_ids)).all():
            txns[t.sorting_history_id] = t.coins_awarded

    for it in items:
        coins = txns.get(it.id, 0)
        history_items.append(SortingHistoryItem(
            id=it.id,
            command_id=it.command_id,
            category=it.category,
            mode=it.mode,
            result_status=it.result_status,
            execution_duration_seconds=it.execution_duration_seconds,
            coins_awarded=coins,
            created_at=it.created_at
        ))
    return SortingHistoryResponse(total=total, items=history_items)

@router.get("/stats", response_model=SortingStatsResponse)
def get_sorting_stats(db: Session = Depends(get_db)):
    """
    Returns aggregated sorting statistics across categories and execution modes.
    """
    stats = sorting_service.get_sorting_stats(db)
    return SortingStatsResponse(**stats)

@router.get("/commands/{command_id}", response_model=SortingCommandDetails)
def get_sorting_command(command_id: str, db: Session = Depends(get_db)):
    """
    Retrieves the exact state, timestamps, and error message of a sorting command.
    """
    cmd = db.query(SortingCommand).filter(SortingCommand.id == command_id).first()
    if not cmd:
        raise HTTPException(status_code=404, detail=f"Sorting command '{command_id}' not found.")
    return SortingCommandDetails(
        id=cmd.id,
        detection_id=cmd.detection_id,
        requested_category=cmd.requested_category,
        target_chute_angle=cmd.target_chute_angle,
        mode=cmd.mode,
        status=cmd.status,
        device_ip=cmd.device_ip,
        retry_count=cmd.retry_count,
        error_message=cmd.error_message,
        sent_at=cmd.sent_at,
        completed_at=cmd.completed_at
    )
