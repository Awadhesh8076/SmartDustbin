import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.models.learning import LearningSample
from app.schemas.learning import (
    TeachRequest,
    TeachResponse,
    LearningSampleItem,
    LearningSamplesResponse,
    ConfusionMatrixResponse
)
from app.ai.inference_service import inference_service
from app.ai.memory_store import memory_store

router = APIRouter(prefix="/learning", tags=["AI Continual Learning"])

@router.post("/teach", response_model=TeachResponse)
def teach_ai_category(payload: TeachRequest, db: Session = Depends(get_db)):
    """
    Submits user labeling for an unknown or misclassified detection.
    Updates online centroid, saves exemplar, records learning sample in SQLite.
    """
    try:
        res = inference_service.teach_category(
            detection_id=payload.detection_id,
            confirmed_category=payload.confirmed_category,
            db=db
        )
        return TeachResponse(**res)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Learning update failed: {str(e)}")


@router.get("/samples", response_model=LearningSamplesResponse)
def get_learning_samples(
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    category: Optional[str] = Query(default=None),
    db: Session = Depends(get_db)
):
    """
    Returns paginated user-taught learning samples with thumbnail URLs.
    """
    query = db.query(LearningSample)
    if category and category.upper() != "ALL":
        query = query.filter(LearningSample.confirmed_category == category.upper())

    total = query.count()
    items = query.order_by(desc(LearningSample.created_at)).offset(offset).limit(limit).all()

    formatted = [
        LearningSampleItem(
            id=item.id,
            detection_id=item.detection_id,
            image_url=f"/api/static/{item.image_path}",
            predicted_category=item.predicted_category,
            confirmed_category=item.confirmed_category,
            was_corrected=item.was_corrected,
            original_confidence=item.original_confidence,
            model_version=item.model_version,
            created_at=item.created_at
        )
        for item in items
    ]

    return LearningSamplesResponse(total=total, samples=formatted)


@router.delete("/samples/{sample_id}")
def delete_learning_sample(sample_id: str, db: Session = Depends(get_db)):
    """
    Deletes a learned sample and recalculates the category centroid.
    """
    sample = db.query(LearningSample).filter(LearningSample.id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Learning sample not found.")

    try:
        import numpy as np
        vector = np.array(json.loads(sample.feature_vector_json), dtype=np.float32)
        memory_store.remove_sample(sample.confirmed_category, vector, db=db)
        db.delete(sample)
        db.commit()
        return {"status": "SUCCESS", "message": f"Sample '{sample_id}' removed and centroid updated."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete sample: {str(e)}")


@router.get("/confusion-matrix", response_model=ConfusionMatrixResponse)
def get_confusion_matrix(db: Session = Depends(get_db)):
    """
    Returns 4x4 Confusion Matrix (Predicted vs Actual) computed from historical learning samples.
    """
    data = inference_service.calculate_confusion_matrix(db)
    return ConfusionMatrixResponse(**data)
