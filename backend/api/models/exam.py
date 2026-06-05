from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
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
    question_text     = Column(Text, nullable=False)
    model_answer      = Column(Text, nullable=False)
    max_marks         = Column(Integer, nullable=False)
    required_concepts = Column(Text)
    order_index       = Column(Integer, default=0)