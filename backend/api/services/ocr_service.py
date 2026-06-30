import cv2
import numpy as np

from api.services.ocr.easyocr_engine import ocr_region
from api.services.ocr.handwriting import (
    crop_line_from_box,
    crop_to_ink,
    detect_handwriting_lines,
    detect_line_boxes,
    group_line_boxes_by_question,
    handwriting_mask,
    split_lines_by_question,
)
from api.services.ocr.images import (
    detect_question_regions,
    load_image_bytes,
    preprocess_image,
    render_pdf_pages,
)
from api.services.ocr.ocrspace_engine import (
    image_to_base64_data_url,
    ocrspace_answer_sheet,
    ocrspace_region,
    parse_ocrspace_response,
)
from api.services.ocr.openai_engine import openai_handwriting_ocr, pil_to_data_url
from api.services.ocr.readers import get_reader, get_trocr
from api.services.ocr.text_utils import (
    correct_ocr_text_with_context,
    expected_ocr_vocabulary,
    extract_json_object,
    normalize_ocr_text,
    split_text_by_question_numbers,
)
from api.services.ocr.trocr_engine import transcribe_trocr_lines, trocr_handwriting_ocr


def process_answer_sheet(
    file_bytes: bytes,
    filename: str,
    num_questions: int,
) -> dict:
    """Process an uploaded answer sheet and return OCR text per question."""
    try:
        pages = load_image_bytes(file_bytes, filename)
    except Exception as e:
        return {"error": str(e), "questions": [], "pages_processed": 0, "overall_confidence": 0}

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
