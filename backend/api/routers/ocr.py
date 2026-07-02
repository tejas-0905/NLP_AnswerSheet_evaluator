import os
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import settings
from api.dependencies import get_db, get_current_user
from api.models.user import User
from api.models.classroom import Classroom
from api.models.exam import Exam, ExamAccess, Question
from api.models.submission import Submission, EvaluationResult
from api.models.ocr import OCRSubmission, OCRQuestionExtraction
from api.services.ocr_service import correct_ocr_text_with_context, process_answer_sheet
from api.services.similarity_service import update_peer_similarity
from api.services.storage_service import upload_to_supabase, delete_from_supabase
from evaluator import evaluate_answer, parse_required_concepts

router = APIRouter(prefix="/ocr", tags=["OCR"])

MIN_AUTO_EVALUATE_CONFIDENCE = 55


def teacher_owns_ocr_submission(db: Session, teacher_id: int, ocr_sub: OCRSubmission) -> bool:
    exam = db.query(Exam).filter(Exam.id == ocr_sub.exam_id).first()
    if not exam:
        return False
    classroom = db.query(Classroom).filter(
        Classroom.id == exam.classroom_id,
        Classroom.teacher_id == teacher_id,
    ).first()
    return classroom is not None


def student_can_access_exam(db: Session, exam_id: int, student_id: int) -> bool:
    access_rows = db.query(ExamAccess).filter(ExamAccess.exam_id == exam_id).all()
    if not access_rows:
        return True
    return any(row.student_id == student_id for row in access_rows)


