# SmartDustbin — TinyML AI Engine & Mathematical Specification

This document details the exact mathematical algorithms, feature vector definitions, normalization formulas, and online learning mechanisms ported from the original Unity C# codebase (`TinyMLInference.cs`, `AdaptiveClassifier.cs`, `ImagePreprocessor.cs`).

---

## 1. Image Preprocessing Pipeline (`preprocessor.py`)

Every input frame undergoes a deterministic 3-stage transformation:

1. **Aspect Ratio Center-Crop (1:1):**
   Given image dimensions $W \times H$:
   $$\text{crop\_dim} = \min(W, H)$$
   $$\text{offset}_x = \frac{W - \text{crop\_dim}}{2}, \quad \text{offset}_y = \frac{H - \text{crop\_dim}}{2}$$
   Extract bounding box: $[\text{offset}_x, \text{offset}_y, \text{crop\_dim}, \text{crop\_dim}]$.

2. **Bilinear Resize (128 × 128):**
   The square crop is resized to exactly $128 \times 128$ RGB using OpenCV `cv2.INTER_LINEAR`.

3. **Pixel Normalization:**
   Raw pixel intensities $P \in [0, 255]$ are scaled to float32 values in $[0.0, 1.0]$:
   $$\hat{P} = \frac{P}{255.0}$$

---

## 2. 32-Dimensional Feature Extraction (`feature_extractor.py`)

The feature vector $F \in \mathbb{R}^{32}$ contains 10 distinct mathematical descriptors:

```
Indices  Description                     Features
------------------------------------------------------
[0..7]   Hue Histogram Bins              8 features
[8..11]  Saturation Histogram Bins       4 features
[12..15] Value / Brightness Bins         4 features
[16..19] Quadrant Mean Hue (2x2 Grid)    4 features
[20..23] Quadrant Mean Saturation        4 features
[24..27] Quadrant Mean Edge Energy       4 features
[28]     Specular / Metallic Signature   1 feature
[29]     Green / Chlorophyll Signature   1 feature
[30]     Total Edge Energy (Roughness)   1 feature
[31]     Color Variance Across Channels  1 feature
------------------------------------------------------
Total: 32 Floating-Point Dimensions
```

### Mathematical Definitions:

1. **RGB to HSV Conversion:**
   $$V = \max(R, G, B), \quad \Delta = V - \min(R, G, B)$$
   $$S = \begin{cases} 0 & \text{if } V = 0 \\ \frac{\Delta}{V} & \text{otherwise} \end{cases}$$
   $$H = \begin{cases} 
   0 & \text{if } \Delta = 0 \\
   \frac{G - B}{6\Delta} \pmod 1 & \text{if } V = R \\
   \frac{B - R + 2\Delta}{6\Delta} & \text{if } V = G \\
   \frac{R - G + 4\Delta}{6\Delta} & \text{if } V = B 
   \end{cases}$$

2. **Specular / Metallic Signature ($F_{28}$):**
   Fraction of pixels with low saturation and high brightness (typical of reflections on aluminum/steel):
   $$F_{28} = \frac{1}{N} \sum_{i=1}^N \mathbf{1}(S_i < 0.15 \land V_i > 0.60)$$

3. **Green / Chlorophyll Signature ($F_{29}$):**
   Fraction of pixels in the vegetative hue band with sufficient saturation (typical of organic/wet waste):
   $$F_{29} = \frac{1}{N} \sum_{i=1}^N \mathbf{1}(0.18 < H_i < 0.45 \land S_i > 0.25)$$

4. **Edge Energy (Sobel-like Horizontal Gradient):**
   $$E(x, y) = |V(x, y) - (0.299 R(x+1, y) + 0.587 G(x+1, y) + 0.114 B(x+1, y))|$$

5. **Color Variance ($F_{31}$):**
   $$F_{31} = \frac{1}{N} \sum_{i=1}^N (|R_i - G_i| + |G_i - B_i|)$$

---

## 3. Pearson Standard Space Normalization

The raw 32-D vector $F$ is mapped into standard space ($\hat{F}$):

1. **Mean-Centering:**
   $$\mu = \frac{1}{32} \sum_{j=0}^{31} F_j, \quad \tilde{F}_j = F_j - \mu$$

2. **Unit Euclidean Normalization:**
   $$\sigma = \sqrt{\sum_{j=0}^{31} \tilde{F}_j^2}$$
   $$\hat{F} = \begin{cases} \frac{\tilde{F}}{\sigma} & \text{if } \sigma > 10^{-7} \\ \mathbf{0} & \text{otherwise} \end{cases}$$

**Fundamental Property:**  
For any two normalized vectors $\hat{F}_A$ and $\hat{F}_B$ in this space, their dot product **strictly equals the Pearson correlation coefficient**:
$$r(A, B) = \hat{F}_A \cdot \hat{F}_B = \sum_{j=0}^{31} \hat{F}_{A, j} \hat{F}_{B, j} \quad \in [-1.0, 1.0]$$

---

## 4. Classification & Zero-Guessing Policy (`adaptive_classifier.py`)

1. **Pearson Similarity Matching:**
   The input vector $\hat{F}$ is compared against all category centroids $C_k$ and exemplar memories $E_k$:
   $$r_k = \max \left( \hat{F} \cdot C_k, \max_{e \in E_k} (\hat{F} \cdot e) \right)$$

2. **Zero-Guessing Gate:**
   $$r_{\max} = \max_{k} r_k, \quad k^* = \arg\max_{k} r_k$$
   $$\text{Prediction} = \begin{cases}
   k^* & \text{if } r_{\max} \ge 0.70 \text{ and memory exists} \\
   \text{UNKNOWN} & \text{if } r_{\max} < 0.70 \text{ or empty memory}
   \end{cases}$$

3. **Confidence Mapping:**
   When recognized ($r_{\max} \ge 0.70$):
   $$\text{Confidence} = \min(0.99, \max(0.90, r_{\max}))$$
   When UNKNOWN:
   $$\text{Confidence} = 0.0$$

---

## 5. 1-Shot Online Continual Adaptation (`memory_store.py`)

When the user confirms or corrects a category with vector $F$:

1. **Running Centroid Update:**
   $$C_{\text{new}} = \text{Normalize}\left( \frac{C_{\text{old}} \cdot N + F}{N + 1} \right)$$
   where $N$ is the sample count for that category.

2. **Dual-Persistence:**
   - Centroid vectors and sample counts are saved to SQLite (`centroid_memories`).
   - JSON snapshots are written atomically to `storage/model/classifier.json` and `storage/model/feature_store.json`.
   - On server restart, SQLite records are synchronized automatically into memory.
