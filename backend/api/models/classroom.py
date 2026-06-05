from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from api.database import Base

class Classroom(Base):
    __tablename__ = "classrooms"
    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String(150), nullable=False)
    code       = Column(String(8), unique=True, nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ClassroomMember(Base):
    __tablename__ = "classroom_members"
    id           = Column(Integer, primary_key=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id", ondelete="CASCADE"))
    student_id   = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    joined_at    = Column(DateTime(timezone=True), server_default=func.now())