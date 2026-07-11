import enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, Text
from sqlalchemy.sql import func
from api.database import Base              # "api." not "backend.api."

class UserRole(str, enum.Enum):
    teacher = "teacher"
    student = "student"

class User(Base):
    __tablename__ = "users"
    id            = Column(Integer, primary_key=True, index=True)
    email         = Column(String, unique=True, nullable=False, index=True)
    full_name     = Column(String, nullable=False)
    institution   = Column(String, nullable=True)
    department    = Column(String, nullable=True)
    bio           = Column(Text, nullable=True)
    profile_photo_path = Column(String(500), nullable=True)
    notify_submissions = Column(Boolean, default=True)
    notify_low_scores  = Column(Boolean, default=True)
    notify_ocr_review  = Column(Boolean, default=True)
    default_question_marks = Column(Integer, default=10)
    release_marks_immediately = Column(Boolean, default=True)
    password_hash = Column(String, nullable=False)
    role          = Column(Enum(UserRole), nullable=False)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
