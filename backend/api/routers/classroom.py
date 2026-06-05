import random
import string
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.dependencies import get_db, get_current_user
from api.models.user import User
from api.models.classroom import Classroom, ClassroomMember
from api.schemas.classroom import CreateClassroomRequest, ClassroomResponse

router = APIRouter(prefix="/classrooms", tags=["Classrooms"])

def generate_code(length=7):
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))

@router.post("/", response_model=ClassroomResponse)
def create_classroom(
    payload: CreateClassroomRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "teacher":
        raise HTTPException(403, "Only teachers can create classrooms")

    # Ensure unique code
    while True:
        code = generate_code()
        if not db.query(Classroom).filter(Classroom.code == code).first():
            break

    classroom = Classroom(
        name=payload.name,
        code=code,
        teacher_id=current_user.id,
    )
    db.add(classroom)
    db.commit()
    db.refresh(classroom)
    return classroom

@router.get("/")
def get_my_classrooms(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    classrooms = db.query(Classroom).filter(
        Classroom.teacher_id == current_user.id
    ).all()

    result = []
    for c in classrooms:
        count = db.query(ClassroomMember).filter(
            ClassroomMember.classroom_id == c.id
        ).count()
        result.append({
            "id": c.id,
            "name": c.name,
            "code": c.code,
            "is_active": c.is_active,
            "student_count": count,
        })
    return result

@router.delete("/{classroom_id}")
def delete_classroom(
    classroom_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == current_user.id,
    ).first()
    if not classroom:
        raise HTTPException(404, "Classroom not found")
    db.delete(classroom)
    db.commit()
    return {"message": "Deleted"}