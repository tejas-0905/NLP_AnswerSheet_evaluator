from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.db_startup import initialize_database
from api.routers import auth, classroom, exam, ocr, student


app = FastAPI(title="Answer Sheet Evaluator API")

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


@app.get("/")
def root():
    return {"status": "API is running"}
