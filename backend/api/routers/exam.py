import csv
import io
import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from api.dependencies import get_db, get_current_user
from api.models.user import User
from api.models.exam import Exam, ExamAccess, Question
from api.models.submission import Submission, EvaluationResult
from api.models.classroom import Classroom, ClassroomMember
from api.schemas.exam import CreateExamRequest, ToggleExamRequest
from api.services.similarity_service import similar_student_name

router = APIRouter(prefix="/exams", tags=["Exams"])


class StudentReviewRequest(BaseModel):
    review_requested: bool = True
    teacher_review_note: str | None = None


def normalize_question_type(value: str | None) -> str:
    return "mcq" if value == "mcq" else "descriptive"


def normalize_options(values):
    return [value.strip() for value in (values or []) if value and value.strip()]


def parse_mcq_answer(answer_text: str):
    try:
        value = json.loads(answer_text)
        if isinstance(value, list):
            return [str(item) for item in value]
        if isinstance(value, str):
            return [value]
    except Exception:
        pass
    return [answer_text] if answer_text else []


def question_correct_options(question: Question):
    return question.correct_options or ([question.correct_option] if question.correct_option else [])


def teacher_owns_exam(db: Session, exam: Exam, teacher_id: int) -> bool:
    return db.query(Classroom).filter(
        Classroom.id == exam.classroom_id,
        Classroom.teacher_id == teacher_id,
    ).first() is not None


