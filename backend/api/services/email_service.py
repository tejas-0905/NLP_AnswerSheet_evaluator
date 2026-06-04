import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from config import settings


def build_otp_email_html(full_name: str, otp: str) -> str:
    return f"""
    <html>
    <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 30px;">
      <div style="max-width: 480px; margin: auto; background: white;
                  border-radius: 10px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

        <h2 style="color: #1e293b; margin-top: 0;">Verify your email</h2>
        <p style="color: #475569;">Hi <strong>{full_name}</strong>,</p>
        <p style="color: #475569;">Use the code below to verify your account.
           It expires in <strong>10 minutes</strong>.</p>

        <div style="text-align: center; margin: 32px 0;">
          <span style="font-size: 42px; font-weight: bold; letter-spacing: 14px;
                       color: #2563eb; background: #eff6ff; padding: 16px 28px;
                       border-radius: 10px; display: inline-block;">
            {otp}
          </span>
        </div>

        <p style="color: #94a3b8; font-size: 13px;">
          If you did not create an account, ignore this email.
          Do not share this code with anyone.
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
        <p style="color: #cbd5e1; font-size: 12px; margin: 0;">
          Answer Sheet Evaluator
        </p>
      </div>
    </body>
    </html>
    """


async def send_otp_email(to_email: str, otp: str, full_name: str):
    message = MIMEMultipart("alternative")
    message["From"] = f"Answer Evaluator <{settings.SMTP_USER}>"
    message["To"] = to_email
    message["Subject"] = f"{otp} is your verification code"

    plain_text = (
        f"Hi {full_name},\n\n"
        f"Your OTP is: {otp}\n\n"
        f"It expires in 10 minutes. Do not share it.\n\n"
        f"- Answer Sheet Evaluator"
    )

    message.attach(MIMEText(plain_text, "plain"))
    message.attach(MIMEText(build_otp_email_html(full_name, otp), "html"))

    try:
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
        )
        print(f"[EMAIL] OTP sent to {to_email}")
    except aiosmtplib.SMTPException as e:
        print(f"[EMAIL ERROR] Failed to send to {to_email}: {e}")
        raise RuntimeError(f"Could not send verification email: {e}")