@router.get("/reviews")
def list_ocr_reviews(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "teacher":
        raise HTTPException(403, "Only teachers can view OCR reviews")

    rows = db.query(OCRSubmission).order_by(OCRSubmission.created_at.desc()).all()

    reviews = []
    for item in rows:
        if not teacher_owns_ocr_submission(db, current_user.id, item):
            continue
        exam = db.query(Exam).filter(Exam.id == item.exam_id).first()
        student = db.query(User).filter(User.id == item.student_id).first()
        low_confidence_count = db.query(OCRQuestionExtraction).filter(
            OCRQuestionExtraction.ocr_submission_id == item.id,
            OCRQuestionExtraction.confidence < MIN_AUTO_EVALUATE_CONFIDENCE,
            OCRQuestionExtraction.is_corrected == False,
        ).count()
        reviews.append({
            "id": item.id,
            "exam_id": item.exam_id,
            "exam_title": exam.title if exam else "Deleted exam",
            "student_id": item.student_id,
            "student_name": student.full_name if student else "Unknown student",
            "status": item.status,
            "confidence_score": float(item.confidence_score or 0),
            "low_confidence_count": low_confidence_count,
            "original_filename": item.original_filename,
            "created_at": item.created_at,
        })

    return reviews


@router.post("/upload/{exam_id}")
async def upload_answer_sheet(
    exam_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "student":
        raise HTTPException(403, "Only students can upload answer sheets")

    exam = db.query(Exam).filter(Exam.id == exam_id, Exam.is_active == True).first()
    if not exam:
        raise HTTPException(404, "Exam not found or not active")
    if not student_can_access_exam(db, exam_id, current_user.id):
        raise HTTPException(403, "You are not assigned to this exam")

    existing = db.query(OCRSubmission).filter(
        OCRSubmission.student_id == current_user.id,
        OCRSubmission.exam_id == exam_id,
    ).first()
    if (
        existing
        and existing.status == "evaluated"
        and float(existing.confidence_score or 0) >= MIN_AUTO_EVALUATE_CONFIDENCE
    ):
        raise HTTPException(400, "You have already submitted this exam")

    allowed = {".jpg", ".jpeg", ".png", ".pdf", ".webp"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed:
        raise HTTPException(400, f"File type not allowed. Use: {', '.join(allowed)}")

    file_bytes = await file.read()
    if len(file_bytes) > 20 * 1024 * 1024:
        raise HTTPException(400, "File too large. Maximum 20MB allowed")

    upload_path = f"answer_sheets/{current_user.id}_{exam_id}_{uuid4().hex}{ext}"
    upload_to_supabase(
        settings.SUPABASE_ANSWER_SHEETS_BUCKET,
        upload_path,
        file_bytes,
        file.content_type or "application/octet-stream",
    )

    if existing and existing.image_path:
        try:
            delete_from_supabase(settings.SUPABASE_ANSWER_SHEETS_BUCKET, existing.image_path)
        except Exception:
            pass

    questions = db.query(Question).filter(
        Question.exam_id == exam_id
    ).order_by(Question.order_index).all()

    if not questions:
        raise HTTPException(400, "This exam has no questions")

    if existing:
        ocr_sub = existing
        for question in questions:
            sub = db.query(Submission).filter(
                Submission.question_id == question.id,
                Submission.student_id == current_user.id,
            ).first()
            if sub:
                db.query(EvaluationResult).filter(
                    EvaluationResult.submission_id == sub.id
                ).delete()
                db.delete(sub)

        db.query(OCRQuestionExtraction).filter(
            OCRQuestionExtraction.ocr_submission_id == ocr_sub.id
        ).delete()
        ocr_sub.original_filename = file.filename
        ocr_sub.image_path = upload_path
        ocr_sub.extracted_text = None
        ocr_sub.confidence_score = None
        ocr_sub.ocr_error = None
        ocr_sub.status = "processing"
    else:
        ocr_sub = OCRSubmission(
            student_id=current_user.id,
            exam_id=exam_id,
            original_filename=file.filename,
            image_path=upload_path,
            status="processing",
        )
        db.add(ocr_sub)
    db.commit()
    db.refresh(ocr_sub)

    # Run OCR
    result = process_answer_sheet(file_bytes, file.filename, len(questions))

    if result.get("error"):
        ocr_sub.status = "error"
        ocr_sub.ocr_error = result["error"]
        db.commit()
        raise HTTPException(500, f"OCR failed: {result['error']}")

    ocr_sub.confidence_score = float(result["overall_confidence"])
    ocr_sub.status = "ocr_done"

    extractions = []
    for q_data in result["questions"]:
        idx = q_data["index"]
        if idx >= len(questions):
            continue
        question = questions[idx]
        raw_text = q_data["text"]
        corrected_text = correct_ocr_text_with_context(
            raw_text,
            question.question_text,
            question.model_answer,
            question.required_concepts,
        )
        ext_obj = OCRQuestionExtraction(
            ocr_submission_id=ocr_sub.id,
            question_id=question.id,
            extracted_text=raw_text,
            confidence=float(q_data["confidence"]),
            corrected_text=corrected_text if corrected_text != raw_text else None,
            is_corrected=corrected_text != raw_text,
        )
        db.add(ext_obj)
        extractions.append((question, corrected_text, float(q_data["confidence"])))

    db.commit()

    answered_extractions = [e for e in extractions if e[1].strip()]
    low_confidence = [e for e in answered_extractions if e[2] < MIN_AUTO_EVALUATE_CONFIDENCE]
    if low_confidence:
        ocr_sub.status = "needs_review"
        db.commit()
        return {
            "message": "Answer sheet processed. Low-confidence OCR needs teacher review before evaluation.",
            "pages_processed": result["pages_processed"],
            "overall_confidence": result["overall_confidence"],
            "questions_extracted": len(answered_extractions),
            "low_confidence_questions": len(low_confidence),
            "needs_review": True,
            "evaluation_results": [],
            "ocr_submission_id": ocr_sub.id,
        }

    # Auto-evaluate only when OCR confidence is acceptable.
    evaluation_results = []
    for question, text, conf in extractions:
        if not text.strip():
            continue

        sub = db.query(Submission).filter(
            Submission.question_id == question.id,
            Submission.student_id == current_user.id,
        ).first()
        if sub:
            sub.answer_text = text
        else:
            sub = Submission(
                student_id=current_user.id,
                question_id=question.id,
                answer_text=text,
            )
            db.add(sub)
            db.commit()
            db.refresh(sub)

        from sentence_transformers import SentenceTransformer
        try:
            model = SentenceTransformer("all-MiniLM-L6-v2", local_files_only=True)
        except Exception:
            model = SentenceTransformer("all-MiniLM-L6-v2")

        concepts = parse_required_concepts(question.required_concepts or "")
        ev = evaluate_answer(
            model_answer=question.model_answer,
            student_answer=text,
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
        update_peer_similarity(db, sub, result_row)
        result_row.covered_keywords = ev["covered_keywords"]
        result_row.missing_keywords = ev["missing_keywords"]
        result_row.suggestions = ev["suggestions"]
        evaluation_results.append({
            "question_id": question.id,
            "marks": ev["marks"],
            "confidence": conf,
        })

    ocr_sub.status = "evaluated"
    db.commit()

    return {
        "message": "Answer sheet processed and evaluated",
        "pages_processed": result["pages_processed"],
        "overall_confidence": result["overall_confidence"],
        "questions_extracted": len(answered_extractions),
        "low_confidence_questions": len(low_confidence),
        "needs_review": False,
        "evaluation_results": evaluation_results,
        "ocr_submission_id": ocr_sub.id,
    }


@router.get("/submission/{ocr_submission_id}")
def get_ocr_submission(
    ocr_submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ocr_sub = db.query(OCRSubmission).filter(
        OCRSubmission.id == ocr_submission_id
    ).first()
    if not ocr_sub:
        raise HTTPException(404, "Submission not found")
    if current_user.role == "teacher" and not teacher_owns_ocr_submission(db, current_user.id, ocr_sub):
        raise HTTPException(403, "Submission not found or not yours")
    if current_user.role == "student" and ocr_sub.student_id != current_user.id:
        raise HTTPException(403, "Submission not found")

    extractions = db.query(OCRQuestionExtraction).filter(
        OCRQuestionExtraction.ocr_submission_id == ocr_submission_id
    ).all()
    exam = db.query(Exam).filter(Exam.id == ocr_sub.exam_id).first()
    student = db.query(User).filter(User.id == ocr_sub.student_id).first()
    question_map = {
        question.id: question
        for question in db.query(Question).filter(
            Question.id.in_([item.question_id for item in extractions])
        ).all()
    }

    return {
        "id": ocr_sub.id,
        "exam_id": ocr_sub.exam_id,
        "exam_title": exam.title if exam else "Deleted exam",
        "student_id": ocr_sub.student_id,
        "student_name": student.full_name if student else "Unknown student",
        "status": ocr_sub.status,
        "confidence_score": float(ocr_sub.confidence_score or 0),
        "original_filename": ocr_sub.original_filename,
        "extractions": [
            {
                "question_id": e.question_id,
                "question_text": question_map[e.question_id].question_text if e.question_id in question_map else "",
                "extracted_text": e.corrected_text if e.is_corrected else e.extracted_text,
                "confidence": float(e.confidence or 0),
                "is_corrected": e.is_corrected,
            }
            for e in extractions
        ],
    }


class CorrectionRequest(BaseModel):
    question_id: int
    corrected_text: str

@router.patch("/correct/{ocr_submission_id}")
def correct_extraction(
    ocr_submission_id: int,
    payload: CorrectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "teacher":
        raise HTTPException(403, "Only teachers can correct OCR extractions")

    extraction = db.query(OCRQuestionExtraction).filter(
        OCRQuestionExtraction.ocr_submission_id == ocr_submission_id,
        OCRQuestionExtraction.question_id == payload.question_id,
    ).first()
    if not extraction:
        raise HTTPException(404, "Extraction not found")

    extraction.corrected_text = payload.corrected_text
    extraction.is_corrected = True

    # Re-evaluate with corrected text
    question = db.query(Question).filter(
        Question.id == payload.question_id
    ).first()
    ocr_sub = db.query(OCRSubmission).filter(
        OCRSubmission.id == ocr_submission_id
    ).first()
    if not ocr_sub or not teacher_owns_ocr_submission(db, current_user.id, ocr_sub):
        raise HTTPException(403, "Submission not found or not yours")

    sub = db.query(Submission).filter(
        Submission.question_id == payload.question_id,
        Submission.student_id == ocr_sub.student_id,
    ).first()

    if sub:
        sub.answer_text = payload.corrected_text
    else:
        sub = Submission(
            student_id=ocr_sub.student_id,
            question_id=payload.question_id,
            answer_text=payload.corrected_text,
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)

    ev_row = db.query(EvaluationResult).filter(
        EvaluationResult.submission_id == sub.id
    ).first()

    from sentence_transformers import SentenceTransformer
    try:
        model = SentenceTransformer("all-MiniLM-L6-v2", local_files_only=True)
    except Exception:
        model = SentenceTransformer("all-MiniLM-L6-v2")

    concepts = parse_required_concepts(question.required_concepts or "")
    ev = evaluate_answer(
        model_answer=question.model_answer,
        student_answer=payload.corrected_text,
        model=model,
        max_marks=question.max_marks,
        required_concepts=concepts,
    )

    if not ev_row:
        ev_row = EvaluationResult(submission_id=sub.id)
        db.add(ev_row)

    ev_row.marks = ev["marks"]
    ev_row.percentage = ev["percentage"]
    ev_row.grade_band = ev["grade_band"]
    ev_row.semantic_score = ev["scores"]["Semantic"]
    ev_row.keyword_score = ev["scores"]["Keyword"]
    ev_row.sentence_score = ev["scores"]["Sentence"]
    ev_row.length_score = ev["scores"]["Length"]
    ev_row.copy_risk = ev["copied_answer_risk"]
    update_peer_similarity(db, sub, ev_row)
    ev_row.covered_keywords = ev["covered_keywords"]
    ev_row.missing_keywords = ev["missing_keywords"]
    ev_row.suggestions = ev["suggestions"]

    remaining_review = db.query(OCRQuestionExtraction).filter(
        OCRQuestionExtraction.ocr_submission_id == ocr_submission_id,
        OCRQuestionExtraction.confidence < MIN_AUTO_EVALUATE_CONFIDENCE,
        OCRQuestionExtraction.is_corrected == False,
    ).count()
    if remaining_review == 0:
        ocr_sub.status = "evaluated"

    db.commit()
    return {"message": "Corrected and re-evaluated successfully"}
