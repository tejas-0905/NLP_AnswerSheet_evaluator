import base64
import io
import cv2
import numpy as np
from PIL import Image
from config import settings
from api.services.ocr.text_utils import extract_json_object

def pil_to_data_url(image: Image.Image) -> str:
    image = image.convert("RGB")
    image.thumbnail((1400, 1800), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    image.save(buf, format="JPEG", quality=90)
    encoded = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"

def openai_handwriting_ocr(pages: list[np.ndarray], num_questions: int) -> dict | None:
    if settings.OCR_ENGINE.lower() not in {"openai", "vision", "auto"}:
        return None
    if not settings.OPENAI_API_KEY:
        return None

    try:
        from openai import OpenAI
    except ImportError:
        print("[OCR] OpenAI package is not installed, falling back to EasyOCR.")
        return None

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    content = [{
        "type": "text",
        "text": (
            "You are an OCR engine for handwritten student answer sheets. "
            "Transcribe the handwritten answers clearly and split them by question number. "
            "Do not grade. Do not summarize. Preserve the student's wording, but fix only obvious OCR character confusions. "
            f"Return JSON only with exactly {num_questions} items: "
            '{"questions":[{"index":0,"text":"...","confidence":95.0}],"overall_confidence":95.0}. '
            "Use zero-based indexes. If an answer is not visible, use an empty string and low confidence."
        ),
    }]

    for page in pages:
        rgb = cv2.cvtColor(page, cv2.COLOR_BGR2RGB)
        pil = Image.fromarray(rgb)
        content.append({
            "type": "image_url",
            "image_url": {"url": pil_to_data_url(pil)},
        })

    try:
        response = client.chat.completions.create(
            model=settings.OPENAI_OCR_MODEL,
            messages=[{"role": "user", "content": content}],
            response_format={"type": "json_object"},
            temperature=0,
        )
        payload = extract_json_object(response.choices[0].message.content or "{}")
    except Exception as e:
        print(f"[OCR] OpenAI handwriting OCR failed, falling back to EasyOCR: {e}")
        return None

    raw_questions = payload.get("questions", [])
    by_index = {}
    for item in raw_questions:
        try:
            idx = int(item.get("index"))
        except (TypeError, ValueError):
            continue
        by_index[idx] = {
            "index": idx,
            "text": str(item.get("text") or "").strip(),
            "confidence": float(item.get("confidence") or 0),
        }

    questions = []
    confidences = []
    for idx in range(num_questions):
        item = by_index.get(idx, {"index": idx, "text": "", "confidence": 0.0})
        questions.append(item)
        if item["confidence"] > 0:
            confidences.append(item["confidence"])

    overall_confidence = float(payload.get("overall_confidence") or 0)
    if not overall_confidence and confidences:
        overall_confidence = float(round(sum(confidences) / len(confidences), 2))

    return {
        "pages_processed": len(pages),
        "questions": questions,
        "overall_confidence": overall_confidence,
        "error": None,
        "engine": "openai_vision",
    }