def unanswered_result(question: Question, exam: Exam):
    return {
        "question_id": question.id,
        "question_type": question.question_type,
        "question_text": question.question_text,
        "answer_text": "",
        "correct_option": question.correct_option,
        "correct_options": question_correct_options(question),
        "allow_multiple": question.allow_multiple,
        "is_correct": False if question.question_type == "mcq" else None,
        "submitted_at": None,
        "evaluated_at": None,
        "time_limit_minutes": exam.time_limit_minutes,
        "max_marks": question.max_marks,
        "marks": 0,
        "percentage": 0,
        "grade_band": "Not answered",
        "semantic_score": 0,
        "keyword_score": 0,
        "sentence_score": 0,
        "length_score": 0,
        "missing_keywords": [],
        "covered_keywords": [],
        "suggestions": ["No answer submitted."],
        "copy_risk": 0,
        "peer_similarity": 0,
        "similar_student_name": None,
        "review_requested": False,
        "teacher_review_note": None,
    }


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

    prepared_questions = []
    for q in payload.questions:
        question_type = normalize_question_type(q.question_type)
        options = normalize_options(q.options)
        correct_options = normalize_options(q.correct_options)
        if q.correct_option and not correct_options:
            correct_options = [q.correct_option.strip()]
        if question_type == "mcq":
            if len(options) < 2:
                raise HTTPException(400, "MCQ questions need at least two options")
            if not correct_options or any(option not in options for option in correct_options):
                raise HTTPException(400, "Select a valid correct option for every MCQ")
            if not q.allow_multiple and len(correct_options) != 1:
                raise HTTPException(400, "Single-answer MCQs must have exactly one correct option")
        elif not (q.model_answer or "").strip():
            raise HTTPException(400, "Descriptive questions need a model answer")

        prepared_questions.append((q, question_type, options, correct_options))

    assigned_student_ids = payload.assigned_student_ids or []
    if assigned_student_ids:
        valid_student_ids = {
            row.student_id
            for row in db.query(ClassroomMember).filter(
                ClassroomMember.classroom_id == payload.classroom_id,
                ClassroomMember.student_id.in_(assigned_student_ids),
            ).all()
        }
        if len(valid_student_ids) != len(set(assigned_student_ids)):
            raise HTTPException(400, "Assigned students must belong to this classroom")

    exam = Exam(
        classroom_id=payload.classroom_id,
        title=payload.title,
        description=payload.description,
        time_limit_minutes=payload.time_limit_minutes,
    )
    db.add(exam)
    db.commit()
    db.refresh(exam)

    for q, question_type, options, correct_options in prepared_questions:
        db.add(Question(
            exam_id=exam.id,
            question_type=question_type,
            question_text=q.question_text,
            model_answer=q.model_answer or "",
            max_marks=q.max_marks,
            required_concepts=q.required_concepts,
            options=options if question_type == "mcq" else None,
            correct_option=correct_options[0] if question_type == "mcq" and correct_options else None,
            correct_options=correct_options if question_type == "mcq" else None,
            allow_multiple=q.allow_multiple if question_type == "mcq" else False,
            order_index=q.order_index,
        ))
    db.commit()
    for student_id in assigned_student_ids:
        db.add(ExamAccess(exam_id=exam.id, student_id=student_id))
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
    if not teacher_owns_exam(db, exam, current_user.id):
        raise HTTPException(403, "Exam not found or not yours")

    classroom = db.query(Classroom).filter(
        Classroom.id == exam.classroom_id,
        Classroom.teacher_id == current_user.id,
    ).first()
    if not classroom:
        raise HTTPException(403, "Exam not found or not yours")

    questions = db.query(Question).filter(
        Question.exam_id == exam.id
    ).order_by(Question.order_index).all()
    assigned_student_ids = [
        row.student_id
        for row in db.query(ExamAccess).filter(ExamAccess.exam_id == exam.id).all()
    ]

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
        "assigned_student_ids": assigned_student_ids,
        "questions": [
            {
                "id": q.id,
                "question_type": q.question_type,
                "question_text": q.question_text,
                "model_answer": q.model_answer,
                "max_marks": q.max_marks,
                "required_concepts": q.required_concepts,
                "options": q.options or [],
                "correct_option": q.correct_option,
                "correct_options": q.correct_options or ([q.correct_option] if q.correct_option else []),
                "allow_multiple": q.allow_multiple,
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

    questions = db.query(Question).filter(
        Question.exam_id == exam_id
    ).order_by(Question.order_index).all()
    q_ids = [q.id for q in questions]
    rows = []
    submissions = db.query(Submission).filter(Submission.question_id.in_(q_ids)).all()

    student_map = {}
    for sub in submissions:
        sid = sub.student_id
        if sid not in student_map:
            from api.models.user import User as U
            u = db.query(U).filter(U.id == sid).first()
            student_map[sid] = {
                "student_id": sid,
                "student_name": u.full_name if u else "Unknown",
                "total_marks": 0,
                "total_max": sum(q.max_marks for q in questions),
                "answers": [],
            }

    for sid, data in student_map.items():
        for question in questions:
            sub = next(
                (
                    item for item in submissions
                    if item.student_id == sid and item.question_id == question.id
                ),
                None,
            )
            if not sub:
                data["answers"].append(unanswered_result(question, exam))
                continue

            ev = db.query(EvaluationResult).filter(
                EvaluationResult.submission_id == sub.id
            ).first()
            if not ev:
                data["answers"].append(unanswered_result(question, exam))
                continue

            data["total_marks"] += float(ev.marks)
            review_note = ev.teacher_review_note or None
            data["answers"].append({
                "question_id": sub.question_id,
                "question_type": question.question_type,
                "question_text": question.question_text,
                "answer_text": sub.answer_text,
                "correct_option": question.correct_option,
                "correct_options": question_correct_options(question),
                "allow_multiple": question.allow_multiple,
                "is_correct": (
                    sorted(parse_mcq_answer(sub.answer_text)) == sorted(question_correct_options(question))
                    if question.question_type == "mcq"
                    else None
                ),
                "submitted_at": sub.submitted_at,
                "evaluated_at": ev.evaluated_at,
                "time_limit_minutes": exam.time_limit_minutes,
                "max_marks": question.max_marks,
                "marks": float(ev.marks),
                "percentage": float(ev.percentage),
                "grade_band": ev.grade_band,
                "semantic_score": float(ev.semantic_score or 0),
                "keyword_score": float(ev.keyword_score or 0),
                "sentence_score": float(ev.sentence_score or 0),
                "length_score": float(ev.length_score or 0),
                "missing_keywords": ev.missing_keywords or [],
                "covered_keywords": ev.covered_keywords or [],
                "suggestions": ev.suggestions or [],
                "copy_risk": float(ev.copy_risk or 0),
                "peer_similarity": float(ev.peer_similarity or 0),
                "similar_student_name": similar_student_name(db, ev.similar_submission_id),
                "review_requested": bool(ev.review_requested),
                "teacher_review_note": review_note,
            })

        review_notes = [
            answer["teacher_review_note"]
            for answer in data["answers"]
            if answer.get("review_requested") and answer.get("teacher_review_note")
        ]
        data["review_requested"] = any(answer.get("review_requested") for answer in data["answers"])
        data["teacher_review_note"] = review_notes[0] if review_notes else None
        data["overall_percentage"] = round(
            (data["total_marks"] / data["total_max"]) * 100, 2
        ) if data["total_max"] else 0
        rows.append(data)

    rows.sort(key=lambda x: x["overall_percentage"], reverse=True)
    return rows


@router.patch("/{exam_id}/students/{student_id}/review")
def set_student_review(
    exam_id: int,
    student_id: int,
    payload: StudentReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(404, "Exam not found")
    if not teacher_owns_exam(db, exam, current_user.id):
        raise HTTPException(403, "Exam not found or not yours")

    questions = db.query(Question).filter(Question.exam_id == exam_id).all()
    q_ids = [question.id for question in questions]
    submissions = db.query(Submission).filter(
        Submission.question_id.in_(q_ids),
        Submission.student_id == student_id,
    ).all()
    if not submissions:
        raise HTTPException(404, "No submission found for this student")

    submission_ids = [submission.id for submission in submissions]
    evaluations = db.query(EvaluationResult).filter(
        EvaluationResult.submission_id.in_(submission_ids)
    ).all()
    if not evaluations:
        raise HTTPException(404, "No evaluated answers found for this student")

    note = (payload.teacher_review_note or "").strip() or None
    for evaluation in evaluations:
        evaluation.review_requested = payload.review_requested
        evaluation.teacher_review_note = note if payload.review_requested else None
    db.commit()
    return {
        "message": "Review request updated",
        "student_id": student_id,
        "review_requested": payload.review_requested,
        "teacher_review_note": note if payload.review_requested else None,
    }


@router.get("/{exam_id}/results.csv")
def download_exam_results_csv(
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
        Question.exam_id == exam_id
    ).order_by(Question.order_index).all()
    q_ids = [question.id for question in questions]
    submissions = db.query(Submission).filter(Submission.question_id.in_(q_ids)).all()

    student_rows = {}
    for sub in submissions:
        student = db.query(User).filter(User.id == sub.student_id).first()
        if sub.student_id not in student_rows:
            student_rows[sub.student_id] = {
                "Student ID": sub.student_id,
                "Student Name": student.full_name if student else "Unknown",
                "Total Marks": 0,
                "Total Max": sum(question.max_marks for question in questions),
                "Percentage": 0,
            }

    for row in student_rows.values():
        for question in questions:
            prefix = f"Q{question.order_index + 1}"
            row[f"{prefix} Type"] = question.question_type
            row[f"{prefix} Answer"] = "Not answered"
            row[f"{prefix} Correct Answer"] = ", ".join(question_correct_options(question))
        row[f"{prefix} Marks"] = 0
        row[f"{prefix} Max"] = question.max_marks
        row[f"{prefix} Model Copy Risk"] = 0
        row[f"{prefix} Peer Similarity"] = 0
        row[f"{prefix} Similar Student"] = ""

    for sub in submissions:
        question = next((q for q in questions if q.id == sub.question_id), None)
        if not question:
            continue
        ev = db.query(EvaluationResult).filter(
            EvaluationResult.submission_id == sub.id
        ).first()
        if not ev:
            continue

        row = student_rows[sub.student_id]
        row["Total Marks"] += float(ev.marks)
        prefix = f"Q{question.order_index + 1}"
        row[f"{prefix} Answer"] = ", ".join(parse_mcq_answer(sub.answer_text)) if question.question_type == "mcq" else sub.answer_text
        row[f"{prefix} Marks"] = float(ev.marks)
        row[f"{prefix} Model Copy Risk"] = float(ev.copy_risk or 0)
        row[f"{prefix} Peer Similarity"] = float(ev.peer_similarity or 0)
        row[f"{prefix} Similar Student"] = similar_student_name(db, ev.similar_submission_id) or ""

    for row in student_rows.values():
        row["Percentage"] = round(
            (row["Total Marks"] / row["Total Max"]) * 100, 2
        ) if row["Total Max"] else 0

    headers = ["Student ID", "Student Name", "Total Marks", "Total Max", "Percentage"]
    for question in questions:
        prefix = f"Q{question.order_index + 1}"
        headers.extend([
            f"{prefix} Type",
            f"{prefix} Answer",
            f"{prefix} Correct Answer",
            f"{prefix} Marks",
            f"{prefix} Max",
            f"{prefix} Model Copy Risk",
            f"{prefix} Peer Similarity",
            f"{prefix} Similar Student",
        ])

    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=headers, extrasaction="ignore")
    writer.writeheader()
    for row in student_rows.values():
        writer.writerow(row)
    buffer.seek(0)

    filename = f"exam_{exam_id}_results.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
