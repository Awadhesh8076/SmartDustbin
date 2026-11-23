import io
import numpy as np
from PIL import Image
from app.ai.preprocessor import preprocess_image, TARGET_WIDTH, TARGET_HEIGHT

def test_preprocess_image_from_bytes():
    # Non-square image 400x200
    img = Image.new("RGB", (400, 200), color=(120, 150, 180))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    
    norm_rgb, disp_rgb = preprocess_image(buf.getvalue())
    
    assert norm_rgb.shape == (TARGET_HEIGHT, TARGET_WIDTH, 3)
    assert disp_rgb.shape == (TARGET_HEIGHT, TARGET_WIDTH, 3)
    assert norm_rgb.dtype == np.float32
    assert disp_rgb.dtype == np.uint8
    assert np.min(norm_rgb) >= 0.0
    assert np.max(norm_rgb) <= 1.0

def test_preprocess_image_square_crop():
    # Verify center crop preserves center pixel region
    arr = np.zeros((300, 500, 3), dtype=np.uint8)
    arr[100:200, 200:300] = 255  # bright center
    
    norm_rgb, _ = preprocess_image(arr)
    assert norm_rgb.shape == (128, 128, 3)
    # Center region should have high values
    assert np.mean(norm_rgb[40:88, 40:88]) > 0.5
