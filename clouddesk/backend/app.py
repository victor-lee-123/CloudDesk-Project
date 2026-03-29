from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
import os

app = Flask(__name__)
CORS(app)

def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "db"),
        user=os.getenv("DB_USER", "appuser"),
        password=os.getenv("DB_PASSWORD", "apppassword"),
        database=os.getenv("DB_NAME", "helpdesk")
    )

@app.route("/")
def home():
    return jsonify({"message": "Flask backend is running!"})

@app.route("/tickets", methods=["GET"])
def get_tickets():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM tickets")
    tickets = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify(tickets)

@app.route("/tickets", methods=["POST"])
def create_ticket():
    data = request.json
    title = data.get("title")
    description = data.get("description")
    status = "Open"

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO tickets (title, description, status) VALUES (%s, %s, %s)",
        (title, description, status)
    )
    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({"message": "Ticket created successfully"}), 201

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)