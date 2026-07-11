from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str

    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    FRONTEND_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    OPENAI_API_KEY: str | None = None
    OPENAI_OCR_MODEL: str = "gpt-4o-mini"

    OCR_ENGINE: str = "ocrspace"
    OCRSPACE_API_KEY: str | None = None
    OCRSPACE_API_URL: str = "https://api.ocr.space/parse/image"
    OCRSPACE_ENGINE: int = 3
    OCRSPACE_LANGUAGE: str = "eng"
    OCRSPACE_TIMEOUT_SECONDS: int = 60

    TROCR_MODEL: str = "microsoft/trocr-base-handwritten"

    # Supabase
    NEXT_PUBLIC_SUPABASE_URL: str
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_PROFILE_PHOTO_BUCKET: str = "profile-images"
    SUPABASE_ANSWER_SHEETS_BUCKET: str = "answer-sheets"
    SUPABASE_NOTES_BUCKET: str = "notes"

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        extra="ignore"   # or "forbid" if you want strict validation later
    )

settings = Settings()
