"""
Adaptive Memory-Based Waste Classifier.
Faithfully ported from Assets/Scripts/AI/Learning/AdaptiveClassifier.cs
and Assets/Scripts/AI/Runtime/TinyMLInference.cs.

Enforces:
- Pearson correlation similarity matching in standard space
- Centroid + Exemplar (k-NN) query
- Strict Zero-Guessing Policy (r < 0.70 -> UNKNOWN, confidence = 0.0)
- Softmax probability distribution when recognized
"""

from typing import Dict, Tuple, Optional
import numpy as np
from app.ai.memory_store import AIMemoryStore, CATEGORIES, memory_store

SIMILARITY_THRESHOLD = 0.70  # Zero-guessing boundary matching Unity AIConfig

def compute_pearson_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """
    Computes cosine similarity between two zero-mean, unit-normalized vectors.
    Mathematically identical to Pearson Correlation r in [-1.0, 1.0].
    """
    if a is None or b is None or len(a) != len(b):
        return 0.0

    mag_a = np.linalg.norm(a)
    mag_b = np.linalg.norm(b)

    if mag_a < 1e-6 or mag_b < 1e-6:
        return 0.0

    dot = np.dot(a, b)
    sim = dot / (mag_a * mag_b)
    return float(np.clip(sim, -1.0, 1.0))


def softmax(logits: np.ndarray) -> np.ndarray:
    """Standard numerically stable softmax."""
    exps = np.exp(logits - np.max(logits))
    sum_exps = np.sum(exps)
    return exps / (sum_exps if sum_exps > 0 else 1.0)


class AdaptiveClassifier:
    def __init__(self, memory: AIMemoryStore):
        self.memory = memory

    def find_best_memory_match(self, feature_vector: np.ndarray) -> Tuple[bool, str, float]:
        """
        Queries learned centroids and k-NN exemplars across all categories.
        Returns:
            (is_recognized, matched_category, best_similarity)
        """
        best_similarity = -1.0
        matched_category = "UNKNOWN"

        for cat in CATEGORIES:
            # 1. Centroid similarity
            if self.memory.sample_counts[cat] > 0:
                sim = compute_pearson_similarity(feature_vector, self.memory.centroids[cat])
                if sim > best_similarity:
                    best_similarity = sim
                    matched_category = cat

            # 2. Exemplar k-NN similarity
            for exemplar in self.memory.exemplars[cat]:
                ex_sim = compute_pearson_similarity(feature_vector, exemplar)
                if ex_sim > best_similarity:
                    best_similarity = ex_sim
                    matched_category = cat

        # Zero-guessing gate: strictly require r >= 0.70 in Pearson space
        if best_similarity >= SIMILARITY_THRESHOLD and matched_category != "UNKNOWN":
            return True, matched_category, best_similarity

        return False, "UNKNOWN", max(0.0, best_similarity)

    def classify(self, feature_vector: np.ndarray) -> Dict:
        """
        Executes full inference matching against adaptive memory.
        Returns prediction dictionary matching Unity WastePrediction DTO.
        """
        is_recognized, matched_cat, similarity = self.find_best_memory_match(feature_vector)

        if is_recognized:
            # Item recognized with High Confidence from trained memory
            cat_idx = CATEGORIES.index(matched_cat)
            logits = np.full(len(CATEGORIES), 0.01, dtype=np.float32)
            logits[cat_idx] = similarity * 5.0
            probabilities = softmax(logits)

            confidence = float(np.clip(similarity, 0.90, 0.99))
            prob_dict = {cat: float(probabilities[i]) for i, cat in enumerate(CATEGORIES)}

            return {
                "category": matched_cat,
                "confidence": round(confidence, 4),
                "confidence_level": "HIGH",
                "probabilities": prob_dict,
                "feature_vector": feature_vector.tolist(),
                "is_known_in_memory": True,
                "similarity": round(similarity, 4),
                "model_version": self.memory.model_version,
                "requires_user_label": False,
                "message": f"Recognized as {matched_cat} from AI memory (r={similarity:.2f})"
            }
        else:
            # Item is UNRECOGNIZED (Zero Guessing Policy)
            prob_dict = {cat: 0.25 for cat in CATEGORIES}

            return {
                "category": "UNKNOWN",
                "confidence": 0.0,
                "confidence_level": "LOW",
                "probabilities": prob_dict,
                "feature_vector": feature_vector.tolist(),
                "is_known_in_memory": False,
                "similarity": round(similarity, 4),
                "model_version": self.memory.model_version,
                "requires_user_label": True,
                "message": "Unrecognized material in trained memory. User labeling required."
            }

classifier = AdaptiveClassifier(memory_store)

