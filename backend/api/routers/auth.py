from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session
from config import settings
from api.dependencies import get_db, get_current_user
from api.models.user import User
from api.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UserSettingsUpdate
from api.services.auth_service import (
    hash_password, verify_password,
    create_access_token,
)
from api.services.storage_service import upload_to_supabase, delete_from_supabase, build_storage_public_url

router = APIRouter(prefix="/auth", tags=["Auth"])


def build_profile_photo_url(path: str | None) -> str | None:
    if not path:
        return None
    return build_storage_public_url(settings.SUPABASE_PROFILE_PHOTO_BUCKET, path)


@router.post("/register", response_model=TokenResponse)
async def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    email = str(payload.email).strip().lower()
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=email,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "name": user.full_name,
    }


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    email = str(payload.email).strip().lower()
    user = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "name": user.full_name,
    }


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "institution": current_user.institution or "",
        "department": current_user.department or "",
        "bio": current_user.bio or "",
        "profile_photo_url": build_profile_photo_url(current_user.profile_photo_path),
        "notify_submissions": current_user.notify_submissions,
        "notify_low_scores": current_user.notify_low_scores,
        "notify_ocr_review": current_user.notify_ocr_review,
        "default_question_marks": current_user.default_question_marks or 10,
        "release_marks_immediately": current_user.release_marks_immediately,
    }


@router.post("/me/photo")
async def upload_profile_photo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    allowed_types = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }

    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only JPEG, JPG, PNG or WEBP files are supported")

    extension = allowed_types[file.content_type]
    filename = f"{current_user.id}_{uuid4().hex}{extension}"
    upload_path = f"profile_photos/{filename}"
    content = await file.read()

    upload_to_supabase(
        settings.SUPABASE_PROFILE_PHOTO_BUCKET,
        upload_path,
        content,
        file.content_type or "application/octet-stream",
    )

    if current_user.profile_photo_path:
        try:
            delete_from_supabase(settings.SUPABASE_PROFILE_PHOTO_BUCKET, current_user.profile_photo_path)
        except Exception:
            pass

    current_user.profile_photo_path = upload_path
    db.commit()
    db.refresh(current_user)

    return {
        "message": "Profile photo updated",
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "full_name": current_user.full_name,
            "role": current_user.role,
            "institution": current_user.institution or "",
            "department": current_user.department or "",
            "bio": current_user.bio or "",
            "profile_photo_url": build_profile_photo_url(current_user.profile_photo_path),
            "notify_submissions": current_user.notify_submissions,
            "notify_low_scores": current_user.notify_low_scores,
            "notify_ocr_review": current_user.notify_ocr_review,
            "default_question_marks": current_user.default_question_marks or 10,
            "release_marks_immediately": current_user.release_marks_immediately,
        },
    }


@router.patch("/me/settings")
def update_my_settings(
    payload: UserSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.default_question_marks < 1 or payload.default_question_marks > 100:
        raise HTTPException(status_code=400, detail="Default marks must be between 1 and 100")

    full_name = payload.full_name.strip()
    if not full_name:
        raise HTTPException(status_code=400, detail="Full name is required")

    current_user.full_name = full_name
    current_user.institution = (payload.institution or "").strip()
    current_user.department = (payload.department or "").strip()
    current_user.bio = (payload.bio or "").strip()
    current_user.notify_submissions = payload.notify_submissions
    current_user.notify_low_scores = payload.notify_low_scores
    current_user.notify_ocr_review = payload.notify_ocr_review
    current_user.default_question_marks = payload.default_question_marks
    current_user.release_marks_immediately = payload.release_marks_immediately
    db.commit()
    db.refresh(current_user)

    return {
        "message": "Settings updated",
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "full_name": current_user.full_name,
            "role": current_user.role,
            "institution": current_user.institution or "",
            "department": current_user.department or "",
            "bio": current_user.bio or "",
            "profile_photo_url": build_profile_photo_url(current_user.profile_photo_path),
            "notify_submissions": current_user.notify_submissions,
            "notify_low_scores": current_user.notify_low_scores,
            "notify_ocr_review": current_user.notify_ocr_review,
            "default_question_marks": current_user.default_question_marks or 10,
            "release_marks_immediately": current_user.release_marks_immediately,
        },
    }
