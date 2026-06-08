from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.database import Base, engine

# ── import all models so tables are created ──────────────────
from api.models import user as user_models
from api.models import classroom as classroom_models
from api.models import exam as exam_models
from api.models import submission as submission_models
from api.models import ocr as ocr_models

# ── import routers ───────────────────────────────────────────
from api.routers import auth
from api.routers import classroom
from api.routers import exam
from api.routers import student
from api.routers import ocr

app = FastAPI(title="Answer Sheet Evaluator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

app.include_router(auth.router)
app.include_router(classroom.router)
app.include_router(exam.router)
app.include_router(student.router)
app.include_router(ocr.router)

@app.get("/")
def root():
    return {"status": "API is running"}