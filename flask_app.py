from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import psycopg2
import smtplib
from email.mime.text import MIMEText
import requests

app = Flask(__name__)
CORS(app)

# --- PostgreSQL Configuration (Render.com) ---
DB_CONFIG = {
    "dbname": "clinicaltrialsdb",
    "user": "admin",
    "password": "TDjsiPLoJGciXKarvTYNkBRpssyPoHPR",
    "host": "dpg-d19d44idbo4c73d6d6d0-a.oregon-postgres.render.com",
    "port": "5432"
}

# --- REST Proxy for ClinicalTrials.gov API ---
@app.route('/api/proxy_trials')
def proxy_trials():
    query = request.args.get('query', '')
    try:
        response = requests.get(
            'https://clinicaltrials.gov/api/v2/studies',
            params={'query.term': f'{query} Phase 3', 'pageSize': 20}
        )
        response.raise_for_status()
        return jsonify({'studies': response.json().get('studies', [])})
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'ClinicalTrials.gov API error: {str(e)}'}), 502

# --- Email Notification API ---
@app.route('/api/send_email', methods=['POST'])
def send_email():
    data = request.json
    try:
        msg = MIMEText(data.get("message", ""))
        msg['Subject'] = data.get("subject", "Clinical Trials Notification")
        msg['From'] = 'dapp.clinical.trials.system@gmail.com'
        msg['To'] = data.get("recipient")

        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
            smtp.login('dapp.clinical.trials.system@gmail.com', 'ouhwcavpclwzpgwv')
            smtp.send_message(msg)

        return {'status': 'success'}, 200
    except Exception as e:
        return {'status': 'error', 'message': str(e)}, 500

# --- Dashboard Routes ---
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/sponsor')
def sponsor_dashboard():
    return render_template('sponsor.html')

@app.route('/doctor')
def doctor_dashboard():
    return render_template('doctor.html')

@app.route('/patient')
def patient_dashboard():
    return render_template('patient.html')

# --- Doctor License Verification API (PostgreSQL) ---
@app.route('/api/verify_doctor_license', methods=['POST'])
def verify_doctor_license():
    data = request.get_json()
    license_id = data.get('licenseId')
    name = data.get('name')

    if not license_id or not name:
        return jsonify({"verified": False, "message": "Missing license ID or name"}), 400

    conn = None
    cursor = None
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM licenses
            WHERE license_id = %s AND name = %s AND is_active = TRUE
        """, (license_id, name))
        result = cursor.fetchone()

        if result:
            return jsonify({"verified": True, "message": "License verified successfully."}), 200
        else:
            return jsonify({"verified": False, "message": "No active license found for the provided credentials."}), 200
    except Exception as e:
        return jsonify({"verified": False, "message": f"Database error: {str(e)}"}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()
