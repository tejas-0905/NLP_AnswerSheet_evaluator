from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
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

class Note(Base):
    __tablename__ = "notes"
    id                = Column(Integer, primary_key=True, index=True)
    classroom_id      = Column(Integer, ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=False)
    teacher_id        = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title             = Column(String(200), nullable=False)
    description       = Column(Text, nullable=True)
    original_filename = Column(String(255), nullable=False)
    stored_filename   = Column(String(255), nullable=False)
    file_path         = Column(String(500), nullable=False)
    content_type      = Column(String(120), nullable=True)
    file_size         = Column(Integer, nullable=False)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())
