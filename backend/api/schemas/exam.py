from pydantic import BaseModel
from typing import Optional, List

class QuestionIn(BaseModel):
    question_text: str
    model_answer: str
    max_marks: int
    required_concepts: Optional[str] = ""
    order_index: int = 0

class CreateExamRequest(BaseModel):
    classroom_id: int
    title: str
    description: Optional[str] = ""
    time_limit_minutes: Optional[int] = None
    questions: List[QuestionIn]

class ToggleExamRequest(BaseModel):
    is_active: bool