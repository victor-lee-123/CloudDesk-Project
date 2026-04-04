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
        database=os.getenv("DB_NAME", "clouddesk")
    )

STATUS_DB_TO_UI = {
    "open": "Open",
    "in_progress": "In Progress",
    "resolved": "Resolved",
    "closed": "Closed"
}

STATUS_UI_TO_DB = {
    "Open": "open",
    "In Progress": "in_progress",
    "Resolved": "resolved",
    "Closed": "closed",
    "open": "open",
    "in_progress": "in_progress",
    "resolved": "resolved",
    "closed": "closed"
}

PRIORITY_ALLOWED = {"low", "medium", "high"}

def format_ticket(row):
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "assigned_to": row["assigned_to"],
        "title": row["title"],
        "description": row["description"],
        "status": STATUS_DB_TO_UI.get(row["status"], row["status"]),
        "priority": row["priority"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
        "submitted_by": row.get("submitted_by"),
        "assigned_admin": row.get("assigned_admin"),
    }

@app.route("/")
def home():
    return jsonify({"message": "CloudDesk backend is running!"})

@app.route("/users", methods=["GET"])
def get_users():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT id, name, email, role, created_at
        FROM users
        ORDER BY id
    """)
    users = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify(users)

@app.route("/tickets", methods=["GET"])
def get_tickets():
    user_id = request.args.get("user_id", type=int)

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    query = """
        SELECT
            t.*,
            u.name AS submitted_by,
            a.name AS assigned_admin
        FROM tickets t
        JOIN users u ON t.user_id = u.id
        LEFT JOIN users a ON t.assigned_to = a.id
    """
    params = []

    if user_id:
        query += " WHERE t.user_id = %s"
        params.append(user_id)

    query += " ORDER BY t.created_at DESC"

    cursor.execute(query, params)
    tickets = [format_ticket(row) for row in cursor.fetchall()]

    cursor.close()
    conn.close()
    return jsonify(tickets)

@app.route("/tickets/<int:ticket_id>", methods=["GET"])
def get_ticket(ticket_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT
            t.*,
            u.name AS submitted_by,
            a.name AS assigned_admin
        FROM tickets t
        JOIN users u ON t.user_id = u.id
        LEFT JOIN users a ON t.assigned_to = a.id
        WHERE t.id = %s
    """, (ticket_id,))
    row = cursor.fetchone()

    if not row:
        cursor.close()
        conn.close()
        return jsonify({"error": "Ticket not found"}), 404

    cursor.execute("""
        SELECT
            r.id,
            r.ticket_id,
            r.message,
            r.created_at,
            u.name AS responder_name,
            u.role AS responder_role
        FROM ticket_responses r
        JOIN users u ON r.responder_id = u.id
        WHERE r.ticket_id = %s
        ORDER BY r.created_at ASC
    """, (ticket_id,))
    responses = cursor.fetchall()

    cursor.close()
    conn.close()

    ticket = format_ticket(row)
    ticket["responses"] = responses
    return jsonify(ticket)

@app.route("/tickets", methods=["POST"])
def create_ticket():
    data = request.get_json() or {}

    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    user_id = 1
    priority = "medium"
    status = "open"

    if not title:
        return jsonify({"error": "Title is required"}), 400
    if not description:
        return jsonify({"error": "Description is required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO tickets (user_id, title, description, status, priority)
        VALUES (%s, %s, %s, %s, %s)
    """, (user_id, title, description, status, priority))

    conn.commit()
    ticket_id = cursor.lastrowid

    cursor.close()
    conn.close()

    return jsonify({
        "message": "Ticket created successfully",
        "ticket_id": ticket_id
    }), 201

@app.route("/tickets/<int:ticket_id>/status", methods=["PATCH"])
def update_ticket_status(ticket_id):
    data = request.get_json() or {}
    new_status = STATUS_UI_TO_DB.get(data.get("status"))

    if not new_status:
        return jsonify({"error": "Invalid status"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM tickets WHERE id = %s", (ticket_id,))
    if not cursor.fetchone():
        cursor.close()
        conn.close()
        return jsonify({"error": "Ticket not found"}), 404

    cursor.execute("""
        UPDATE tickets
        SET status = %s
        WHERE id = %s
    """, (new_status, ticket_id))

    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({"message": "Ticket status updated successfully"})

@app.route("/tickets/<int:ticket_id>/responses", methods=["POST"])
def add_ticket_response(ticket_id):
    data = request.get_json() or {}
    responder_id = data.get("responder_id", 4)  # temp demo admin
    message = (data.get("message") or "").strip()

    if not message:
        return jsonify({"error": "Message is required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM tickets WHERE id = %s", (ticket_id,))
    if not cursor.fetchone():
        cursor.close()
        conn.close()
        return jsonify({"error": "Ticket not found"}), 404

    cursor.execute("""
        INSERT INTO ticket_responses (ticket_id, responder_id, message)
        VALUES (%s, %s, %s)
    """, (ticket_id, responder_id, message))

    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({"message": "Response added successfully"}), 201

@app.route("/admin/tickets", methods=["GET"])
def admin_get_tickets():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT
            t.*,
            u.name AS submitted_by,
            a.name AS assigned_admin
        FROM tickets t
        JOIN users u ON t.user_id = u.id
        LEFT JOIN users a ON t.assigned_to = a.id
        ORDER BY t.created_at DESC
    """)
    tickets = [format_ticket(row) for row in cursor.fetchall()]

    cursor.close()
    conn.close()
    return jsonify(tickets)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)