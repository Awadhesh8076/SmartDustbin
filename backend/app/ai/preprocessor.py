"""
Image Preprocessor for SmartDustbin TinyML AI.
Faithfully ported from Assets/Scripts/AI/Runtime/ImagePreprocessor.cs:
- Center-crop to aspect ratio 1:1
- Bilinear resize to 128x128
- Normalized RGB pixels to [0.0, 1.0]
"""

import io
from typing import Tuple, Union
import numpy as np
import cv2
from PIL import Image

TARGET_WIDTH = 128
TARGET_HEIGHT = 128

def preprocess_image(
    image_input: Union[bytes, np.ndarray, Image.Image],
    target_size: Tuple[int, int] = (TARGET_WIDTH, TARGET_HEIGHT)
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Takes image bytes, numpy array, or PIL Image.
    Returns:
        normalized_rgb: Float32 numpy array shape (128, 128, 3) in [0.0, 1.0]
        display_rgb: Uint8 numpy array shape (128, 128, 3) in [0, 255]
    """
    if isinstance(image_input, bytes):
        pil_img = Image.open(io.BytesIO(image_input)).convert("RGB")
        img_np = np.array(pil_img)
    elif isinstance(image_input, Image.Image):
        img_np = np.array(image_input.convert("RGB"))
    elif isinstance(image_input, np.ndarray):
        img_np = image_input.copy()
        if len(img_np.shape) == 2:
            img_np = cv2.cvtColor(img_np, cv2.COLOR_GRAY2RGB)
        elif img_np.shape[2] == 4:
            img_np = cv2.cvtColor(img_np, cv2.COLOR_RGBA2RGB)
    else:
        raise ValueError(f"Unsupported image input type: {type(image_input)}")

    src_height, src_width = img_np.shape[:2]

    # Center-crop to square matching Unity ResizeAndCenterCrop
    crop_size = min(src_width, src_height)
    crop_x = (src_width - crop_size) // 2
    crop_y = (src_height - crop_size) // 2

    cropped = img_np[crop_y : crop_y + crop_size, crop_x : crop_x + crop_size]

    # Bilinear resize to target_size (128x128)
    resized = cv2.resize(cropped, target_size, interpolation=cv2.INTER_LINEAR)

    # Normalized float array [0.0, 1.0]
    normalized_rgb = resized.astype(np.float32) / 255.0

    return normalized_rgb, resized
