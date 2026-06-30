import numpy as np
from PIL import Image
from config import settings
from api.services.ocr.handwriting import detect_line_boxes, group_line_boxes_by_question, crop_line_from_box
from api.services.ocr.readers import get_trocr

def transcribe_trocr_lines(line_images: list[Image.Image]) -> list[str]:
    if not line_images:
        return []
    import torch

    processor, model, device = get_trocr()
    texts = []
    batch_size = 4
    for i in range(0, len(line_images), batch_size):
        batch = line_images[i:i + batch_size]
        pixel_values = processor(images=batch, return_tensors="pt").pixel_values.to(device)
        with torch.no_grad():
            generated_ids = model.generate(pixel_values, max_length=96)
        texts.extend(processor.batch_decode(generated_ids, skip_special_tokens=True))
    return [text.strip() for text in texts if text and text.strip()]


def trocr_handwriting_ocr(pages: list[np.ndarray], num_questions: int) -> dict | None:
    if settings.OCR_ENGINE.lower() not in {"trocr", "local", "auto"}:
        return None

    try:
        question_lines = [[] for _ in range(num_questions)]
        for page in pages:
            boxes = detect_line_boxes(page)
            groups = group_line_boxes_by_question(boxes, num_questions)
            for idx, group in enumerate(groups):
                question_lines[idx].extend(crop_line_from_box(page, box) for box in group)

        questions = []
        confidences = []
        for idx, line_images in enumerate(question_lines):
            lines = transcribe_trocr_lines(line_images)
            text = " ".join(lines)
            confidence = 78.0 if text else 0.0
            questions.append({"index": idx, "text": text, "confidence": confidence})
            if confidence > 0:
                confidences.append(confidence)

        if not any(q["text"] for q in questions):
            return None

        return {
            "pages_processed": len(pages),
            "questions": questions,
            "overall_confidence": float(round(sum(confidences) / len(confidences), 2)) if confidences else 0.0,
            "error": None,
            "engine": "trocr",
        }
    except Exception as e:
        print(f"[OCR] TrOCR failed, falling back to EasyOCR: {e}")
        return None
