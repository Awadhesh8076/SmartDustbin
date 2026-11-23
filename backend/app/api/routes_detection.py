from typing import Optional
from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.models.detection import WasteDetection
from app.schemas.detection import DetectionScanResponse, DetectionHistoryResponse, DetectionHistoryItem
from app.ai.inference_service import inference_service

router = APIRouter(prefix="/detection", tags=["Waste Detection"])

@router.post("/scan", response_model=DetectionScanResponse)
async def scan_waste(
    file: UploadFile = File(...),
    source: str = Form(default="BROWSER_CAMERA"),
    db: Session = Depends(get_db)
):
    """
    Accepts an uploaded image file (JPEG/PNG), processes 128x128 crop,
    computes 32-D feature vector, runs Pearson memory matching, and persists record.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a valid image (JPEG/PNG).")

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image size exceeds maximum limit of 10MB.")

    # Validate image magic bytes to prevent masqueraded files
    is_jpeg = contents.startswith(b'\xff\xd8')
    is_png = contents.startswith(b'\x89PNG\r\n\x1a\n')
    is_webp = contents.startswith(b'RIFF') and len(contents) >= 12 and contents[8:12] == b'WEBP'
    if not (is_jpeg or is_png or is_webp):
        raise HTTPException(status_code=400, detail="Invalid image payload: File header must match JPEG, PNG, or WebP format.")

    try:
        prediction = inference_service.classify_image_bytes(
            image_bytes=contents,
            source=source,
            db=db,
            save_scan=True
        )
        return DetectionScanResponse(**prediction)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Classification failed: {str(e)}")


@router.get("/history", response_model=DetectionHistoryResponse)
def get_detection_history(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    category: Optional[str] = Query(default=None),
    db: Session = Depends(get_db)
):
    """
    Returns paginated history of scanned items.
    """
    query = db.query(WasteDetection)
    if category and category.upper() != "ALL":
        query = query.filter(WasteDetection.detected_category == category.upper())

    total = query.count()
    items = query.order_by(desc(WasteDetection.created_at)).offset(offset).limit(limit).all()

    formatted_items = [
        DetectionHistoryItem(
            id=item.id,
            image_url=f"/api/static/{item.image_path}",
            detected_category=item.detected_category,
            confidence=item.confidence,
            confidence_level=item.confidence_level,
            source=item.source,
            created_at=item.created_at
        )
        for item in items
    ]

    return DetectionHistoryResponse(total=total, items=formatted_items)
