from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from api.dependencies import get_db, get_current_user
from api.models.user import User
from api.models.exam import Exam, Question
from api.models.submission import Submission, EvaluationResult
from api.models.classroom import Classroom
from api.schemas.exam import CreateExamRequest, ToggleExamRequest

router = APIRouter(prefix="/exams", tags=["Exams"])


@router.post("/")
def create_exam(
    payload: CreateExamRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    classroom = db.query(Classroom).filter(
        Classroom.id == payload.classroom_id,
        Classroom.teacher_id == current_user.id,
    ).first()
    if not classroom:
        raise HTTPException(403, "Classroom not found or not yours")

    exam = Exam(
        classroom_id=payload.classroom_id,
        title=payload.title,
        description=payload.description,
        time_limit_minutes=payload.time_limit_minutes,
    )
    db.add(exam)
    db.commit()
    db.refresh(exam)

    for q in payload.questions:
        db.add(Question(
            exam_id=exam.id,
            question_text=q.question_text,
            model_answer=q.model_answer,
            max_marks=q.max_marks,
            required_concepts=q.required_concepts,
            order_index=q.order_index,
        ))
    db.commit()
    return {"message": "Exam created", "exam_id": exam.id}


@router.get("/classroom/{classroom_id}")
def get_exams_for_classroom(
    classroom_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exams = db.query(Exam).filter(Exam.classroom_id == classroom_id).all()
    result = []
    for e in exams:
        q_count = db.query(Question).filter(Question.exam_id == e.id).count()
        total_marks = db.query(Question).filter(Question.exam_id == e.id).all()
        result.append({
            "id": e.id,
            "title": e.title,
            "description": e.description,
            "time_limit_minutes": e.time_limit_minutes,
            "is_active": e.is_active,
            "question_count": q_count,
            "total_marks": sum(q.max_marks for q in total_marks),
            "created_at": e.created_at,
        })
    return result


@router.patch("/{exam_id}/toggle")
def toggle_exam(
    exam_id: int,
    payload: ToggleExamRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(404, "Exam not found")
    exam.is_active = payload.is_active
    db.commit()
    return {"message": "Updated"}


@router.delete("/{exam_id}")
def delete_exam(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(404, "Exam not found")
    db.delete(exam)
    db.commit()
    return {"message": "Deleted"}


@router.get("/{exam_id}")
def get_exam_detail(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(404, "Exam not found")

    classroom = db.query(Classroom).filter(
        Classroom.id == exam.classroom_id,
        Classroom.teacher_id == current_user.id,
    ).first()
    if not classroom:
        raise HTTPException(403, "Exam not found or not yours")

    questions = db.query(Question).filter(
        Question.exam_id == exam.id
    ).order_by(Question.order_index).all()

    return {
        "id": exam.id,
        "classroom_id": exam.classroom_id,
        "classroom_name": classroom.name,
        "title": exam.title,
        "description": exam.description,
        "time_limit_minutes": exam.time_limit_minutes,
        "is_active": exam.is_active,
        "created_at": exam.created_at,
        "question_count": len(questions),
        "total_marks": sum(q.max_marks for q in questions),
        "questions": [
            {
                "id": q.id,
                "question_text": q.question_text,
                "model_answer": q.model_answer,
                "max_marks": q.max_marks,
                "required_concepts": q.required_concepts,
                "order_index": q.order_index,
            }
            for q in questions
        ],
    }


@router.get("/{exam_id}/results")
def get_exam_results(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(404, "Exam not found")

    questions = db.query(Question).filter(Question.exam_id == exam_id).all()
    q_ids = [q.id for q in questions]
    rows = []
    submissions = db.query(Submission).filter(Submission.question_id.in_(q_ids)).all()

    student_map = {}
    for sub in submissions:
        ev = db.query(EvaluationResult).filter(
            EvaluationResult.submission_id == sub.id
        ).first()
        sid = sub.student_id
        if sid not in student_map:
            from api.models.user import User as U
            u = db.query(U).filter(U.id == sid).first()
            student_map[sid] = {
                "student_id": sid,
                "student_name": u.full_name if u else "Unknown",
                "total_marks": 0,
                "total_max": 0,
                "answers": [],
            }
        if ev:
            student_map[sid]["total_marks"] += float(ev.marks)
            q = next((q for q in questions if q.id == sub.question_id), None)
            student_map[sid]["total_max"] += q.max_marks if q else 0
            student_map[sid]["answers"].append({
                "question_id": sub.question_id,
                "question_text": q.question_text if q else "",
                "answer_text": sub.answer_text,
                "submitted_at": sub.submitted_at,
                "evaluated_at": ev.evaluated_at,
                "time_limit_minutes": exam.time_limit_minutes,
                "max_marks": q.max_marks if q else 0,
                "marks": float(ev.marks),
                "percentage": float(ev.percentage),
                "grade_band": ev.grade_band,
                "semantic_score": float(ev.semantic_score or 0),
                "keyword_score": float(ev.keyword_score or 0),
                "sentence_score": float(ev.sentence_score or 0),
                "length_score": float(ev.length_score or 0),
                "missing_keywords": ev.missing_keywords,
                "covered_keywords": ev.covered_keywords,
                "suggestions": ev.suggestions,
                "copy_risk": float(ev.copy_risk or 0),
            })

    for sid, data in student_map.items():
        data["overall_percentage"] = round(
            (data["total_marks"] / data["total_max"]) * 100, 2
        ) if data["total_max"] else 0
        rows.append(data)

    rows.sort(key=lambda x: x["overall_percentage"], reverse=True)
    return rows
