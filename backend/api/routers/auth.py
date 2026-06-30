from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from pydantic import BaseModel, EmailStr

from api.dependencies import get_db, get_current_user
from api.models.user import User, OTPVerification
from api.schemas.auth import RegisterRequest, LoginRequest, OTPRequest, TokenResponse, UserSettingsUpdate
from api.services.auth_service import (
    hash_password, verify_password,
    create_access_token, generate_otp, otp_expiry,
)
from api.services.email_service import send_otp_email

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register")
async def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    otp_code = generate_otp()
    otp = OTPVerification(user_id=user.id, otp_code=otp_code, expires_at=otp_expiry())
    db.add(otp)
    db.commit()

    try:
        await send_otp_email(user.email, otp_code, user.full_name)
    except RuntimeError:
        # Don't block registration if email fails — log and continue
        print(f"[WARN] OTP email failed for {user.email}. OTP: {otp_code}")

    return {
        "message": "Registered successfully. Check your email for OTP.",
        "user_id": user.id,
    }


@router.post("/verify-otp")
def verify_otp(payload: OTPRequest, db: Session = Depends(get_db)):
    otp = (
        db.query(OTPVerification)
        .filter(
            OTPVerification.user_id == payload.user_id,
            OTPVerification.otp_code == payload.otp,
            OTPVerification.is_used == False,
        )
        .order_by(OTPVerification.id.desc())
        .first()
    )

    if not otp:
        raise HTTPException(status_code=400, detail="Invalid OTP. Check the code and try again.")

    expires = otp.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OTP has expired. Request a new one.")

    otp.is_used = True
    db.query(User).filter(User.id == payload.user_id).update({"is_verified": True})
    db.commit()

    return {"message": "Email verified successfully. You can now log in."}


class ResendOTPRequest(BaseModel):
    email: EmailStr

@router.post("/resend-otp")
async def resend_otp(payload: ResendOTPRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()

    if not user:
        # Don't reveal whether email exists
        return {"message": "If this email is registered, a new OTP has been sent."}

    if user.is_verified:
        raise HTTPException(status_code=400, detail="This account is already verified.")

    otp_code = generate_otp()
    otp = OTPVerification(user_id=user.id, otp_code=otp_code, expires_at=otp_expiry())
    db.add(otp)
    db.commit()

    await send_otp_email(user.email, otp_code, user.full_name)
    return {"message": "New OTP sent. Check your email.", "user_id": user.id}


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Please verify your email first")

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
        "notify_submissions": current_user.notify_submissions,
        "notify_low_scores": current_user.notify_low_scores,
        "notify_ocr_review": current_user.notify_ocr_review,
        "default_question_marks": current_user.default_question_marks or 10,
        "release_marks_immediately": current_user.release_marks_immediately,
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
            "notify_submissions": current_user.notify_submissions,
            "notify_low_scores": current_user.notify_low_scores,
            "notify_ocr_review": current_user.notify_ocr_review,
            "default_question_marks": current_user.default_question_marks or 10,
            "release_marks_immediately": current_user.release_marks_immediately,
        },
    }
