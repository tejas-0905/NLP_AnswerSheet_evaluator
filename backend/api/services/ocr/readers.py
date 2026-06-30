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
