import base64
import io
import cv2
import numpy as np
from PIL import Image
import requests
from config import settings
from api.services.ocr.images import detect_question_regions
from api.services.ocr.text_utils import normalize_ocr_text, split_text_by_question_numbers

def image_to_base64_data_url(image: Image.Image, filename: str = "answer.jpg") -> str:
    image = image.convert("RGB")
    buf = io.BytesIO()
    image.save(buf, format="JPEG", quality=92)
    encoded = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"


def parse_ocrspace_response(payload: dict) -> tuple[str, float]:
    if payload.get("IsErroredOnProcessing"):
        error = payload.get("ErrorMessage") or payload.get("ErrorDetails") or "OCR.space processing failed"
        if isinstance(error, list):
            error = " ".join(str(item) for item in error)
        raise ValueError(str(error))

    parsed_results = payload.get("ParsedResults") or []
    texts = []
    confidences = []
    for item in parsed_results:
        text = normalize_ocr_text(str(item.get("ParsedText") or ""))
        if text:
            texts.append(text)
        exit_code = int(item.get("FileParseExitCode") or 0)
        if exit_code == 1:
            confidences.append(88.0)
        elif exit_code == 2:
            confidences.append(65.0)
        elif text:
            confidences.append(55.0)

    combined_text = normalize_ocr_text("\n".join(texts))
    confidence = float(round(sum(confidences) / len(confidences), 2)) if confidences else 0.0
    return combined_text, confidence

def ocrspace_region(region: np.ndarray) -> tuple[str, float]:
    if not settings.OCRSPACE_API_KEY:
        return "", 0.0

    rgb = cv2.cvtColor(region, cv2.COLOR_BGR2RGB)
    pil = Image.fromarray(rgb).convert("RGB")
    payload = {
        "base64Image": image_to_base64_data_url(pil),
        "language": settings.OCRSPACE_LANGUAGE,
        "isOverlayRequired": "false",
        "detectOrientation": "true",
        "scale": "true",
        "OCREngine": str(settings.OCRSPACE_ENGINE),
    }
    response = requests.post(
        settings.OCRSPACE_API_URL,
        headers={"apikey": settings.OCRSPACE_API_KEY},
        data=payload,
        timeout=settings.OCRSPACE_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return parse_ocrspace_response(response.json())


def ocrspace_answer_sheet(pages: list[np.ndarray], num_questions: int) -> dict | None:
    if settings.OCR_ENGINE.lower() not in {"ocrspace", "ocr.space", "ocr_space", "api", "auto"}:
        return None

    try:
        page_texts = []
        confidences = []
        for page in pages:
            text, confidence = ocrspace_region(page)
            if text:
                page_texts.append(text)
            if confidence > 0:
                confidences.append(confidence)

        full_text = normalize_ocr_text("\n".join(page_texts))
        split_answers = split_text_by_question_numbers(full_text, num_questions)
        if split_answers is not None:
            confidence = float(round(sum(confidences) / len(confidences), 2)) if confidences else 0.0
            return {
                "pages_processed": len(pages),
                "questions": [
                    {
                        "index": idx,
                        "text": answer,
                        "confidence": confidence if answer.strip() else 100.0,
                    }
                    for idx, answer in enumerate(split_answers)
                ],
                "overall_confidence": confidence,
                "error": None,
                "engine": "ocrspace",
            }

        if len(pages) > 1:
            resized = []
            target_w = pages[0].shape[1]
            for page in pages:
                if page.shape[1] != target_w:
                    scale = target_w / page.shape[1]
                    page = cv2.resize(page, (target_w, int(page.shape[0] * scale)))
                resized.append(page)
            full_image = np.vstack(resized)
        else:
            full_image = pages[0]

        regions = detect_question_regions(full_image, num_questions)
        questions = []
        region_confidences = []
        for idx, region in enumerate(regions):
            text, confidence = ocrspace_region(region)
            questions.append({"index": idx, "text": text, "confidence": confidence})
            if confidence > 0:
                region_confidences.append(confidence)

        if not any(q["text"] for q in questions):
            return None

        return {
            "pages_processed": len(pages),
            "questions": questions,
            "overall_confidence": float(round(sum(region_confidences) / len(region_confidences), 2)) if region_confidences else 0.0,
            "error": None,
            "engine": "ocrspace",
        }
    except Exception as e:
        print(f"[OCR] OCR.space failed, falling back to the next OCR engine: {e}")
        return None
