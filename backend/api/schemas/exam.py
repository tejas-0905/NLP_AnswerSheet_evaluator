from pydantic import BaseModel
from typing import Optional, List

class QuestionIn(BaseModel):
    question_type: str = "descriptive"
    question_text: str
    model_answer: Optional[str] = ""
    max_marks: int
    required_concepts: Optional[str] = ""
    options: Optional[List[str]] = None
    correct_option: Optional[str] = None
    correct_options: Optional[List[str]] = None
    allow_multiple: bool = False
    order_index: int = 0

class CreateExamRequest(BaseModel):
    classroom_id: int
    title: str
    description: Optional[str] = ""
    time_limit_minutes: Optional[int] = None
    assigned_student_ids: Optional[List[int]] = None
    questions: List[QuestionIn]

class ToggleExamRequest(BaseModel):
    is_active: bool
