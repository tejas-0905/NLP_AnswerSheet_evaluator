from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from api.dependencies import get_db, get_current_user
from api.models.user import User
from api.models.classroom import Classroom, ClassroomMember
from api.models.exam import Exam, Question
from api.models.submission import Submission, EvaluationResult
from evaluator import evaluate_answer, parse_required_concepts

router = APIRouter(prefix="/student", tags=["Student"])


# ── join classroom ──────────────────────────────────────────
class JoinRequest(BaseModel):
    code: str

@router.post("/join-classroom")
def join_classroom(
    payload: JoinRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "student":
        raise HTTPException(403, "Only students can join classrooms")

    classroom = db.query(Classroom).filter(
        Classroom.code == payload.code.strip().upper(),
        Classroom.is_active == True,
    ).first()
    if not classroom:
        raise HTTPException(404, "Invalid classroom code")

    already = db.query(ClassroomMember).filter(
        ClassroomMember.classroom_id == classroom.id,
        ClassroomMember.student_id == current_user.id,
    ).first()
    if already:
        raise HTTPException(400, "You already joined this classroom")

    member = ClassroomMember(classroom_id=classroom.id, student_id=current_user.id)
    db.add(member)
    db.commit()
    return {"message": f"Joined {classroom.name}", "classroom_id": classroom.id}


# ── my classrooms ───────────────────────────────────────────
@router.get("/classrooms")
def my_classrooms(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    memberships = db.query(ClassroomMember).filter(
        ClassroomMember.student_id == current_user.id
    ).all()

    result = []
    for m in memberships:
        c = db.query(Classroom).filter(Classroom.id == m.classroom_id).first()
        if not c:
            continue
        exam_count = db.query(Exam).filter(
            Exam.classroom_id == c.id, Exam.is_active == True
        ).count()
        teacher = db.query(User).filter(User.id == c.teacher_id).first()
        result.append({
            "id": c.id,
            "name": c.name,
            "code": c.code,
            "teacher_name": teacher.full_name if teacher else "Unknown",
            "active_exams": exam_count,
            "joined_at": m.joined_at,
        })
    return result


# ── exams for a classroom ────────────────────────────────────
@router.get("/classrooms/{classroom_id}/exams")
def get_exams(
    classroom_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = db.query(ClassroomMember).filter(
        ClassroomMember.classroom_id == classroom_id,
        ClassroomMember.student_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(403, "You are not a member of this classroom")

    exams = db.query(Exam).filter(
        Exam.classroom_id == classroom_id,
        Exam.is_active == True,
    ).all()

    result = []
    for e in exams:
        questions = db.query(Question).filter(Question.exam_id == e.id).all()
        attempted = False
        if questions:
            sub = db.query(Submission).filter(
                Submission.question_id == questions[0].id,
                Submission.student_id == current_user.id,
            ).first()
            attempted = sub is not None
        result.append({
            "id": e.id,
            "title": e.title,
            "description": e.description,
            "time_limit_minutes": e.time_limit_minutes,
            "question_count": len(questions),
            "total_marks": sum(q.max_marks for q in questions),
            "attempted": attempted,
        })
    return result


# ── exam questions ───────────────────────────────────────────
@router.get("/exams/{exam_id}/questions")
def get_questions(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exam = db.query(Exam).filter(Exam.id == exam_id, Exam.is_active == True).first()
    if not exam:
        raise HTTPException(404, "Exam not found or not active")

    questions = db.query(Question).filter(
        Question.exam_id == exam_id
    ).order_by(Question.order_index).all()

    return [
        {
            "id": q.id,
            "question_text": q.question_text,
            "max_marks": q.max_marks,
            "order_index": q.order_index,
        }
        for q in questions
    ]


# ── submit answers ───────────────────────────────────────────
class AnswerItem(BaseModel):
    question_id: int
    answer_text: str

class SubmitRequest(BaseModel):
    answers: list[AnswerItem]

@router.post("/exams/{exam_id}/submit")
def submit_exam(
    exam_id: int,
    payload: SubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sentence_transformers import SentenceTransformer
    try:
        model = SentenceTransformer("all-MiniLM-L6-v2", local_files_only=True)
    except Exception:
        model = SentenceTransformer("all-MiniLM-L6-v2")

    results = []
    for item in payload.answers:
        question = db.query(Question).filter(Question.id == item.question_id).first()
        if not question:
            continue

        existing = db.query(Submission).filter(
            Submission.question_id == item.question_id,
            Submission.student_id == current_user.id,
        ).first()
        if existing:
            continue

        sub = Submission(
            student_id=current_user.id,
            question_id=item.question_id,
            answer_text=item.answer_text,
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)

        concepts = parse_required_concepts(question.required_concepts or "")
        ev = evaluate_answer(
            model_answer=question.model_answer,
            student_answer=item.answer_text,
            model=model,
            max_marks=question.max_marks,
            required_concepts=concepts,
        )

        result_row = EvaluationResult(
            submission_id=sub.id,
            marks=ev["marks"],
            percentage=ev["percentage"],
            grade_band=ev["grade_band"],
            semantic_score=ev["scores"]["Semantic"],
            keyword_score=ev["scores"]["Keyword"],
            sentence_score=ev["scores"]["Sentence"],
            length_score=ev["scores"]["Length"],
            copy_risk=ev["copied_answer_risk"],
            covered_keywords=ev["covered_keywords"],
            missing_keywords=ev["missing_keywords"],
            suggestions=ev["suggestions"],
        )
        db.add(result_row)
        db.commit()
        results.append({"question_id": item.question_id, "marks": ev["marks"]})

    return {"message": "Submitted and evaluated", "results": results}


# ── my results for an exam ───────────────────────────────────
@router.get("/exams/{exam_id}/my-results")
def my_results(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    questions = db.query(Question).filter(Question.exam_id == exam_id).all()
    output = []
    total_marks = 0
    total_max = 0

    for q in questions:
        sub = db.query(Submission).filter(
            Submission.question_id == q.id,
            Submission.student_id == current_user.id,
        ).first()
        if not sub:
            continue
        ev = db.query(EvaluationResult).filter(
            EvaluationResult.submission_id == sub.id
        ).first()
        if not ev:
            continue

        total_marks += float(ev.marks)
        total_max += q.max_marks
        output.append({
            "question_id": q.id,
            "question_text": q.question_text,
            "answer_text": sub.answer_text,
            "max_marks": q.max_marks,
            "marks": float(ev.marks),
            "percentage": float(ev.percentage),
            "grade_band": ev.grade_band,
            "semantic_score": float(ev.semantic_score or 0),
            "keyword_score": float(ev.keyword_score or 0),
            "sentence_score": float(ev.sentence_score or 0),
            "length_score": float(ev.length_score or 0),
            "copy_risk": float(ev.copy_risk or 0),
            "covered_keywords": ev.covered_keywords or [],
            "missing_keywords": ev.missing_keywords or [],
            "suggestions": ev.suggestions or [],
        })

    overall_pct = round((total_marks / total_max) * 100, 2) if total_max else 0
    return {
        "questions": output,
        "total_marks": round(total_marks, 2),
        "total_max": total_max,
        "overall_percentage": overall_pct,
    }


# ── my rank in classroom ─────────────────────────────────────
@router.get("/classrooms/{classroom_id}/my-rank")
def my_rank(
    classroom_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exams = db.query(Exam).filter(Exam.classroom_id == classroom_id).all()
    members = db.query(ClassroomMember).filter(
        ClassroomMember.classroom_id == classroom_id
    ).all()

    scores = {}
    for m in members:
        scores[m.student_id] = {"total": 0, "max": 0}

    for exam in exams:
        questions = db.query(Question).filter(Question.exam_id == exam.id).all()
        for q in questions:
            subs = db.query(Submission).filter(Submission.question_id == q.id).all()
            for sub in subs:
                ev = db.query(EvaluationResult).filter(
                    EvaluationResult.submission_id == sub.id
                ).first()
                if ev and sub.student_id in scores:
                    scores[sub.student_id]["total"] += float(ev.marks)
                    scores[sub.student_id]["max"] += q.max_marks

    ranked = sorted(
        scores.items(),
        key=lambda x: (x[1]["total"] / x[1]["max"]) if x[1]["max"] else 0,
        reverse=True,
    )

    my_rank = next((i + 1 for i, (sid, _) in enumerate(ranked) if sid == current_user.id), None)
    my_score = scores.get(current_user.id, {"total": 0, "max": 0})
    pct = round((my_score["total"] / my_score["max"]) * 100, 2) if my_score["max"] else 0

    return {
        "rank": my_rank,
        "total_students": len(ranked),
        "percentage": pct,
    }
