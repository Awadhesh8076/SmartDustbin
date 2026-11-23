"""
32-Dimensional Feature Extractor for SmartDustbin TinyML AI.
Faithfully ported from Assets/Scripts/AI/Runtime/TinyMLInference.cs:
ExtractFeatureEmbedding(Texture2D tex, float[] normalizedPixels)

Vector composition:
0-7:   Hue histogram (8 bins)
8-11:  Saturation histogram (4 bins)
12-15: Brightness/Value histogram (4 bins)
16-19: Quadrant mean Hue (4 quadrants)
20-23: Quadrant mean Saturation (4 quadrants)
24-27: Quadrant edge energy (4 quadrants)
28:    Specular / Metallic reflectance signature (s < 0.15 & v > 0.60)
29:    Organic green / chlorophyll signature (0.18 < h < 0.45 & s > 0.25)
30:    Total edge energy / texture roughness
31:    Color variance sum(|r-g| + |g-b|)
Normalized via Mean-Centering and Unit-Length Standard Space (Pearson embedding).
"""

import numpy as np

VECTOR_DIM = 32

def rgb_to_hsv_numpy(rgb: np.ndarray) -> np.ndarray:
    """
    Converts float RGB [0.0, 1.0] of shape (H, W, 3) to HSV in [0.0, 1.0].
    Follows exact standard formula matching Unity's Color.RGBToHSV:
    H in [0.0, 1.0), S in [0.0, 1.0], V in [0.0, 1.0].
    """
    r = rgb[..., 0]
    g = rgb[..., 1]
    b = rgb[..., 2]

    v = np.maximum(np.maximum(r, g), b)
    min_val = np.minimum(np.minimum(r, g), b)
    delta = v - min_val

    # Saturation
    s = np.where(v > 1e-6, delta / np.maximum(v, 1e-6), 0.0)

    # Hue
    h = np.zeros_like(v)
    delta_safe = np.maximum(delta, 1e-6)

    # Where r == v
    mask_r = (delta > 1e-6) & (r == v)
    h[mask_r] = ((g[mask_r] - b[mask_r]) / delta_safe[mask_r]) % 6.0

    # Where g == v and r != v
    mask_g = (delta > 1e-6) & (g == v) & (~mask_r)
    h[mask_g] = ((b[mask_g] - r[mask_g]) / delta_safe[mask_g]) + 2.0

    # Where b == v and r != v and g != v
    mask_b = (delta > 1e-6) & (b == v) & (~mask_r) & (~mask_g)
    h[mask_b] = ((r[mask_b] - g[mask_b]) / delta_safe[mask_b]) + 4.0

    h = (h / 6.0) % 1.0

    return np.stack([h, s, v], axis=-1).astype(np.float32)


def extract_feature_vector(normalized_rgb: np.ndarray) -> np.ndarray:
    """
    Computes the 32-D feature vector from a normalized RGB image (128, 128, 3).
    Returns float32 vector of length 32 in Pearson standard space.
    """
    assert normalized_rgb.shape == (128, 128, 3), f"Expected shape (128, 128, 3), got {normalized_rgb.shape}"

    hsv = rgb_to_hsv_numpy(normalized_rgb)
    h = hsv[..., 0]
    s = hsv[..., 1]
    v = hsv[..., 2]

    height, width = 128, 128
    total = float(height * width)  # 16384.0

    features = np.zeros(VECTOR_DIM, dtype=np.float32)

    # 1. Hue Bins (8 divisions across 0..1)
    h_bins = np.clip((h * 8.0).astype(np.int32), 0, 7)
    for b in range(8):
        features[b] = np.sum(h_bins == b) / total

    # 2. Saturation Bins (4 divisions across 0..1)
    s_bins = np.clip((s * 4.0).astype(np.int32), 0, 3)
    for b in range(4):
        features[8 + b] = np.sum(s_bins == b) / total

    # 3. Value/Brightness Bins (4 divisions across 0..1)
    v_bins = np.clip((v * 4.0).astype(np.int32), 0, 3)
    for b in range(4):
        features[12 + b] = np.sum(v_bins == b) / total

    # 4. Horizontal Edge Gradient
    # In Unity: grad = |v(x, y) - (0.299*r(x+1, y) + 0.587*g(x+1, y) + 0.114*b(x+1, y))| for x+1 < width
    r = normalized_rgb[..., 0]
    g = normalized_rgb[..., 1]
    b = normalized_rgb[..., 2]
    luma = 0.299 * r + 0.587 * g + 0.114 * b

    # Edge map of shape (128, 128), rightmost column has no right neighbor (0 grad)
    grad_map = np.zeros((128, 128), dtype=np.float32)
    grad_map[:, :-1] = np.abs(v[:, :-1] - luma[:, 1:])

    # 5. Quadrant Moments (2x2 grid)
    # Q0: top-left (y: 0..63, x: 0..63)
    # Q1: top-right (y: 0..63, x: 64..127)
    # Q2: bottom-left (y: 64..127, x: 0..63)
    # Q3: bottom-right (y: 64..127, x: 64..127)
    quadrants = [
        (slice(0, 64), slice(0, 64)),      # Q0
        (slice(0, 64), slice(64, 128)),    # Q1
        (slice(64, 128), slice(0, 64)),    # Q2
        (slice(64, 128), slice(64, 128)),  # Q3
    ]
    q_count = 64.0 * 64.0  # 4096.0

    for q_idx, (y_sl, x_sl) in enumerate(quadrants):
        features[16 + q_idx] = np.sum(h[y_sl, x_sl]) / q_count
        features[20 + q_idx] = np.sum(s[y_sl, x_sl]) / q_count
        features[24 + q_idx] = np.sum(grad_map[y_sl, x_sl]) / q_count

    # 6. High-Level Material Signatures
    # Feature 28: Specular metallic signature (low saturation, high reflectance)
    specular_mask = (s < 0.15) & (v > 0.60)
    features[28] = np.sum(specular_mask) / total

    # Feature 29: Organic green / chlorophyll indicator
    chlorophyll_mask = (h > 0.18) & (h < 0.45) & (s > 0.25)
    features[29] = np.sum(chlorophyll_mask) / total

    # Feature 30: Total edge energy / texture roughness
    features[30] = np.sum(grad_map) / total

    # Feature 31: Color variance sum(|r - g| + |g - b|)
    color_var = np.abs(r - g) + np.abs(g - b)
    features[31] = np.sum(color_var) / total

    # 7. Mean-Center and Unit-Normalize (Pearson Embedding Space)
    # Exactly matching Unity TinyMLInference.cs lines 167-183
    mean = np.mean(features)
    features -= mean
    sq_sum = np.sum(features * features)
    std = np.sqrt(sq_sum)

    if std > 0.0001:
        features /= std

    return features
