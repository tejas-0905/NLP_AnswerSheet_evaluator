from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api.db_startup import initialize_database
from api.routers import auth, classroom, exam, notes, ocr, student
from config import settings


UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.joinpath("profile_photos").mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Answer Sheet Evaluator API")
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

allowed_origins = [
    origin.strip()
    for origin in settings.FRONTEND_ORIGINS.split(",")
    if origin.strip()
]

# Allow common local dev origins so a locally-served frontend can talk to a deployed backend
for _loc in ("http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174"):
    if _loc not in allowed_origins:
        allowed_origins.append(_loc)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    # Accept https and http origins on popular hosting providers to help local testing
    allow_origin_regex=r"https?://.*\.(vercel\.app|netlify\.app|onrender\.com)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

initialize_database()

app.include_router(auth.router)
app.include_router(classroom.router)
app.include_router(exam.router)
app.include_router(student.router)
app.include_router(ocr.router)
app.include_router(notes.router)


@app.get("/")
def root():
    return {"status": "API is running"}
