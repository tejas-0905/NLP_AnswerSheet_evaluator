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

    sorted_results = sorted(
        results,
        key=lambda item: (
            min(point[1] for point in item[0]),
            min(point[0] for point in item[0]),
        ),
    )

    lines = []
    confidences = []
    current_line = []
    current_y = None
    for (box, text, conf) in sorted_results:
        text = text.strip()
        if not text:
            continue
        y_center = sum(point[1] for point in box) / len(box)
        if current_y is not None and abs(y_center - current_y) > 18:
            if current_line:
                lines.append(" ".join(current_line))
            current_line = [text]
            current_y = y_center
        else:
            current_line.append(text)
            current_y = y_center if current_y is None else (current_y + y_center) / 2
        confidences.append(float(conf))

    if current_line:
        lines.append(" ".join(current_line))

    combined_text = "\n".join(lines)
    avg_conf = float(round(sum(confidences) / len(confidences) * 100, 2))
    return combined_text, avg_conf
