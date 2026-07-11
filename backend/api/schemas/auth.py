from pydantic import BaseModel, EmailStr
from enum import Enum

class RoleEnum(str, Enum):
    teacher = "teacher"
    student = "student"

class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: RoleEnum

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    role: str
    name: str

class UserSettingsUpdate(BaseModel):
    full_name: str
    institution: str | None = ""
    department: str | None = ""
    bio: str | None = ""
    notify_submissions: bool = True
    notify_low_scores: bool = True
    notify_ocr_review: bool = True
    default_question_marks: int = 10
    release_marks_immediately: bool = True
