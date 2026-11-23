import numpy as np
from app.ai.feature_extractor import extract_feature_vector, rgb_to_hsv_numpy, VECTOR_DIM

def test_feature_extractor_dimensions_and_normalization():
    # Test across random and solid colors
    for seed in [1, 42, 99]:
        np.random.seed(seed)
        img = np.random.uniform(0.0, 1.0, (128, 128, 3)).astype(np.float32)
        vec = extract_feature_vector(img)
        
        assert vec.shape == (VECTOR_DIM,)
        assert abs(float(np.mean(vec))) < 1e-4, f"Mean must be ~0, got {np.mean(vec)}"
        assert abs(float(np.linalg.norm(vec)) - 1.0) < 1e-3, f"Norm must be ~1.0, got {np.linalg.norm(vec)}"

def test_pearson_self_correlation_is_unity():
    img = np.full((128, 128, 3), [0.8, 0.2, 0.1], dtype=np.float32)
    vec = extract_feature_vector(img)
    # Self dot-product in standard space equals Pearson r == 1.0
    r = float(np.dot(vec, vec))
    assert abs(r - 1.0) < 1e-4, f"Self-correlation must be 1.0, got {r}"

def test_hsv_conversion_fidelity():
    # Pure Red: H=0, S=1, V=1
    red = np.array([[[1.0, 0.0, 0.0]]], dtype=np.float32)
    hsv_red = rgb_to_hsv_numpy(red)
    assert abs(hsv_red[0, 0, 0] - 0.0) < 1e-3
    assert abs(hsv_red[0, 0, 1] - 1.0) < 1e-3
    assert abs(hsv_red[0, 0, 2] - 1.0) < 1e-3

    # Pure Green: H=1/3, S=1, V=1
    green = np.array([[[0.0, 1.0, 0.0]]], dtype=np.float32)
    hsv_green = rgb_to_hsv_numpy(green)
    assert abs(hsv_green[0, 0, 0] - (1.0 / 3.0)) < 1e-3
    assert abs(hsv_green[0, 0, 1] - 1.0) < 1e-3
