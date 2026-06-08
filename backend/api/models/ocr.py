from sqlalchemy import Column, Integer, String, Text, Numeric, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from api.database import Base

class OCRSubmission(Base):
    __tablename__ = "ocr_submissions"
    id                = Column(Integer, primary_key=True, index=True)
    student_id        = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    exam_id           = Column(Integer, ForeignKey("exams.id", ondelete="CASCADE"))
    original_filename = Column(String(255))
    image_path        = Column(String(500))
    extracted_text    = Column(Text)
    confidence_score  = Column(Numeric(5, 2))
    status            = Column(String(20), default="pending")
    ocr_error         = Column(Text)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())

class OCRQuestionExtraction(Base):
    __tablename__ = "ocr_question_extractions"
    id                 = Column(Integer, primary_key=True)
    ocr_submission_id  = Column(Integer, ForeignKey("ocr_submissions.id", ondelete="CASCADE"))
    question_id        = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"))
    extracted_text     = Column(Text)
    confidence         = Column(Numeric(5, 2))
    is_corrected       = Column(Boolean, default=False)
    corrected_text     = Column(Text)