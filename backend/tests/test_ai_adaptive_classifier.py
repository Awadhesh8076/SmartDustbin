import numpy as np
from app.ai.memory_store import AIMemoryStore
from app.ai.adaptive_classifier import AdaptiveClassifier, compute_pearson_similarity

def test_zero_guessing_policy_on_empty_memory(tmp_path):
    mem = AIMemoryStore(model_dir=tmp_path)
    classifier = AdaptiveClassifier(mem)
    
    vec = np.random.uniform(-0.5, 0.5, 32).astype(np.float32)
    vec -= np.mean(vec)
    vec /= np.linalg.norm(vec)
    
    pred = classifier.classify(vec)
    assert pred["category"] == "UNKNOWN"
    assert pred["confidence"] == 0.0
    assert pred["confidence_level"] == "LOW"
    assert pred["requires_user_label"] is True
    assert pred["is_known_in_memory"] is False
    assert pred["probabilities"]["PLASTIC"] == 0.25

def test_adaptive_online_learning_and_recall(tmp_path):
    mem = AIMemoryStore(model_dir=tmp_path)
    classifier = AdaptiveClassifier(mem)
    
    # Vector representing a sample
    np.random.seed(42)
    vec = np.random.uniform(-0.5, 0.5, 32).astype(np.float32)
    vec -= np.mean(vec)
    vec /= np.linalg.norm(vec)
    
    # 1. Before teaching: Unknown
    assert classifier.classify(vec)["category"] == "UNKNOWN"
    
    # 2. Teach category PLASTIC
    mem.update_centroid_online("PLASTIC", vec)
    
    # 3. Classify identical vector -> Recognized with High Confidence
    pred = classifier.classify(vec)
    assert pred["category"] == "PLASTIC"
    assert pred["confidence"] >= 0.90
    assert pred["confidence_level"] == "HIGH"
    assert pred["requires_user_label"] is False
    assert pred["is_known_in_memory"] is True

def test_pearson_similarity_computation():
    a = np.array([1.0, 0.0, -1.0], dtype=np.float32)
    a -= np.mean(a)
    a /= np.linalg.norm(a)
    
    # Identical
    assert abs(compute_pearson_similarity(a, a) - 1.0) < 1e-4
    # Opposite
    assert abs(compute_pearson_similarity(a, -a) - (-1.0)) < 1e-4
