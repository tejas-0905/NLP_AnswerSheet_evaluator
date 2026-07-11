import os
import json
import mimetypes
import re
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import settings
from api.dependencies import get_db, get_current_user
from api.models.user import User
from api.models.classroom import Classroom
from api.models.exam import Exam, ExamAccess, Question
from api.models.submission import Submission, EvaluationResult
from api.models.ocr import OCRSubmission, OCRQuestionExtraction
from api.services.model_service import get_sentence_model
from api.services.ocr_service import correct_ocr_text_with_context, process_answer_sheet
from api.services.similarity_service import update_peer_similarity
from api.services.storage_service import upload_to_supabase, delete_from_supabase, download_from_supabase
from evaluator import evaluate_answer, parse_required_concepts
from api.database import SessionLocal
import traceback

router = APIRouter(prefix="/ocr", tags=["OCR"])

MIN_AUTO_EVALUATE_CONFIDENCE = 55


def parse_mcq_answer(answer_text: str):
    def normalize_option(value: str) -> str:
        value = str(value).strip()
        return value.upper() if re.fullmatch(r"[A-Da-d]", value) else value

    try:
        value = json.loads(answer_text)
        if isinstance(value, list):
            return [normalize_option(item) for item in value if str(item).strip()]
        if isinstance(value, str):
            return [normalize_option(value)] if value.strip() else []
    except Exception:
        pass

    text = (answer_text or "").strip()
    if not text:
        return []

    options = re.findall(r"\b[A-Da-d]\b", text)
    if options:
        return [item.upper() for item in options]
    return [normalize_option(text)]


def evaluate_question_answer(question: Question, answer_text: str, model=None) -> dict:
    if question.question_type == "mcq":
        selected_options = sorted(parse_mcq_answer(answer_text))
        correct_options = sorted(
            question.correct_options or ([question.correct_option] if question.correct_option else [])
        )
        is_correct = selected_options == correct_options
        marks = question.max_marks if is_correct else 0
        return {
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

    concepts = parse_required_concepts(question.required_concepts or "")
    return evaluate_answer(
        model_answer=question.model_answer or "",
        student_answer=answer_text,
        model=model,
        max_marks=question.max_marks,
        required_concepts=concepts,
    )


def save_evaluation_result(db: Session, submission: Submission, evaluation: dict) -> None:
    result_row = db.query(EvaluationResult).filter(
        EvaluationResult.submission_id == submission.id
    ).first()
    if not result_row:
        result_row = EvaluationResult(submission_id=submission.id)
        db.add(result_row)

    result_row.marks = evaluation["marks"]
    result_row.percentage = evaluation["percentage"]
    result_row.grade_band = evaluation["grade_band"]
    result_row.semantic_score = evaluation["scores"]["Semantic"]
    result_row.keyword_score = evaluation["scores"]["Keyword"]
    result_row.sentence_score = evaluation["scores"]["Sentence"]
    result_row.length_score = evaluation["scores"]["Length"]
    result_row.copy_risk = evaluation["copied_answer_risk"]
    result_row.covered_keywords = evaluation["covered_keywords"]
    result_row.missing_keywords = evaluation["missing_keywords"]
    result_row.suggestions = evaluation["suggestions"]
    update_peer_similarity(db, submission, result_row)


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
            "has_uploaded_file": bool(item.image_path),
            "created_at": item.created_at,
        })

    return reviews


