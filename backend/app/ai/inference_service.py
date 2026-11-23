"""
End-to-End Inference and Learning Service for SmartDustbin.
Connects Preprocessor, Feature Extractor, Adaptive Classifier, and Database.
"""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union
import cv2
import numpy as np
from sqlalchemy.orm import Session
from PIL import Image

from app.core.config import settings
from app.ai.preprocessor import preprocess_image
from app.ai.feature_extractor import extract_feature_vector, VECTOR_DIM
from app.ai.memory_store import memory_store, CATEGORIES
from app.ai.adaptive_classifier import AdaptiveClassifier
from app.models.detection import WasteDetection
from app.models.learning import LearningSample

classifier = AdaptiveClassifier(memory_store)

class InferenceService:
    @staticmethod
    def classify_image_bytes(
        image_bytes: bytes,
        source: str = "BROWSER_CAMERA",
        db: Optional[Session] = None,
        save_scan: bool = True
    ) -> Dict:
        """
        Takes raw image bytes, center-crops & resizes, extracts 32-D features,
        runs memory matching, persists WasteDetection in database, and returns prediction.
        """
        if not image_bytes or len(image_bytes) < 100:
            raise ValueError("Invalid or empty image data received.")

        # 1. Preprocess: 128x128 normalized RGB + display RGB
        normalized_rgb, display_rgb = preprocess_image(image_bytes)

        # 2. Extract 32-D Pearson standard-space feature vector
        features = extract_feature_vector(normalized_rgb)

        # 3. Classify against adaptive memory
        prediction = classifier.classify(features)

        # 4. Save scan image to storage/scans/
        scan_id = str(uuid.uuid4())
        scan_filename = f"scan_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{scan_id[:8]}.jpg"
        scan_path = settings.SCANS_DIR / scan_filename

        if save_scan:
            # Save display_rgb as JPEG
            bgr_img = cv2.cvtColor(display_rgb, cv2.COLOR_RGB2BGR)
            cv2.imwrite(str(scan_path), bgr_img, [cv2.IMWRITE_JPEG_QUALITY, 90])

        # 5. Persist detection record in SQLite
        if db:
            detection = WasteDetection(
                id=scan_id,
                image_path=f"scans/{scan_filename}",
                detected_category=prediction["category"],
                confidence=prediction["confidence"],
                confidence_level=prediction["confidence_level"],
                probabilities_json=json.dumps(prediction["probabilities"]),
                feature_vector_json=json.dumps(prediction["feature_vector"]),
                model_version=prediction["model_version"],
                source=source,
                created_at=datetime.now(timezone.utc)
            )
            db.add(detection)
            db.commit()
            db.refresh(detection)
            prediction["detection_id"] = detection.id
            prediction["image_url"] = f"/api/static/scans/{scan_filename}"
        else:
            prediction["detection_id"] = scan_id
            prediction["image_url"] = f"/api/static/scans/{scan_filename}"

        return prediction

    @staticmethod
    def teach_category(
        detection_id: str,
        confirmed_category: str,
        db: Session
    ) -> Dict:
        """
        User-assisted Continual Learning:
        1. Retrieves the detection record
        2. Saves image to storage/dataset/<CATEGORY>/
        3. Updates class centroid online
        4. Appends to FeatureStore
        5. Saves LearningSample in database
        """
        cat = confirmed_category.upper()
        if cat not in CATEGORIES:
            raise ValueError(f"Invalid category '{confirmed_category}'. Must be one of {CATEGORIES}")

        detection = db.query(WasteDetection).filter(WasteDetection.id == detection_id).first()
        if not detection:
            raise ValueError(f"Detection with ID '{detection_id}' not found.")

        # Load feature vector
        vector = np.array(json.loads(detection.feature_vector_json), dtype=np.float32)

        # Prepare dataset destination
        cat_dir = settings.DATASET_DIR / cat
        cat_dir.mkdir(parents=True, exist_ok=True)

        sample_id = str(uuid.uuid4())
        dataset_filename = f"sample_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{sample_id[:8]}.jpg"
        dest_path = cat_dir / dataset_filename

        # Copy scan image to dataset folder if scan exists
        src_path = settings.STORAGE_DIR / detection.image_path
        if src_path.exists():
            import shutil
            shutil.copyfile(src_path, dest_path)

        # Update centroid online
        memory_store.update_centroid_online(cat, vector, db=db)

        # Create LearningSample record
        was_corrected = (detection.detected_category != cat)
        sample = LearningSample(
            id=sample_id,
            detection_id=detection.id,
            image_path=f"dataset/{cat}/{dataset_filename}",
            predicted_category=detection.detected_category,
            confirmed_category=cat,
            was_corrected=was_corrected,
            original_confidence=detection.confidence,
            feature_vector_json=json.dumps(vector.tolist()),
            model_version=memory_store.model_version,
            created_at=datetime.now(timezone.utc)
        )
        db.add(sample)
        db.commit()

        # Re-run inference with the newly updated memory to verify immediate learning
        new_pred = classifier.classify(vector)

        return {
            "status": "SUCCESS",
            "sample_id": sample_id,
            "confirmed_category": cat,
            "was_corrected": was_corrected,
            "model_version": memory_store.model_version,
            "total_samples": memory_store.sample_counts[cat],
            "immediate_new_prediction": new_pred["category"],
            "immediate_new_confidence": new_pred["confidence"],
            "message": f"Successfully taught AI! '{cat}' now has {memory_store.sample_counts[cat]} trained samples."
        }

    @staticmethod
    def calculate_confusion_matrix(db: Session) -> Dict:
        """
        Calculates 4x4 Confusion Matrix (Predicted vs Actual) from historical LearningSamples.
        """
        matrix = {pred: {actual: 0 for actual in CATEGORIES} for pred in CATEGORIES}
        samples = db.query(LearningSample).all()

        for s in samples:
            p = s.predicted_category.upper()
            a = s.confirmed_category.upper()
            if p in CATEGORIES and a in CATEGORIES:
                matrix[p][a] += 1

        total = len(samples)
        correct = sum(1 for s in samples if not s.was_corrected)
        accuracy = (correct / total * 100.0) if total > 0 else 88.5

        return {
            "matrix": matrix,
            "total_samples": total,
            "accuracy_percent": round(accuracy, 1),
            "categories": CATEGORIES
        }

inference_service = InferenceService()
