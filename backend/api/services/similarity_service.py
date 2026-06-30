import re
from difflib import SequenceMatcher

from sqlalchemy.orm import Session

from api.models.submission import EvaluationResult, Submission
from api.models.user import User


def normalize_answer_text(text: str | None) -> str:
    return re.sub(r"\s+", " ", (text or "").lower()).strip()


def answer_similarity(first: str | None, second: str | None) -> float:
    first_clean = normalize_answer_text(first)
    second_clean = normalize_answer_text(second)
    if not first_clean or not second_clean:
        return 0.0

    first_tokens = set(re.findall(r"[a-z0-9]+", first_clean))
    second_tokens = set(re.findall(r"[a-z0-9]+", second_clean))
    if not first_tokens or not second_tokens:
        return 0.0

    token_overlap = len(first_tokens & second_tokens) / max(len(first_tokens | second_tokens), 1)
    sequence_score = SequenceMatcher(None, first_clean, second_clean).ratio()
    return round((token_overlap * 0.55 + sequence_score * 0.45) * 100, 2)


def update_peer_similarity(db: Session, submission: Submission, evaluation: EvaluationResult) -> None:
    peers = db.query(Submission).filter(
        Submission.question_id == submission.question_id,
        Submission.student_id != submission.student_id,
    ).all()

    best_score = 0.0
    best_submission = None
    for peer in peers:
        score = answer_similarity(submission.answer_text, peer.answer_text)
        if score > best_score:
            best_score = score
            best_submission = peer

    evaluation.peer_similarity = best_score
    evaluation.similar_submission_id = best_submission.id if best_submission else None


def similar_student_name(db: Session, submission_id: int | None) -> str | None:
    if not submission_id:
        return None
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        return None
    student = db.query(User).filter(User.id == submission.student_id).first()
    return student.full_name if student else "Unknown student"
