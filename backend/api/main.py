from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.database import Base, engine
from api.models import user as user_models      # registers tables
from api.routers import auth
from api.models import classroom as classroom_models   # add this
from api.routers import classroom 
from api.models import exam as exam_models
from api.models import submission as submission_models
from api.routers import exam 

app = FastAPI(title="Answer Sheet Evaluator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

app.include_router(auth.router)
app.include_router(classroom.router) 
app.include_router(exam.router)

@app.get("/")
def root():
    return {"status": "API is running"}
