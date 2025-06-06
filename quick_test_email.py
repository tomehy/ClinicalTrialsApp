# quick_test_email.py

import smtplib
from email.mime.text import MIMEText

msg = MIMEText("Test message from Flask app")
msg['Subject'] = 'Testing Email'
msg['From'] = 'dapp.clinical.trials.system@gmail.com'
msg['To'] = 'your_email@example.com'

with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
    smtp.login('dapp.clinical.trials.system@gmail.com', 'ouhwcavpclwzpgwv')
    smtp.send_message(msg)
