import cv2
import numpy as np
from PIL import Image
from api.services.ocr.images import preprocess_image
from api.services.ocr.readers import get_reader

def ocr_region(region: np.ndarray) -> tuple[str, float]:
    """Run EasyOCR on one image region. Returns (text, avg_confidence)."""
    reader = get_reader()
    processed = preprocess_image(region)
    # EasyOCR needs RGB PIL image
    pil = Image.fromarray(processed).convert("RGB")
    arr = np.array(pil)

    results = reader.readtext(arr, detail=1, paragraph=False)
    if not results:
        return "", 0.0

    texts = []
    confidences = []
    for (_, text, conf) in results:
        texts.append(text.strip())
        confidences.append(float(conf))

    combined_text = " ".join(t for t in texts if t)
    avg_conf = float(round(sum(confidences) / len(confidences) * 100, 2))
    return combined_text, avg_conf