@router.post("/upload/{exam_id}")
async def upload_answer_sheet(
    exam_id: int,
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
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
    # Upload file to storage
    try:
        upload_to_supabase(
            settings.SUPABASE_ANSWER_SHEETS_BUCKET,
            upload_path,
            file_bytes,
            file.content_type or "application/octet-stream",
        )
    except Exception as e:
        raise HTTPException(500, f"Could not upload file to storage: {e}") from e
    finally:
        # Help memory pressure: release reference as soon as upload is done.
        file_bytes = b""


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

    # Create or update submission record and return immediately. Heavy OCR/eval runs in background.
    if existing:
        ocr_sub = existing
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

    def _background_process(ocr_id: int, filename: str, num_questions: int):
        db_bg = SessionLocal()
        try:
            ocr_obj = db_bg.query(OCRSubmission).filter(OCRSubmission.id == ocr_id).first()
            if not ocr_obj:
                return

            # Download file inside the job to avoid keeping big bytes in memory
            # in the web request/background-task setup.
            try:
                file_response = download_from_supabase(
                    settings.SUPABASE_ANSWER_SHEETS_BUCKET,
                    ocr_obj.image_path,
                )
                file_bytes_bg = file_response.content
            except Exception as e:
                ocr_obj.status = "error"
                ocr_obj.ocr_error = f"Could not download uploaded file: {e}"
                db_bg.commit()
                return

            # Run OCR
            try:
                result = process_answer_sheet(file_bytes_bg, filename, num_questions)
            except Exception as e:
                ocr_obj.status = "error"
                ocr_obj.ocr_error = str(e)
                db_bg.commit()
                return
            finally:
                # help GC
                try:
                    file_bytes_bg = b""
                except Exception:
                    pass


            if result.get("error"):
                ocr_obj.status = "error"
                ocr_obj.ocr_error = result["error"]
                db_bg.commit()
                return

            ocr_obj.confidence_score = float(result.get("overall_confidence", 0))
            ocr_obj.extracted_text = "\n\n".join(
                str(item.get("text", "")).strip()
                for item in result.get("questions", [])
                if str(item.get("text", "")).strip()
            ) or None
            ocr_obj.status = "ocr_done"
            db_bg.query(OCRQuestionExtraction).filter(
                OCRQuestionExtraction.ocr_submission_id == ocr_obj.id
            ).delete(synchronize_session=False)
            db_bg.commit()

            extractions = []
            questions_bg = db_bg.query(Question).filter(Question.exam_id == ocr_obj.exam_id).order_by(Question.order_index).all()
            for q_data in result.get("questions", []):
                idx = q_data.get("index", 0)
                if idx >= len(questions_bg):
                    continue
                question = questions_bg[idx]
                raw_text = q_data.get("text", "")
                corrected_text = correct_ocr_text_with_context(
                    raw_text,
                    question.question_text,
                    question.model_answer or "",
                    question.required_concepts,
                )
                ext_obj = OCRQuestionExtraction(
                    ocr_submission_id=ocr_obj.id,
                    question_id=question.id,
                    extracted_text=raw_text,
                    confidence=float(q_data.get("confidence", 0)),
                    corrected_text=corrected_text if corrected_text != raw_text else None,
                    is_corrected=corrected_text != raw_text,
                )
                db_bg.add(ext_obj)
                extractions.append((question, corrected_text or "", float(q_data.get("confidence", 0))))

            db_bg.commit()

            answered_extractions = [e for e in extractions if e[1].strip()]
            low_confidence = [e for e in answered_extractions if e[2] < MIN_AUTO_EVALUATE_CONFIDENCE]

            # Auto-evaluate extracted answers against each question's answer key/model answer.
            needs_nlp = any(question.question_type != "mcq" for question, text, _conf in extractions if text.strip())
            model = get_sentence_model() if needs_nlp else None

            for question, text, conf in extractions:
                if not text.strip():
                    continue

                sub = db_bg.query(Submission).filter(
                    Submission.question_id == question.id,
                    Submission.student_id == ocr_obj.student_id,
                ).first()
                if sub:
                    sub.answer_text = text
                else:
                    sub = Submission(
                        student_id=ocr_obj.student_id,
                        question_id=question.id,
                        answer_text=text,
                    )
                    db_bg.add(sub)
                    db_bg.commit()
                    db_bg.refresh(sub)

                ev = evaluate_question_answer(question, text, model=model)
                save_evaluation_result(db_bg, sub, ev)

            ocr_obj.status = "needs_review" if low_confidence else "evaluated"
            db_bg.commit()

        except Exception:
            try:
                o = db_bg.query(OCRSubmission).filter(OCRSubmission.id == ocr_id).first()
                if o:
                    o.status = "error"
                    o.ocr_error = traceback.format_exc()
                    db_bg.commit()
            finally:
                pass
        finally:
            db_bg.close()

    # schedule background processing
    # IMPORTANT: do not pass file_bytes into the job; downloading inside the job
    # reduces peak memory in the web request/worker.
    if background_tasks is not None:
        background_tasks.add_task(_background_process, ocr_sub.id, file.filename, len(questions))
    else:
        _background_process(ocr_sub.id, file.filename, len(questions))


    return {
        "message": "Answer sheet uploaded and queued for processing",
        "ocr_submission_id": ocr_sub.id,
        "needs_review": None,
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
        "has_uploaded_file": bool(ocr_sub.image_path),
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


@router.get("/submission/{ocr_submission_id}/file")
def get_ocr_submission_file(
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
    if current_user.role not in {"teacher", "student"}:
        raise HTTPException(403, "Not allowed")
    if not ocr_sub.image_path:
        raise HTTPException(404, "Uploaded file not found")

    try:
        file_response = download_from_supabase(
            settings.SUPABASE_ANSWER_SHEETS_BUCKET,
            ocr_sub.image_path,
        )
    except Exception as e:
        raise HTTPException(502, f"Could not load uploaded file: {e}") from e

    filename = ocr_sub.original_filename or os.path.basename(ocr_sub.image_path)
    media_type = (
        file_response.headers.get("content-type")
        or mimetypes.guess_type(filename)[0]
        or "application/octet-stream"
    )
    disposition = "inline" if media_type.startswith("image/") or media_type == "application/pdf" else "attachment"
    safe_filename = filename.replace('"', "")
    return Response(
        content=file_response.content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'{disposition}; filename="{safe_filename}"',
            "Cache-Control": "private, max-age=300",
        },
    )


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

    ocr_sub = db.query(OCRSubmission).filter(
        OCRSubmission.id == ocr_submission_id
    ).first()
    if not ocr_sub or not teacher_owns_ocr_submission(db, current_user.id, ocr_sub):
        raise HTTPException(403, "Submission not found or not yours")

    extraction = db.query(OCRQuestionExtraction).filter(
        OCRQuestionExtraction.ocr_submission_id == ocr_submission_id,
        OCRQuestionExtraction.question_id == payload.question_id,
    ).first()
    if not extraction:
        raise HTTPException(404, "Extraction not found")

    # Re-evaluate with corrected text
    question = db.query(Question).filter(
        Question.id == payload.question_id
    ).first()
    if not question:
        raise HTTPException(404, "Question not found")

    extraction.corrected_text = payload.corrected_text
    extraction.is_corrected = True

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

    model = get_sentence_model() if question.question_type != "mcq" else None
    ev = evaluate_question_answer(question, payload.corrected_text, model=model)
    save_evaluation_result(db, sub, ev)

    remaining_review = db.query(OCRQuestionExtraction).filter(
        OCRQuestionExtraction.ocr_submission_id == ocr_submission_id,
        OCRQuestionExtraction.confidence < MIN_AUTO_EVALUATE_CONFIDENCE,
        OCRQuestionExtraction.is_corrected == False,
    ).count()
    if remaining_review == 0:
        ocr_sub.status = "evaluated"

    db.commit()
    return {"message": "Corrected and re-evaluated successfully"}
