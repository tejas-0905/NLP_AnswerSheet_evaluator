import os
import io
import re
import base64
import json
from difflib import SequenceMatcher
import cv2
import numpy as np
from PIL import Image
import requests
import easyocr
from config import settings

_reader = None
_trocr = None

def get_reader():
    global _reader
    if _reader is None:
        print("[OCR] Loading EasyOCR model (first time takes ~30s)...")
        _reader = easyocr.Reader(["en"], gpu=False)
        print("[OCR] Model ready.")
    return _reader


def get_trocr():
    global _trocr
    if _trocr is None:
        print(f"[OCR] Loading TrOCR model {settings.TROCR_MODEL} (first time may download model files)...")
        import torch
        from transformers import TrOCRProcessor, VisionEncoderDecoderModel

        processor = TrOCRProcessor.from_pretrained(settings.TROCR_MODEL, local_files_only=True)
        model = VisionEncoderDecoderModel.from_pretrained(settings.TROCR_MODEL, local_files_only=True)
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model.to(device)
        model.eval()
        _trocr = (processor, model, device)
        print(f"[OCR] TrOCR model ready on {device}.")
    return _trocr


def preprocess_image(image: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Denoise
    denoised = cv2.fastNlMeansDenoising(gray, h=15)

    # Deskew
    coords = np.column_stack(np.where(denoised < 200))
    if len(coords) > 0:
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle
        if abs(angle) > 0.5:
            h, w = denoised.shape
            M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
            denoised = cv2.warpAffine(
                denoised, M, (w, h),
                flags=cv2.INTER_CUBIC,
                borderMode=cv2.BORDER_REPLICATE,
            )

    # Adaptive binarization
    binary = cv2.adaptiveThreshold(
        denoised, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 31, 15,
    )
    return binary


def load_image_bytes(file_bytes: bytes, filename: str) -> list[np.ndarray]:
    """Returns list of numpy images (one per page for PDF, one for image)."""
    fname = filename.lower()

    if fname.endswith(".pdf"):
        pil_pages = render_pdf_pages(file_bytes)
        pages = []
        for p in pil_pages:
            arr = np.array(p.convert("RGB"))
            pages.append(cv2.cvtColor(arr, cv2.COLOR_RGB2BGR))
        return pages

    arr = np.frombuffer(file_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image file")
    return [img]


def render_pdf_pages(file_bytes: bytes) -> list[Image.Image]:
    try:
        import pypdfium2 as pdfium

        pdf = pdfium.PdfDocument(file_bytes)
        pages = []
        try:
            for page in pdf:
                bitmap = page.render(scale=250 / 72)
                pages.append(bitmap.to_pil())
                page.close()
        finally:
            pdf.close()
        return pages
    except Exception:
        try:
            from pdf2image import convert_from_bytes

            return convert_from_bytes(file_bytes, dpi=250)
        except Exception as e:
            raise ValueError(
                "Could not render PDF. Upload a JPG/PNG/WEBP image, or install Poppler for PDF support."
            ) from e


def detect_question_regions(image: np.ndarray, num_questions: int) -> list[np.ndarray]:
    """
    Splits the image into equal horizontal bands — one per question.
    For production you could use line detection, but equal bands work
    reliably for standard answer sheets with one question per section.
    """
    h, w = image.shape[:2]
    band_h = h // num_questions
    regions = []
    for i in range(num_questions):
        y1 = i * band_h
        y2 = (i + 1) * band_h if i < num_questions - 1 else h
        regions.append(image[y1:y2, :])
    return regions


def handwriting_mask(image: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    b, g, r = cv2.split(image)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Blue pen ink in notebook photos usually lives in this hue range.
    hsv_blue = cv2.inRange(hsv, np.array([80, 10, 20]), np.array([170, 255, 240]))
    blue_dominant = (
        (b.astype(np.int16) > r.astype(np.int16) + 8)
        & (b.astype(np.int16) > g.astype(np.int16) - 4)
        & (gray < 225)
    ).astype(np.uint8) * 255

    mask = cv2.bitwise_and(hsv_blue, blue_dominant)
    mask = cv2.medianBlur(mask, 3)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(40, image.shape[1] // 12), 1))
    ruled_lines = cv2.morphologyEx(mask, cv2.MORPH_OPEN, horizontal_kernel)
    mask = cv2.subtract(mask, ruled_lines)
    return mask


def crop_to_ink(image: np.ndarray, mask: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    ys, xs = np.where(mask > 0)
    if len(xs) == 0 or len(ys) == 0:
        return image, mask

    h, w = image.shape[:2]
    x1 = max(int(xs.min()) - 30, 0)
    x2 = min(int(xs.max()) + 30, w)
    y1 = max(int(ys.min()) - 30, 0)
    y2 = min(int(ys.max()) + 30, h)
    return image[y1:y2, x1:x2], mask[y1:y2, x1:x2]


def detect_handwriting_lines(image: np.ndarray) -> list[np.ndarray]:
    mask = handwriting_mask(image)
    image, mask = crop_to_ink(image, mask)
    h, w = mask.shape[:2]
    if h == 0 or w == 0:
        return []

    row_counts = (mask > 0).sum(axis=1)
    active = row_counts > max(20, int(w * 0.055))

    raw_bands = []
    start = None
    for y, is_active in enumerate(active):
        if is_active and start is None:
            start = y
        elif not is_active and start is not None:
            raw_bands.append((start, y))
            start = None
    if start is not None:
        raw_bands.append((start, h))

    merged = []
    for y1, y2 in raw_bands:
        if not merged or y1 - merged[-1][1] > 8:
            merged.append([y1, y2])
        else:
            merged[-1][1] = y2

    lines = []
    for y1, y2 in merged:
        if y2 - y1 < 8:
            continue
        band = mask[y1:y2, :]
        cols = np.where((band > 0).sum(axis=0) > 0)[0]
        if len(cols) == 0:
            continue

        x1 = max(int(cols.min()) - 18, 0)
        x2 = min(int(cols.max()) + 18, w)
        yy1 = max(y1 - 10, 0)
        yy2 = min(y2 + 10, h)
        if x2 - x1 < 35:
            continue
        lines.append(image[yy1:yy2, x1:x2])

    return lines


def split_lines_by_question(lines: list[np.ndarray], num_questions: int) -> list[list[np.ndarray]]:
    if not lines:
        return [[] for _ in range(num_questions)]
    if num_questions <= 1:
        return [lines]

    heights = [line.shape[0] for line in lines]
    # Without original y-coordinates, use roughly even grouping as fallback.
    group_size = max(1, int(np.ceil(len(lines) / num_questions)))
    groups = [lines[i * group_size:(i + 1) * group_size] for i in range(num_questions)]
    while len(groups) < num_questions:
        groups.append([])
    return groups[:num_questions]


def detect_line_boxes(image: np.ndarray) -> list[tuple[int, int, int, int]]:
    mask = handwriting_mask(image)
    image, mask = crop_to_ink(image, mask)
    h, w = mask.shape[:2]
    if h == 0 or w == 0:
        return []

    row_counts = (mask > 0).sum(axis=1)
    active = row_counts > max(20, int(w * 0.055))
    bands = []
    start = None
    for y, is_active in enumerate(active):
        if is_active and start is None:
            start = y
        elif not is_active and start is not None:
            bands.append((start, y))
            start = None
    if start is not None:
        bands.append((start, h))

    merged = []
    for y1, y2 in bands:
        if not merged or y1 - merged[-1][1] > 8:
            merged.append([y1, y2])
        else:
            merged[-1][1] = y2

    boxes = []
    for y1, y2 in merged:
        if y2 - y1 < 8:
            continue
        band = mask[y1:y2, :]
        cols = np.where((band > 0).sum(axis=0) > 0)[0]
        if len(cols) == 0:
            continue
        x1 = max(int(cols.min()) - 18, 0)
        x2 = min(int(cols.max()) + 18, w)
        yy1 = max(y1 - 10, 0)
        yy2 = min(y2 + 10, h)
        if x2 - x1 >= 35:
            box_h = yy2 - yy1
            if box_h > 72:
                line_count = max(2, int(round(box_h / 44)))
                step = box_h / line_count
                for i in range(line_count):
                    sub_y1 = max(int(yy1 + i * step) - 4, 0)
                    sub_y2 = min(int(yy1 + (i + 1) * step) + 4, h)
                    if sub_y2 - sub_y1 >= 18:
                        boxes.append((x1, sub_y1, x2, sub_y2))
            else:
                boxes.append((x1, yy1, x2, yy2))
    return boxes


def group_line_boxes_by_question(boxes: list[tuple[int, int, int, int]], num_questions: int) -> list[list[tuple[int, int, int, int]]]:
    if not boxes:
        return [[] for _ in range(num_questions)]
    boxes = sorted(boxes, key=lambda b: b[1])
    if num_questions <= 1:
        return [boxes]

    gaps = []
    for i in range(len(boxes) - 1):
        gaps.append((boxes[i + 1][1] - boxes[i][3], i))

    split_after = sorted(
        [idx for gap, idx in sorted(gaps, reverse=True)[:num_questions - 1]]
    )

    groups = []
    start = 0
    for idx in split_after:
        groups.append(boxes[start:idx + 1])
        start = idx + 1
    groups.append(boxes[start:])

    while len(groups) < num_questions:
        groups.append([])
    return groups[:num_questions]


def crop_line_from_box(image: np.ndarray, box: tuple[int, int, int, int]) -> Image.Image:
    mask = handwriting_mask(image)
    cropped_image, _ = crop_to_ink(image, mask)
    x1, y1, x2, y2 = box
    line = cropped_image[y1:y2, x1:x2]
    rgb = cv2.cvtColor(line, cv2.COLOR_BGR2RGB)
    pil = Image.fromarray(rgb).convert("RGB")
    if pil.height < 64:
        scale = 64 / max(pil.height, 1)
        pil = pil.resize((max(1, int(pil.width * scale)), 64), Image.Resampling.BICUBIC)
    return pil


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


def pil_to_data_url(image: Image.Image) -> str:
    image = image.convert("RGB")
    image.thumbnail((1400, 1800), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    image.save(buf, format="JPEG", quality=90)
    encoded = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"


def extract_json_object(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise
        return json.loads(text[start:end + 1])


def expected_ocr_vocabulary(question_text: str, model_answer: str, required_concepts: str | None = None) -> set[str]:
    source = f"{question_text or ''} {model_answer or ''} {required_concepts or ''}".lower()
    words = re.findall(r"[a-z][a-z0-9]{3,}", source)
    stop_words = {
        "this", "that", "with", "from", "into", "used", "uses", "their", "there",
        "then", "than", "also", "such", "which", "when", "where", "what", "why",
        "does", "done", "have", "will", "were", "they", "them", "four", "two",
        "main", "give", "example", "explain", "answer", "question",
    }
    return {word for word in words if word not in stop_words}


def correct_ocr_text_with_context(
    text: str,
    question_text: str,
    model_answer: str,
    required_concepts: str | None = None,
) -> str:
    if not text:
        return ""

    vocabulary = expected_ocr_vocabulary(question_text, model_answer, required_concepts)
    if not vocabulary:
        return text

    corrected_tokens = []
    for token in re.findall(r"[A-Za-z0-9]+|[^A-Za-z0-9]+", text):
        if not re.fullmatch(r"[A-Za-z0-9]+", token):
            corrected_tokens.append(token)
            continue

        lower = token.lower()
        if len(lower) < 5 or lower in vocabulary:
            corrected_tokens.append(token)
            continue

        best_word = None
        best_score = 0.0
        for expected in vocabulary:
            if abs(len(expected) - len(lower)) > max(3, len(expected) // 3):
                continue
            score = SequenceMatcher(None, lower, expected).ratio()
            if score > best_score:
                best_word = expected
                best_score = score

        if best_word and best_score >= 0.68:
            corrected_tokens.append(best_word)
        else:
            corrected_tokens.append(token)

    return "".join(corrected_tokens)


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


def normalize_ocr_text(text: str) -> str:
    text = re.sub(r"!\[[^\]]*\]\([^)]+\)", " ", text or "")
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


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
        confidences = []
        for idx, region in enumerate(regions):
            text, confidence = ocrspace_region(region)
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
            "engine": "ocrspace",
        }
    except Exception as e:
        print(f"[OCR] OCR.space failed, falling back to the next OCR engine: {e}")
        return None


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


def process_answer_sheet(
    file_bytes: bytes,
    filename: str,
    num_questions: int,
) -> dict:
    """
    Main entry point.
    Returns:
    {
        "pages_processed": int,
        "questions": [
            {"index": 0, "text": "...", "confidence": 87.4},
            ...
        ],
        "overall_confidence": float,
        "error": None or str,
    }
    """
    try:
        pages = load_image_bytes(file_bytes, filename)
    except Exception as e:
        return {"error": str(e), "questions": [], "pages_processed": 0, "overall_confidence": 0}

    # Stitch multi-page vertically
    if len(pages) > 1:
        resized = []
        target_w = pages[0].shape[1]
        for p in pages:
            if p.shape[1] != target_w:
                scale = target_w / p.shape[1]
                new_h = int(p.shape[0] * scale)
                p = cv2.resize(p, (target_w, new_h))
            resized.append(p)
        full_image = np.vstack(resized)
    else:
        full_image = pages[0]

    ocrspace_result = ocrspace_answer_sheet(pages, num_questions)
    if ocrspace_result:
        return ocrspace_result

    vision_result = openai_handwriting_ocr(pages, num_questions)
    if vision_result:
        return vision_result

    trocr_result = trocr_handwriting_ocr(pages, num_questions)
    if trocr_result:
        return trocr_result

    regions = detect_question_regions(full_image, num_questions)

    question_results = []
    all_confs = []

    for i, region in enumerate(regions):
        text, conf = ocr_region(region)
        question_results.append({
            "index": i,
            "text": text,
            "confidence": float(conf),
        })
        if conf > 0:
            all_confs.append(float(conf))

    overall_conf = float(round(sum(all_confs) / len(all_confs), 2)) if all_confs else 0.0

    return {
        "pages_processed": len(pages),
        "questions": question_results,
        "overall_confidence": overall_conf,
        "error": None,
        "engine": "easyocr",
    }
