import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from api.dependencies import get_db, get_current_user
from api.models.user import User
from api.models.classroom import Classroom, ClassroomMember
from api.models.exam import Exam, ExamAccess, Question
from api.models.submission import Submission, EvaluationResult
from api.models.ocr import OCRSubmission
from api.services.model_service import get_sentence_model
from api.services.similarity_service import similar_student_name, update_peer_similarity
from evaluator import evaluate_answer, parse_required_concepts

router = APIRouter(prefix="/student", tags=["Student"])


def student_can_access_exam(db: Session, exam_id: int, student_id: int) -> bool:
    access_rows = db.query(ExamAccess).filter(ExamAccess.exam_id == exam_id).all()
    if not access_rows:
        return True
    return any(row.student_id == student_id for row in access_rows)


def parse_mcq_answer(answer_text: str):
    try:
        value = json.loads(answer_text)
        if isinstance(value, list):
            return [str(item) for item in value]
        if isinstance(value, str):
            return [value]
    except Exception:
        pass
    return [answer_text]


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
        if not student_can_access_exam(db, e.id, current_user.id):
            continue
        questions = db.query(Question).filter(Question.exam_id == e.id).all()
        attempted = False
        ocr_submission = db.query(OCRSubmission).filter(
            OCRSubmission.exam_id == e.id,
            OCRSubmission.student_id == current_user.id,
        ).order_by(OCRSubmission.created_at.desc()).first()
        if questions:
            q_ids = [question.id for question in questions]
            sub = db.query(Submission).filter(
                Submission.question_id.in_(q_ids),
                Submission.student_id == current_user.id,
            ).first()
            attempted = sub is not None or (
                ocr_submission is not None and ocr_submission.status != "error"
            )
        result.append({
            "id": e.id,
            "title": e.title,
            "description": e.description,
            "time_limit_minutes": e.time_limit_minutes,
            "question_count": len(questions),
            "total_marks": sum(q.max_marks for q in questions),
            "attempted": attempted,
            "ocr_submission_id": ocr_submission.id if ocr_submission else None,
            "ocr_status": ocr_submission.status if ocr_submission else None,
            "ocr_confidence": float(ocr_submission.confidence_score or 0) if ocr_submission else None,
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
    if not student_can_access_exam(db, exam_id, current_user.id):
        raise HTTPException(403, "You are not assigned to this exam")

    questions = db.query(Question).filter(
        Question.exam_id == exam_id
    ).order_by(Question.order_index).all()

    return [
        {
            "id": q.id,
            "question_type": q.question_type,
            "question_text": q.question_text,
            "max_marks": q.max_marks,
            "options": q.options or [],
            "allow_multiple": q.allow_multiple,
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
    question_ids = [item.question_id for item in payload.answers]
    exam = db.query(Exam).filter(Exam.id == exam_id, Exam.is_active == True).first()
    if not exam:
        raise HTTPException(404, "Exam not found or not active")
    if not student_can_access_exam(db, exam_id, current_user.id):
        raise HTTPException(403, "You are not assigned to this exam")

    submitted_questions = db.query(Question).filter(
        Question.id.in_(question_ids),
        Question.exam_id == exam_id,
    ).all()
    question_map = {question.id: question for question in submitted_questions}
    needs_nlp = any(
        question.question_type != "mcq"
        for question in submitted_questions
    )
    model = None
    if needs_nlp:
        model = get_sentence_model()

    results = []
    for item in payload.answers:
        question = question_map.get(item.question_id)
        if not question:
            continue

        existing = db.query(Submission).filter(
            Submission.question_id == item.question_id,
            Submission.student_id == current_user.id,
        ).first()
        if existing:
            sub = existing
            sub.answer_text = item.answer_text
        else:
            sub = Submission(
                student_id=current_user.id,
                question_id=item.question_id,
                answer_text=item.answer_text,
            )
            db.add(sub)
        db.commit()
        db.refresh(sub)

        if question.question_type == "mcq":
            selected_options = sorted(parse_mcq_answer(item.answer_text))
            correct_options = sorted(question.correct_options or ([question.correct_option] if question.correct_option else []))
            is_correct = selected_options == correct_options
            marks = question.max_marks if is_correct else 0
            percentage = 100 if is_correct else 0
            ev = {
                "marks": marks,
                "percentage": percentage,
                "grade_band": "Excellent" if is_correct else "At risk",
                "scores": {
                    "Semantic": 1 if is_correct else 0,
                    "Keyword": 1 if is_correct else 0,
                    "Sentence": 1 if is_correct else 0,
                    "Length": 1 if is_correct else 0,
                },
                "copied_answer_risk": 0,
                "covered_keywords": correct_options if is_correct else selected_options,
                "missing_keywords": [] if is_correct else correct_options,
                "suggestions": [] if is_correct else ["Review the correct option."],
            }
        else:
            concepts = parse_required_concepts(question.required_concepts or "")
            ev = evaluate_answer(
                model_answer=question.model_answer or "",
                student_answer=item.answer_text,
                model=model,
                max_marks=question.max_marks,
                required_concepts=concepts,
            )

        result_row = db.query(EvaluationResult).filter(
            EvaluationResult.submission_id == sub.id
        ).first()
        if not result_row:
            result_row = EvaluationResult(submission_id=sub.id)
            db.add(result_row)

        result_row.marks = ev["marks"]
        result_row.percentage = ev["percentage"]
        result_row.grade_band = ev["grade_band"]
        result_row.semantic_score = ev["scores"]["Semantic"]
        result_row.keyword_score = ev["scores"]["Keyword"]
        result_row.sentence_score = ev["scores"]["Sentence"]
        result_row.length_score = ev["scores"]["Length"]
        result_row.copy_risk = ev["copied_answer_risk"]
        result_row.covered_keywords = ev["covered_keywords"]
        result_row.missing_keywords = ev["missing_keywords"]
        result_row.suggestions = ev["suggestions"]
        update_peer_similarity(db, sub, result_row)
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
    questions = db.query(Question).filter(
        Question.exam_id == exam_id
    ).order_by(Question.order_index).all()
    q_ids = [question.id for question in questions]
    attempted = db.query(Submission).filter(
        Submission.question_id.in_(q_ids),
        Submission.student_id == current_user.id,
    ).first()
    output = []
    total_marks = 0
    total_max = sum(q.max_marks for q in questions) if attempted else 0
    missing_evaluation_model = None

    for q in questions:
        sub = db.query(Submission).filter(
            Submission.question_id == q.id,
            Submission.student_id == current_user.id,
        ).first()
        if not sub:
            if attempted:
                output.append({
                    "question_id": q.id,
                    "question_type": q.question_type,
                    "question_text": q.question_text,
            "answer_text": "",
            "correct_option": q.correct_option,
            "correct_options": q.correct_options or ([q.correct_option] if q.correct_option else []),
            "allow_multiple": q.allow_multiple,
            "is_correct": False if q.question_type == "mcq" else None,
                    "max_marks": q.max_marks,
                    "marks": 0,
                    "percentage": 0,
                    "grade_band": "Not answered",
                    "semantic_score": 0,
                    "keyword_score": 0,
                    "sentence_score": 0,
                    "length_score": 0,
                    "copy_risk": 0,
                    "peer_similarity": 0,
                    "similar_student_name": None,
                    "review_requested": False,
                    "teacher_review_note": None,
                    "covered_keywords": [],
                    "missing_keywords": [],
                    "suggestions": ["No answer submitted."],
                })
            continue
        ev = db.query(EvaluationResult).filter(
            EvaluationResult.submission_id == sub.id
        ).first()
        if not ev:
            if q.question_type == "mcq":
                selected_options = sorted(parse_mcq_answer(sub.answer_text))
                correct_options = sorted(q.correct_options or ([q.correct_option] if q.correct_option else []))
                is_correct = selected_options == correct_options
                marks = q.max_marks if is_correct else 0
                result = {
                    "marks": marks,
                    "percentage": 100 if is_correct else 0,
                    "grade_band": "Excellent" if is_correct else "At risk",
                    "scores": {
                        "Semantic": 1 if is_correct else 0,
                        "Keyword": 1 if is_correct else 0,
                        "Sentence": 1 if is_correct else 0,
                        "Length": 1 if is_correct else 0,
                    },
                    "copied_answer_risk": 0,
                    "covered_keywords": correct_options if is_correct else selected_options,
                    "missing_keywords": [] if is_correct else correct_options,
                    "suggestions": [] if is_correct else ["Review the correct option."],
                }
            else:
                if missing_evaluation_model is None:
                    missing_evaluation_model = get_sentence_model()
                concepts = parse_required_concepts(q.required_concepts or "")
                result = evaluate_answer(
                    model_answer=q.model_answer or "",
                    student_answer=sub.answer_text,
                    model=missing_evaluation_model,
                    max_marks=q.max_marks,
                    required_concepts=concepts,
                )

            ev = EvaluationResult(
                submission_id=sub.id,
                marks=result["marks"],
                percentage=result["percentage"],
                grade_band=result["grade_band"],
                semantic_score=result["scores"]["Semantic"],
                keyword_score=result["scores"]["Keyword"],
                sentence_score=result["scores"]["Sentence"],
                length_score=result["scores"]["Length"],
                copy_risk=result["copied_answer_risk"],
                covered_keywords=result["covered_keywords"],
                missing_keywords=result["missing_keywords"],
                suggestions=result["suggestions"],
            )
            update_peer_similarity(db, sub, ev)
            db.add(ev)
            db.commit()
            db.refresh(ev)

        if not ev:
            if attempted:
                output.append({
                    "question_id": q.id,
                    "question_type": q.question_type,
                    "question_text": q.question_text,
                    "answer_text": sub.answer_text,
                    "correct_option": q.correct_option,
                    "correct_options": q.correct_options or ([q.correct_option] if q.correct_option else []),
                    "allow_multiple": q.allow_multiple,
                    "is_correct": (
                        sorted(parse_mcq_answer(sub.answer_text)) == sorted(q.correct_options or ([q.correct_option] if q.correct_option else []))
                        if q.question_type == "mcq"
                        else None
                    ),
                    "max_marks": q.max_marks,
                    "marks": 0,
                    "percentage": 0,
                    "grade_band": "Not evaluated",
                    "semantic_score": 0,
                    "keyword_score": 0,
                    "sentence_score": 0,
                    "length_score": 0,
                    "copy_risk": 0,
                    "peer_similarity": 0,
                    "similar_student_name": None,
                    "review_requested": False,
                    "teacher_review_note": None,
                    "covered_keywords": [],
                    "missing_keywords": [],
                    "suggestions": ["Answer is submitted but not evaluated yet."],
                })
            continue

        total_marks += float(ev.marks)
        output.append({
            "question_id": q.id,
            "question_type": q.question_type,
            "question_text": q.question_text,
            "answer_text": sub.answer_text,
            "correct_option": q.correct_option,
            "correct_options": q.correct_options or ([q.correct_option] if q.correct_option else []),
            "allow_multiple": q.allow_multiple,
            "is_correct": (
                sorted(parse_mcq_answer(sub.answer_text)) == sorted(q.correct_options or ([q.correct_option] if q.correct_option else []))
                if q.question_type == "mcq"
                else None
            ),
            "max_marks": q.max_marks,
            "marks": float(ev.marks),
            "percentage": float(ev.percentage),
            "grade_band": ev.grade_band,
            "semantic_score": float(ev.semantic_score or 0),
            "keyword_score": float(ev.keyword_score or 0),
            "sentence_score": float(ev.sentence_score or 0),
            "length_score": float(ev.length_score or 0),
            "copy_risk": float(ev.copy_risk or 0),
            "peer_similarity": float(ev.peer_similarity or 0),
            "similar_student_name": similar_student_name(db, ev.similar_submission_id),
            "review_requested": bool(ev.review_requested),
            "teacher_review_note": ev.teacher_review_note or None,
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
