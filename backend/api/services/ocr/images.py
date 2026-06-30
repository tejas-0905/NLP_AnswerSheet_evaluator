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
