from pydantic import BaseModel
from typing import Optional

class CreateClassroomRequest(BaseModel):
    name: str

class ClassroomResponse(BaseModel):
    id: int
    name: str
    code: str
    is_active: bool
    teacher_id: int

    class Config:
        from_attributes = True