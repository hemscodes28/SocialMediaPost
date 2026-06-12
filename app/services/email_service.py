import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.config import settings

logger = logging.getLogger(__name__)

def send_otp_email(email: str, code: str) -> bool:
    """Send a premium OTP verification email using SMTP settings, with console fallback."""
    smtp_user = settings.SMTP_USER
    smtp_pass = settings.SMTP_PASSWORD
    smtp_host = settings.SMTP_HOST
    smtp_port = settings.SMTP_PORT
    sender = settings.SMTP_SENDER or smtp_user

    email = email.strip().lower()

    if not smtp_user or not smtp_pass:
        print(f"\n--- [EMAIL BYPASS] SMTP credentials not set. Simulated sending OTP to {email}: {code} ---\n")
        logger.info("[EMAIL BYPASS] SMTP credentials not set. OTP code for %s is %s", email, code)
        return False

    # HTML Body Design
    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Post Pilot.ai Verification</title>
  <style>
    body {{
      font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #F9FAFB;
      color: #111827;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }}
    .wrapper {{
      width: 100%;
      background-color: #F9FAFB;
      padding: 40px 0;
    }}
    .container {{
      max-width: 540px;
      margin: 0 auto;
      background-color: #FFFFFF;
      border: 1px solid rgba(0, 0, 0, 0.06);
      border-radius: 24px;
      padding: 48px 40px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.02);
    }}
    .logo {{
      font-size: 22px;
      font-weight: 800;
      text-align: center;
      margin-bottom: 32px;
      color: #000000;
    }}
    .logo-icon {{
      color: #2563eb;
      margin-right: 6px;
    }}
    .header {{
      font-size: 24px;
      font-weight: 800;
      text-align: center;
      margin-bottom: 16px;
      color: #111827;
      letter-spacing: -0.02em;
    }}
    .subtitle {{
      font-size: 15px;
      line-height: 1.6;
      color: #4B5563;
      text-align: center;
      margin-bottom: 32px;
    }}
    .code-box {{
      font-size: 38px;
      font-weight: 800;
      letter-spacing: 8px;
      text-align: center;
      margin: 32px 0;
      padding: 20px;
      background: linear-gradient(135deg, rgba(0, 0, 0, 0.02), rgba(37, 99, 235, 0.02));
      border: 1px dashed rgba(37, 99, 235, 0.25);
      border-radius: 16px;
      color: #2563eb;
    }}
    .disclaimer {{
      font-size: 13px;
      color: #9CA3AF;
      text-align: center;
      line-height: 1.5;
      margin-top: 32px;
    }}
    .footer {{
      font-size: 12px;
      color: #9CA3AF;
      text-align: center;
      margin-top: 40px;
      border-top: 1px solid rgba(0, 0, 0, 0.06);
      padding-top: 24px;
    }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="logo">🚀 <span style="background: linear-gradient(135deg, #000000, #2563eb); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Post Pilot.ai</span></div>
      <div class="header">Confirm Your Identity</div>
      <p class="subtitle">Please use the following 6-digit verification code to complete your access to Post Pilot.ai. This code is valid for 5 minutes.</p>
      <div class="code-box">{code}</div>
      <p class="disclaimer">If you did not request this verification code, you can safely ignore this email.</p>
      <div class="footer">
        &copy; 2026 Post Pilot.ai. All rights reserved.
      </div>
    </div>
  </div>
</body>
</html>
"""

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"{code} is your Post Pilot.ai verification code"
        msg["From"] = sender
        msg["To"] = email

        part1 = MIMEText(f"Your Post Pilot.ai verification code is: {code}. It is valid for 5 minutes.", "plain")
        part2 = MIMEText(html_content, "html")
        msg.attach(part1)
        msg.attach(part2)

        # Connect and send
        if smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15)
        else:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=15)
            server.ehlo()
            if smtp_port == 587 or "gmail" in smtp_host.lower():
                server.starttls()
                server.ehlo()
        
        server.login(smtp_user, smtp_pass)
        server.sendmail(sender, [email], msg.as_string())
        server.quit()
        logger.info("Successfully sent OTP email to %s", email)
        return True
    except Exception as e:
        logger.error("Failed to send OTP email to %s: %s", email, e)
        print(f"\n[ERROR] SMTP email failed: {e}. Falling back to console logging.")
        print(f"\n--- [EMAIL BYPASS] Simulated sending OTP to {email}: {code} ---\n")
        return False
