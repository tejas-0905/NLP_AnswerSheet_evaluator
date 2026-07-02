import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate, make_msgid
from config import settings


def build_otp_email_html(full_name: str, otp: str) -> str:
    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Your OTP Code</title>
      <style>
        body {{ margin: 0; padding: 0; background: #f3f4f6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }}
        .email-body {{ width: 100%; min-width: 320px; padding: 24px 0; }}
        .email-card {{ width: 100%; max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08); }}
        .hero {{ background: #4338ca; padding: 28px 24px; text-align: center; }}
        .hero h1 {{ margin: 0; color: #ffffff; font-size: 24px; letter-spacing: 0.02em; }}
        .content {{ padding: 30px 32px 20px; color: #0f172a; }}
        .content p {{ margin: 0 0 18px; font-size: 15px; color: #334155; line-height: 1.7; }}
        .code-panel {{ display: block; margin: 24px auto; background: #eef2ff; border-radius: 16px; padding: 22px 0; width: 100%; max-width: 360px; text-align: center; }}
        .code-text {{ display: inline-block; font-size: 34px; font-weight: 800; letter-spacing: 0.24em; color: #4338ca; }}
        .footer {{ background: #f8fafc; padding: 20px 32px 28px; text-align: center; color: #94a3b8; font-size: 13px; }}
        @media screen and (max-width: 540px) {{
          .email-card {{ border-radius: 20px; }}
          .hero {{ padding: 24px 18px; }}
          .hero h1 {{ font-size: 20px; }}
          .content {{ padding: 22px 18px 18px; }}
          .content p {{ font-size: 14px; }}
          .code-panel {{ padding: 18px 0; max-width: 100%; }}
          .code-text {{ font-size: 30px; letter-spacing: 0.2em; }}
          .footer {{ padding: 18px 18px 22px; font-size: 12px; }}
        }}
      </style>
    </head>
    <body>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" class="email-body">
        <tr>
          <td align="center">
            <table cellpadding="0" cellspacing="0" role="presentation" class="email-card">
              <tr>
                <td class="hero">
                  <h1>Your OTP Code</h1>
                </td>
              </tr>
              <tr>
                <td class="content">
                  <p>Hello <strong>{full_name}</strong>,</p>
                  <p>Your One-Time Password (OTP) for account verification is below.</p>
                  <div class="code-panel">
                    <span class="code-text">{otp}</span>
                  </div>
                  <p>This OTP is valid for <strong>10 minutes</strong>. Please do not share this code with anyone.</p>
                  <p>If you didn't request this code, please ignore this email.</p>
                </td>
              </tr>
              <tr>
                <td class="footer">
                  Thank you for using Answer Sheet Evaluator.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """


async def send_otp_email(to_email: str, otp: str, full_name: str):
    message = MIMEMultipart("alternative")
    message["From"] = f"Answer Evaluator <{settings.SMTP_USER}>"
    message["To"] = to_email
    message["Subject"] = f"{otp} is your verification code"
    message["Date"] = formatdate(localtime=True)
    message["Message-ID"] = make_msgid()

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
            timeout=30,
        )
        print(f"[EMAIL] OTP sent to {to_email}")
    except aiosmtplib.SMTPException as e:
        print(f"[EMAIL ERROR] Failed to send to {to_email}: {e}")
        raise RuntimeError(f"Could not send verification email: {e}")
