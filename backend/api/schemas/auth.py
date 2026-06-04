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

class OTPRequest(BaseModel):
    user_id: int
    otp: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    role: str
    name: str