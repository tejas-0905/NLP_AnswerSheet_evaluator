import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from config import settings
from api.dependencies import get_db, get_current_user
from api.models.classroom import Classroom, ClassroomMember, Note
from api.models.user import User
from api.services.storage_service import upload_to_supabase, delete_from_supabase, download_from_supabase


router = APIRouter(prefix="/notes", tags=["Notes"])

UPLOAD_DIR = Path("uploads/notes")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".ppt",
    ".pptx",
    ".txt",
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}
MAX_NOTE_SIZE = 25 * 1024 * 1024


def teacher_owns_classroom(db: Session, classroom_id: int, teacher_id: int) -> Classroom:
    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == teacher_id,
    ).first()
    if not classroom:
        raise HTTPException(404, "Classroom not found or not yours")
    return classroom


def student_belongs_to_classroom(db: Session, classroom_id: int, student_id: int) -> ClassroomMember:
    member = db.query(ClassroomMember).filter(
        ClassroomMember.classroom_id == classroom_id,
        ClassroomMember.student_id == student_id,
    ).first()
    if not member:
        raise HTTPException(403, "You are not a member of this classroom")
    return member


def user_can_access_note(db: Session, note: Note, user: User) -> bool:
    if user.role == "teacher":
        return note.teacher_id == user.id
    if user.role == "student":
        member = db.query(ClassroomMember).filter(
            ClassroomMember.classroom_id == note.classroom_id,
            ClassroomMember.student_id == user.id,
        ).first()
        return member is not None
    return False


def note_response(note: Note) -> dict:
    return {
        "id": note.id,
        "classroom_id": note.classroom_id,
        "title": note.title,
        "description": note.description,
        "original_filename": note.original_filename,
        "content_type": note.content_type,
        "file_size": note.file_size,
        "created_at": note.created_at,
    }


async def read_note_file(file: UploadFile) -> tuple[str, str, bytes]:
    original_filename = file.filename or "note"
    extension = os.path.splitext(original_filename)[1].lower()
    if extension not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise HTTPException(400, f"File type not allowed. Use: {allowed}")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(400, f"{original_filename} is empty")
    if len(file_bytes) > MAX_NOTE_SIZE:
        raise HTTPException(400, f"{original_filename} is too large. Maximum 25MB allowed")

    return original_filename, extension, file_bytes


@router.get("/")
def list_notes(
    classroom_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "teacher":
        query = db.query(Note).join(Classroom, Note.classroom_id == Classroom.id).filter(
            Classroom.teacher_id == current_user.id
        )
        if classroom_id:
            teacher_owns_classroom(db, classroom_id, current_user.id)
            query = query.filter(Note.classroom_id == classroom_id)
    elif current_user.role == "student":
        query = db.query(Note).join(
            ClassroomMember,
            Note.classroom_id == ClassroomMember.classroom_id,
        ).filter(ClassroomMember.student_id == current_user.id)
        if classroom_id:
            student_belongs_to_classroom(db, classroom_id, current_user.id)
            query = query.filter(Note.classroom_id == classroom_id)
    else:
        raise HTTPException(403, "Only teachers and students can view notes")

    notes = query.order_by(Note.created_at.desc()).all()
    return [note_response(note) for note in notes]


@router.post("/")
async def upload_note(
    classroom_id: int = Form(...),
    title: str = Form(...),
    description: str | None = Form(None),
    files: list[UploadFile] | None = File(None),
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "teacher":
        raise HTTPException(403, "Only teachers can upload notes")

    teacher_owns_classroom(db, classroom_id, current_user.id)

    clean_title = title.strip()
    if not clean_title:
        raise HTTPException(400, "Note title is required")

    upload_files = files or ([file] if file else [])
    if not upload_files:
        raise HTTPException(400, "At least one note file is required")

    prepared_files = []
    for upload_file in upload_files:
        original_filename, extension, file_bytes = await read_note_file(upload_file)
        prepared_files.append((upload_file, original_filename, extension, file_bytes))

    notes = []
    for upload_file, original_filename, extension, file_bytes in prepared_files:
        stored_filename = f"{current_user.id}_{classroom_id}_{uuid.uuid4().hex}{extension}"
        file_path = f"notes/{stored_filename}"
        upload_to_supabase(
            settings.SUPABASE_NOTES_BUCKET,
            file_path,
            file_bytes,
            upload_file.content_type or "application/octet-stream",
        )

        note = Note(
            classroom_id=classroom_id,
            teacher_id=current_user.id,
            title=clean_title,
            description=(description or "").strip() or None,
            original_filename=original_filename,
            stored_filename=stored_filename,
            file_path=file_path,
            content_type=upload_file.content_type,
            file_size=len(file_bytes),
        )
        db.add(note)
        notes.append(note)

    db.commit()
    for note in notes:
        db.refresh(note)
    return [note_response(note) for note in notes]


@router.get("/{note_id}/download")
def download_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(404, "Note not found")
    if not user_can_access_note(db, note, current_user):
        raise HTTPException(403, "You do not have access to this note")

    if note.file_path and note.file_path.startswith("notes/"):
        try:
            response = download_from_supabase(settings.SUPABASE_NOTES_BUCKET, note.file_path)
        except Exception:
            raise HTTPException(404, "Uploaded file is missing")

        return StreamingResponse(
            iter([response.content]),
            media_type=note.content_type or "application/octet-stream",
            headers={
                "Content-Disposition": f"attachment; filename=\"{note.original_filename}\""
            },
        )

    if not os.path.exists(note.file_path):
        raise HTTPException(404, "Uploaded file is missing")

    return StreamingResponse(
        open(note.file_path, "rb"),
        media_type=note.content_type or "application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename=\"{note.original_filename}\""
        },
    )


@router.delete("/{note_id}")
def delete_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "teacher":
        raise HTTPException(403, "Only teachers can delete notes")

    note = db.query(Note).filter(Note.id == note_id, Note.teacher_id == current_user.id).first()
    if not note:
        raise HTTPException(404, "Note not found")

    if note.file_path and note.file_path.startswith("notes/"):
        try:
            delete_from_supabase(settings.SUPABASE_NOTES_BUCKET, note.file_path)
        except Exception:
            pass
    elif os.path.exists(note.file_path):
        os.remove(note.file_path)

    db.delete(note)
    db.commit()
    return {"message": "Note deleted"}
