import cv2
import numpy as np
from PIL import Image

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


def split_wide_page_spreads(pages: list[np.ndarray]) -> list[np.ndarray]:
    """Split photographed two-page spreads into left/right pages when there is a clear center gutter."""
    output = []
    for image in pages:
        h, w = image.shape[:2]
        if w < h * 1.15:
            output.append(image)
            continue

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        center = w // 2
        search_half_width = max(20, w // 12)
        x1 = max(0, center - search_half_width)
        x2 = min(w, center + search_half_width)
        column_scores = gray[:, x1:x2].mean(axis=0)
        split_x = x1 + int(np.argmax(column_scores))

        left_w = split_x
        right_w = w - split_x
        if left_w < w * 0.35 or right_w < w * 0.35:
            output.append(image)
            continue

        gutter = max(4, w // 150)
        output.append(image[:, :max(split_x - gutter, 1)])
        output.append(image[:, min(split_x + gutter, w - 1):])

    return output


def render_pdf_pages(file_bytes: bytes) -> list[Image.Image]:
    """Render PDF pages into PIL images.

    Memory protection: render at a capped number of pages and at a bounded
    scale/dpi to avoid Render OOM for large PDFs.
    """

    MAX_PAGES = 8
    RENDER_SCALE = 200 / 72  # lower than 250/72

    try:
        import pypdfium2 as pdfium

        pdf = pdfium.PdfDocument(file_bytes)
        pages: list[Image.Image] = []
        try:
            for i, page in enumerate(pdf):
                if i >= MAX_PAGES:
                    break
                bitmap = page.render(scale=RENDER_SCALE)
                pages.append(bitmap.to_pil())
                page.close()
        finally:
            pdf.close()
        return pages
    except Exception:
        try:
            from pdf2image import convert_from_bytes

            # dpi also affects memory
            pil_pages = convert_from_bytes(file_bytes, dpi=200, first_page=1, last_page=MAX_PAGES)
            return pil_pages[:MAX_PAGES]
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
