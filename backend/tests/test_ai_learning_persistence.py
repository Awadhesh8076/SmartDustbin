import numpy as np
from app.core.database import SessionLocal
from app.ai.memory_store import AIMemoryStore
from app.ai.adaptive_classifier import AdaptiveClassifier
from app.models.learning import CentroidMemory

def test_database_restart_persistence(tmp_path):
    db = SessionLocal()
    
    # Create store instance 1
    store1 = AIMemoryStore(model_dir=tmp_path / "model1")
    store1.sync_with_db(db)
    
    # Vector for DRY
    np.random.seed(456)
    dry_vec = np.random.uniform(-0.5, 0.5, 32).astype(np.float32)
    dry_vec -= np.mean(dry_vec)
    dry_vec /= np.linalg.norm(dry_vec)
    
    # Update centroid and persist in DB
    store1.update_centroid_online("DRY", dry_vec, db=db)
    expected_centroid = store1.centroids["DRY"].copy()
    expected_count = store1.sample_counts["DRY"]
    
    # Simulate restart by instantiating a completely new AIMemoryStore instance 2
    store2 = AIMemoryStore(model_dir=tmp_path / "model2")
    store2.sync_with_db(db)
    
    # Verify store2 loaded the exact centroid and count from DB
    assert store2.sample_counts["DRY"] == expected_count
    np.testing.assert_allclose(store2.centroids["DRY"], expected_centroid, atol=1e-4)
    
    # Classify with store2
    classifier2 = AdaptiveClassifier(store2)
    pred = classifier2.classify(expected_centroid)
    assert pred["category"] == "DRY"
    assert pred["confidence"] >= 0.90
    assert pred["confidence_level"] == "HIGH"
    
    db.close()
