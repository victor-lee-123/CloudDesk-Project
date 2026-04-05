from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
import os

app = Flask(__name__)
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from passlib.hash import pbkdf2_sha256

# Setup JWT
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "fallback-secret")
jwt = JWTManager(app)

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
@jwt_required() # <--- Protect this route
def create_ticket():
    data = request.get_json() or {}
    current_user_id = get_jwt_identity() # <--- Get ID from token

    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    priority = data.get("priority", "medium")
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
@jwt_required() # This ensures only logged-in users can even hit this line
def admin_get_tickets():
    # 1. Identify who is logged in from their token
    current_user_id = get_jwt_identity()

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        # 2. Check if the logged-in user is actually an admin in the database
        cursor.execute("SELECT role FROM users WHERE id = %s", (current_user_id,))
        user_record = cursor.fetchone()

        if not user_record or user_record["role"] != "admin":
            return jsonify({"error": "Unauthorized. Admin access required."}), 403

        # 3. If they are an admin, proceed with the original query to get all tickets
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
        
        rows = cursor.fetchall()
        tickets = [format_ticket(row) for row in rows]

        return jsonify(tickets), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    role = data.get("role", "user") # Default to regular user

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    hashed_pw = pbkdf2_sha256.hash(password)

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO users (name, email, password_hash, role) VALUES (%s, %s, %s, %s)",
            (name, email, hashed_pw, role)
        )
        conn.commit()
        return jsonify({"message": "User registered successfully"}), 201
    except Exception as e:
        return jsonify({"error": "Email already exists"}), 400
    finally:
        cursor.close()
        conn.close()

@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()

    if user and pbkdf2_sha256.verify(password, user["password_hash"]):
        # Create token containing the user ID and role
        access_token = create_access_token(identity=str(user["id"]), additional_claims={"role": user["role"]})
        return jsonify({"token": access_token, "role": user["role"]}), 200

    return jsonify({"error": "Invalid credentials"}), 401

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)