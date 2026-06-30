from sqlalchemy import Column, Boolean, Integer, Text, Numeric, String, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from api.database import Base

class Submission(Base):
    __tablename__ = "submissions"
    id           = Column(Integer, primary_key=True, index=True)
    student_id   = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    question_id  = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    answer_text  = Column(Text, nullable=False)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())

class EvaluationResult(Base):
    __tablename__ = "evaluation_results"
    id               = Column(Integer, primary_key=True)
    submission_id    = Column(Integer, ForeignKey("submissions.id", ondelete="CASCADE"), unique=True)
    marks            = Column(Numeric(6, 2))
    percentage       = Column(Numeric(5, 2))
    grade_band       = Column(String(30))
    semantic_score   = Column(Numeric(4, 3))
    keyword_score    = Column(Numeric(4, 3))
    sentence_score   = Column(Numeric(4, 3))
    length_score     = Column(Numeric(4, 3))
    copy_risk        = Column(Numeric(5, 2))
    peer_similarity  = Column(Numeric(5, 2), default=0)
    similar_submission_id = Column(Integer, ForeignKey("submissions.id", ondelete="SET NULL"))
    review_requested = Column(Boolean, default=False)
    teacher_review_note = Column(Text)
    covered_keywords = Column(JSON, default=list)
    missing_keywords = Column(JSON, default=list)
    suggestions      = Column(JSON, default=list)
    evaluated_at     = Column(DateTime(timezone=True), server_default=func.now())
