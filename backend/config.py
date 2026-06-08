from pathlib import Path

from pydantic_settings import BaseSettings


BASE_DIR = Path(__file__).resolve().parent

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    SMTP_HOST: str
    SMTP_PORT: int
    SMTP_USER: str
    SMTP_PASSWORD: str
    OPENAI_API_KEY: str | None = None
    OPENAI_OCR_MODEL: str = "gpt-4o-mini"
    OCR_ENGINE: str = "ocrspace"
    OCRSPACE_API_KEY: str | None = None
    OCRSPACE_API_URL: str = "https://api.ocr.space/parse/image"
    OCRSPACE_ENGINE: int = 3
    OCRSPACE_LANGUAGE: str = "eng"
    OCRSPACE_TIMEOUT_SECONDS: int = 60
    TROCR_MODEL: str = "microsoft/trocr-base-handwritten"

    class Config:
        env_file = BASE_DIR / ".env"

settings = Settings()
