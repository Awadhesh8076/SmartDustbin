from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.dashboard import (
    DashboardStatsResponse,
    DashboardRecentActivityResponse,
    RecentActivityItem,
    AnalyticsTrendsResponse
)
from app.services.dashboard_service import dashboard_service

router = APIRouter(tags=["Dashboard & Analytics"])

@router.get("/dashboard/stats", response_model=DashboardStatsResponse)
def get_dashboard_stats(db: Session = Depends(get_db)):
    """
    Returns aggregated real-time system metrics directly from SQLite database.
    """
    stats = dashboard_service.get_dashboard_stats(db)
    return DashboardStatsResponse(**stats)

@router.get("/dashboard/recent-activity", response_model=DashboardRecentActivityResponse)
def get_recent_activity(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """
    Returns the most recent combined detection and sorting activities.
    """
    activities = dashboard_service.get_recent_activity(db, limit=limit)
    items = [RecentActivityItem(**act) for act in activities]
    return DashboardRecentActivityResponse(activities=items)

@router.get("/analytics/trends", response_model=AnalyticsTrendsResponse)
def get_analytics_trends(db: Session = Depends(get_db)):
    """
    Returns category distributions, sorting success rates, and timelines for analytics.
    """
    trends = dashboard_service.get_analytics_trends(db)
    return AnalyticsTrendsResponse(**trends)
