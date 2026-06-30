from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from api.database import Base

class Exam(Base):
    __tablename__ = "exams"
    id                 = Column(Integer, primary_key=True, index=True)
    classroom_id       = Column(Integer, ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=False)
    title              = Column(String(200), nullable=False)
    description        = Column(Text)
    time_limit_minutes = Column(Integer, nullable=True)
    is_active          = Column(Boolean, default=False)
    created_at         = Column(DateTime(timezone=True), server_default=func.now())

class Question(Base):
    __tablename__ = "questions"
    id                = Column(Integer, primary_key=True, index=True)
    exam_id           = Column(Integer, ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    question_type     = Column(String(30), nullable=False, default="descriptive")
    question_text     = Column(Text, nullable=False)
    model_answer      = Column(Text, nullable=True)
    max_marks         = Column(Integer, nullable=False)
    required_concepts = Column(Text)
    options           = Column(JSON, nullable=True)
    correct_option    = Column(String(255), nullable=True)
    correct_options   = Column(JSON, nullable=True)
    allow_multiple    = Column(Boolean, default=False)
    order_index       = Column(Integer, default=0)

class ExamAccess(Base):
    __tablename__ = "exam_access"
    id         = Column(Integer, primary_key=True, index=True)
    exam_id    = Column(Integer, ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
