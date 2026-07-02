from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api.db_startup import initialize_database
from api.routers import auth, classroom, exam, notes, ocr, student


UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.joinpath("profile_photos").mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Answer Sheet Evaluator API")
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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
