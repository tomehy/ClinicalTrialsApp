# flask_app.py

from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import mysql.connector # Make sure to install this: pip install mysql-connector-python
import smtplib
from email.mime.text import MIMEText
import requests


app = Flask(__name__)
CORS(app) # Enable CORS for all routes

# Database Configuration (replace with your actual MySQL credentials)
DB_CONFIG = {
    'host': 'tomehyie.mysql.pythonanywhere-services.com', # e.g., 'localhost' or your PythonAnywhere MySQL hostname
    'user': 'tomehyie', # e.g., 'tomehyie' (as seen in your screenshot)
    'password': 'MMyy@1983',
    'database': 'tomehyie$doctors_licenses' # Your database name
}

# --- NEW ENDPOINT: ClinicalTrials.gov REST API Proxy ---

# Alternate route using ClinicalTrials.gov v1 API
@app.route('/api/proxy_trials')
def proxy_trials():
    query = request.args.get('query', '').strip()
    if not query:
        return jsonify({'error': 'Missing query parameter'}), 400

    try:
        v1_url = "https://clinicaltrials.gov/api/query/full_studies"
        params = {
            'expr': f"{query} AND phase:3",
            'min_rnk': 1,
            'max_rnk': 20,
            'fmt': 'json'
        }

        response = requests.get(v1_url, params=params)
        response.raise_for_status()

        full_data = response.json()
        studies = full_data.get("FullStudiesResponse", {}).get("FullStudies", [])

        return jsonify({'studies': studies})

    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'ClinicalTrials.gov API error: {str(e)}'}), 502







@app.route('/api/send_email', methods=['POST'])
def send_email():
    data = request.json
    subject = data.get("subject", "Clinical Trials Notification")
    message = data.get("message", "")
    recipient = data.get("recipient")

    try:
        msg = MIMEText(message)
        msg['Subject'] = subject
        msg['From'] = 'dapp.clinical.trials.system@gmail.com'
        msg['To'] = recipient

        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
            smtp.login('dapp.clinical.trials.system@gmail.com', 'ouhwcavpclwzpgwv')
            print("Sending email to", recipient)
            smtp.send_message(msg)

        return {'status': 'success'}, 200
    except Exception as e:
        return {'status': 'error', 'message': str(e)}, 500

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

# --- NEW ENDPOINT: Doctor License Verification ---
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
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True) # Use dictionary=True to get results as dictionaries

        # Query to check if the license_id and name exist and are active
        query = "SELECT * FROM doctors_licenses WHERE license_id = %s AND name = %s AND is_active = TRUE"
        cursor.execute(query, (license_id, name))

        result = cursor.fetchone() # Fetch one matching record

        if result:
            return jsonify({"verified": True, "message": "License verified successfully."}), 200
        else:
            return jsonify({"verified": False, "message": "License ID or name does not match records, or license is inactive."}), 200

    except mysql.connector.Error as err:
        print(f"Database error: {err}")
        return jsonify({"verified": False, "message": "A database error occurred during verification."}), 500
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return jsonify({"verified": False, "message": "An unexpected server error occurred."}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

#if __name__ == '__main__':
#   app.run(debug=True, port=5001)



