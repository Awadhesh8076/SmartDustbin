"""
Persistent AI Memory Store for SmartDustbin.
Manages:
- Category Centroid Vectors (32-D)
- Exemplar Vectors (k-NN feature store)
- Model Versioning (v1.0 -> v1.x)
- Dual-layer persistence: SQLite database + JSON file backup in storage/model/
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional
import numpy as np
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.learning import CentroidMemory, LearningSample

CATEGORIES = ["WET", "DRY", "PLASTIC", "METAL"]
VECTOR_DIM = 32

class AIMemoryStore:
    def __init__(self, model_dir: Optional[Path] = None):
        self.model_dir = model_dir or settings.MODEL_DIR
        self.model_dir.mkdir(parents=True, exist_ok=True)
        self.classifier_path = self.model_dir / "classifier.json"
        self.feature_store_path = self.model_dir / "feature_store.json"
        self.state_path = self.model_dir / "ai_state.json"

        # In-memory caches
        self.centroids: Dict[str, np.ndarray] = {cat: np.zeros(VECTOR_DIM, dtype=np.float32) for cat in CATEGORIES}
        self.sample_counts: Dict[str, int] = {cat: 0 for cat in CATEGORIES}
        self.exemplars: Dict[str, List[np.ndarray]] = {cat: [] for cat in CATEGORIES}
        self.model_version: str = "v1.0"
        self.updates_count: int = 0
        self.total_feedback_samples: int = 0
        self.total_corrections: int = 0
        self.last_updated: str = datetime.now(timezone.utc).isoformat()

        # Load from disk if available
        self.load_from_files()

    def sync_with_db(self, db: Session):
        """
        Synchronizes in-memory centroids and exemplars with SQLite records on startup.
        """
        # 1. Load centroids from DB
        db_centroids = db.query(CentroidMemory).all()
        if db_centroids:
            for cm in db_centroids:
                if cm.category in self.centroids:
                    vec = np.array(json.loads(cm.centroid_vector_json), dtype=np.float32)
                    self.centroids[cm.category] = vec
                    self.sample_counts[cm.category] = int(cm.sample_count)
        else:
            # Seed DB from current in-memory / JSON defaults
            for cat in CATEGORIES:
                cm = CentroidMemory(
                    category=cat,
                    sample_count=float(self.sample_counts[cat]),
                    centroid_vector_json=json.dumps(self.centroids[cat].tolist()),
                    last_updated=datetime.now(timezone.utc)
                )
                db.add(cm)
            db.commit()

        # 2. Load exemplars from LearningSample table
        samples = db.query(LearningSample).all()
        self.total_feedback_samples = len(samples)
        self.total_corrections = sum(1 for s in samples if s.was_corrected)
        
        # Reset exemplars and populate from DB
        for cat in CATEGORIES:
            self.exemplars[cat] = []

        for s in samples:
            cat = s.confirmed_category.upper()
            if cat in self.exemplars and s.feature_vector_json:
                try:
                    vec = np.array(json.loads(s.feature_vector_json), dtype=np.float32)
                    if vec.shape == (VECTOR_DIM,):
                        self.exemplars[cat].append(vec)
                except Exception:
                    pass

        # Update model version based on feedback count
        self.updates_count = self.total_feedback_samples // settings.SAMPLES_BEFORE_UPDATE
        self.model_version = f"v1.{self.updates_count}" if self.updates_count > 0 else "v1.0"
        
        self.save_to_files()

    def update_centroid_online(self, category: str, vector: np.ndarray, db: Optional[Session] = None):
        """
        Online nearest-centroid update:
        new_centroid = (old_centroid * N + vector) / (N + 1)
        """
        cat = category.upper()
        if cat not in self.centroids:
            return

        n = self.sample_counts[cat]
        current = self.centroids[cat]

        # Update running centroid
        updated = (current * n + vector) / (n + 1)
        # Unit-normalize standard space
        norm = np.linalg.norm(updated)
        if norm > 1e-4:
            updated /= norm

        self.centroids[cat] = updated
        self.sample_counts[cat] = n + 1
        self.exemplars[cat].append(vector.copy())
        self.total_feedback_samples += 1
        self.last_updated = datetime.now(timezone.utc).isoformat()

        # Check if 20-sample batch update threshold reached
        if self.total_feedback_samples % settings.SAMPLES_BEFORE_UPDATE == 0:
            self.trigger_batch_model_update()

        # Persist to JSON
        self.save_to_files()

        # Persist to DB if session provided
        if db:
            cm = db.query(CentroidMemory).filter(CentroidMemory.category == cat).first()
            if cm:
                cm.sample_count = float(self.sample_counts[cat])
                cm.centroid_vector_json = json.dumps(updated.tolist())
                cm.last_updated = datetime.now(timezone.utc)
            else:
                cm = CentroidMemory(
                    category=cat,
                    sample_count=float(self.sample_counts[cat]),
                    centroid_vector_json=json.dumps(updated.tolist()),
                    last_updated=datetime.now(timezone.utc)
                )
                db.add(cm)
            db.commit()

    def trigger_batch_model_update(self):
        """
        Recomputes all centroids by averaging all exemplars across FeatureStore.
        Increments minor model version (e.g. v1.0 -> v1.1).
        """
        self.updates_count += 1
        self.model_version = f"v1.{self.updates_count}"

        for cat in CATEGORIES:
            vecs = self.exemplars[cat]
            if len(vecs) > 0:
                avg = np.mean(vecs, axis=0)
                norm = np.linalg.norm(avg)
                if norm > 1e-4:
                    avg /= norm
                self.centroids[cat] = avg.astype(np.float32)
                self.sample_counts[cat] = len(vecs)

        self.save_to_files()

    def remove_sample(self, category: str, vector: np.ndarray, db: Optional[Session] = None):
        """
        Removes an exemplar and recalculates category centroid.
        """
        cat = category.upper()
        if cat in self.exemplars:
            # Find and remove matching vector
            idx_to_remove = -1
            for i, v in enumerate(self.exemplars[cat]):
                if np.allclose(v, vector, atol=1e-3):
                    idx_to_remove = i
                    break
            if idx_to_remove != -1:
                self.exemplars[cat].pop(idx_to_remove)
                self.sample_counts[cat] = len(self.exemplars[cat])
                if len(self.exemplars[cat]) > 0:
                    avg = np.mean(self.exemplars[cat], axis=0)
                    norm = np.linalg.norm(avg)
                    if norm > 1e-4:
                        avg /= norm
                    self.centroids[cat] = avg.astype(np.float32)
                else:
                    self.centroids[cat] = np.zeros(VECTOR_DIM, dtype=np.float32)

                self.save_to_files()
                if db:
                    cm = db.query(CentroidMemory).filter(CentroidMemory.category == cat).first()
                    if cm:
                        cm.sample_count = float(self.sample_counts[cat])
                        cm.centroid_vector_json = json.dumps(self.centroids[cat].tolist())
                        db.commit()

    def reset_all_memory(self, db: Optional[Session] = None):
        """
        Resets all centroids and exemplars to baseline state.
        """
        self.centroids = {cat: np.zeros(VECTOR_DIM, dtype=np.float32) for cat in CATEGORIES}
        self.sample_counts = {cat: 0 for cat in CATEGORIES}
        self.exemplars = {cat: [] for cat in CATEGORIES}
        self.model_version = "v1.0"
        self.updates_count = 0
        self.total_feedback_samples = 0
        self.total_corrections = 0
        self.last_updated = datetime.now(timezone.utc).isoformat()

        self.save_to_files()
        if db:
            db.query(CentroidMemory).delete()
            for cat in CATEGORIES:
                db.add(CentroidMemory(
                    category=cat,
                    sample_count=0.0,
                    centroid_vector_json=json.dumps(self.centroids[cat].tolist()),
                    last_updated=datetime.now(timezone.utc)
                ))
            db.commit()

    def has_learned_memory(self) -> bool:
        return sum(self.sample_counts.values()) > 0 or any(len(v) > 0 for v in self.exemplars.values())

    def save_to_files(self):
        try:
            # 1. classifier.json
            classifier_data = {
                "modelVersion": self.model_version,
                "lastUpdated": self.last_updated,
                "centroids": [
                    {
                        "categoryName": cat,
                        "centroidVector": self.centroids[cat].tolist(),
                        "sampleCount": self.sample_counts[cat]
                    }
                    for cat in CATEGORIES
                ]
            }
            with open(self.classifier_path, "w", encoding="utf-8") as f:
                json.dump(classifier_data, f, indent=2)

            # 2. feature_store.json
            feature_store_data = {
                "collections": [
                    {
                        "categoryName": cat,
                        "vectors": [{"values": v.tolist()} for v in self.exemplars[cat]]
                    }
                    for cat in CATEGORIES
                ]
            }
            with open(self.feature_store_path, "w", encoding="utf-8") as f:
                json.dump(feature_store_data, f, indent=2)

            # 3. ai_state.json
            state_data = {
                "modelVersion": self.model_version,
                "totalFeedbackSamples": self.total_feedback_samples,
                "totalCorrections": self.total_corrections,
                "updatesCount": self.updates_count,
                "lastUpdated": self.last_updated
            }
            with open(self.state_path, "w", encoding="utf-8") as f:
                json.dump(state_data, f, indent=2)

        except Exception as e:
            print(f"[AIMemoryStore] Save warning: {e}")

    def load_from_files(self):
        try:
            if self.classifier_path.exists():
                with open(self.classifier_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.model_version = data.get("modelVersion", "v1.0")
                    self.last_updated = data.get("lastUpdated", self.last_updated)
                    for item in data.get("centroids", []):
                        cat = item.get("categoryName")
                        if cat in self.centroids and "centroidVector" in item:
                            self.centroids[cat] = np.array(item["centroidVector"], dtype=np.float32)
                            self.sample_counts[cat] = item.get("sampleCount", 0)

            if self.feature_store_path.exists():
                with open(self.feature_store_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for col in data.get("collections", []):
                        cat = col.get("categoryName")
                        if cat in self.exemplars:
                            self.exemplars[cat] = [
                                np.array(v["values"], dtype=np.float32)
                                for v in col.get("vectors", [])
                                if "values" in v and len(v["values"]) == VECTOR_DIM
                            ]

            if self.state_path.exists():
                with open(self.state_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.total_feedback_samples = data.get("totalFeedbackSamples", self.total_feedback_samples)
                    self.total_corrections = data.get("totalCorrections", self.total_corrections)
                    self.updates_count = data.get("updatesCount", self.updates_count)

        except Exception as e:
            print(f"[AIMemoryStore] Load warning: {e}")

# Singleton instance
memory_store = AIMemoryStore()
