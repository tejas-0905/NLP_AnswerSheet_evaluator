import asyncio
from config import settings
import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

async def test():
    msg = MIMEMultipart('alternative')
    msg['From'] = settings.SMTP_USER
    msg['To'] = settings.SMTP_USER
    msg['Subject'] = 'SMTP delivery test'
    msg.attach(MIMEText('This is a test', 'plain'))
    smtp = aiosmtplib.SMTP(hostname=settings.SMTP_HOST, port=settings.SMTP_PORT, start_tls=False, timeout=30)
    await smtp.connect()
    await smtp.starttls()
    await smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
    await smtp.send_message(msg)
    await smtp.quit()
    print('SMTP send succeeded')

if __name__ == '__main__':
    asyncio.run(test())
