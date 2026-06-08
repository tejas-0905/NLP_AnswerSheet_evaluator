import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel

from api.dependencies import get_db, get_current_user
from api.models.user import User
from api.models.exam import Exam, Question
from api.models.submission import Submission, EvaluationResult
from api.models.ocr import OCRSubmission, OCRQuestionExtraction
from api.services.ocr_service import correct_ocr_text_with_context, process_answer_sheet
from evaluator import evaluate_answer, parse_required_concepts

router = APIRouter(prefix="/ocr", tags=["OCR"])

UPLOAD_DIR = "uploads/answer_sheets"
MIN_AUTO_EVALUATE_CONFIDENCE = 55
os.makedirs(UPLOAD_DIR, exist_ok=True)


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

    save_path = f"{UPLOAD_DIR}/{current_user.id}_{exam_id}_{file.filename}"
    with open(save_path, "wb") as f:
        f.write(file_bytes)

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
        ocr_sub.image_path = save_path
        ocr_sub.extracted_text = None
        ocr_sub.confidence_score = None
        ocr_sub.ocr_error = None
        ocr_sub.status = "processing"
    else:
        ocr_sub = OCRSubmission(
            student_id=current_user.id,
            exam_id=exam_id,
            original_filename=file.filename,
            image_path=save_path,
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

    low_confidence = [e for e in extractions if e[2] < MIN_AUTO_EVALUATE_CONFIDENCE]
    if low_confidence:
        ocr_sub.status = "needs_review"
        db.commit()
        return {
            "message": "Answer sheet processed. Low-confidence OCR needs teacher review before evaluation.",
            "pages_processed": result["pages_processed"],
            "overall_confidence": result["overall_confidence"],
            "questions_extracted": len(extractions),
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
        "questions_extracted": len(extractions),
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

    extractions = db.query(OCRQuestionExtraction).filter(
        OCRQuestionExtraction.ocr_submission_id == ocr_submission_id
    ).all()

    return {
        "id": ocr_sub.id,
        "status": ocr_sub.status,
        "confidence_score": float(ocr_sub.confidence_score or 0),
        "original_filename": ocr_sub.original_filename,
        "extractions": [
            {
                "question_id": e.question_id,
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
