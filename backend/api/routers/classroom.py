import random
import string
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.dependencies import get_db, get_current_user
from api.models.user import User
from api.models.classroom import Classroom, ClassroomMember
from api.models.exam import Exam, Question
from api.models.submission import Submission, EvaluationResult
from api.models.ocr import OCRSubmission
from api.schemas.classroom import CreateClassroomRequest, ClassroomResponse

router = APIRouter(prefix="/classrooms", tags=["Classrooms"])


def generate_code(length=7):
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))


# ── create classroom ─────────────────────────────────────────
@router.post("/", response_model=ClassroomResponse)
def create_classroom(
    payload: CreateClassroomRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "teacher":
        raise HTTPException(403, "Only teachers can create classrooms")

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


# ── get my classrooms ────────────────────────────────────────
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


# ── delete classroom ─────────────────────────────────────────
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


# ── get students in classroom ────────────────────────────────
@router.get("/{classroom_id}/students")
def get_students(
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

    members = db.query(ClassroomMember).filter(
        ClassroomMember.classroom_id == classroom_id
    ).all()

    result = []
    for m in members:
        student = db.query(User).filter(User.id == m.student_id).first()
        if not student:
            continue

        sub_count = (
            db.query(Submission)
            .join(Question, Submission.question_id == Question.id)
            .join(Exam, Question.exam_id == Exam.id)
            .filter(
                Exam.classroom_id == classroom_id,
                Submission.student_id == m.student_id,
            )
            .count()
        )

        result.append({
            "student_id": student.id,
            "full_name": student.full_name,
            "email": student.email,
            "joined_at": m.joined_at,
            "submission_count": sub_count,
        })
    return result


# ── remove student from classroom ───────────────────────────
@router.delete("/{classroom_id}/students/{student_id}")
def remove_student(
    classroom_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == current_user.id,
    ).first()
    if not classroom:
        raise HTTPException(404, "Classroom not found or not yours")

    member = db.query(ClassroomMember).filter(
        ClassroomMember.classroom_id == classroom_id,
        ClassroomMember.student_id == student_id,
    ).first()
    if not member:
        raise HTTPException(404, "Student not in this classroom")

    # Delete all submissions + evaluations for this student in this classroom
    exams = db.query(Exam).filter(Exam.classroom_id == classroom_id).all()
    for exam in exams:
        questions = db.query(Question).filter(Question.exam_id == exam.id).all()
        for question in questions:
            sub = db.query(Submission).filter(
                Submission.question_id == question.id,
                Submission.student_id == student_id,
            ).first()
            if sub:
                db.query(EvaluationResult).filter(
                    EvaluationResult.submission_id == sub.id
                ).delete()
                db.delete(sub)

        # Delete OCR submissions for this exam
        db.query(OCRSubmission).filter(
            OCRSubmission.student_id == student_id,
            OCRSubmission.exam_id == exam.id,
        ).delete()

    db.delete(member)
    db.commit()

    return {"message": "Student removed and all their data deleted"}