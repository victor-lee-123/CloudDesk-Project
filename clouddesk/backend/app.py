from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from passlib.hash import pbkdf2_sha256
import mysql.connector
import os

app = Flask(__name__)

# ── JWT Setup ──────────────────────────────────────────────────────────────────
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "fallback-secret-change-in-prod")
jwt = JWTManager(app)

# ── CORS ───────────────────────────────────────────────────────────────────────
CORS(app)

# ── DB Connection ──────────────────────────────────────────────────────────────
def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "db"),
        user=os.getenv("DB_USER", "appuser"),
        password=os.getenv("DB_PASSWORD", "apppassword"),
        database=os.getenv("DB_NAME", "clouddesk")
    )

# ── Status Maps ────────────────────────────────────────────────────────────────
STATUS_DB_TO_UI = {
    "open":        "Open",
    "in_progress": "In Progress",
    "resolved":    "Resolved",
    "closed":      "Closed",
}

STATUS_UI_TO_DB = {
    "Open":        "open",
    "In Progress": "in_progress",
    "Resolved":    "resolved",
    "Closed":      "closed",
    # also accept raw DB values directly
    "open":        "open",
    "in_progress": "in_progress",
    "resolved":    "resolved",
    "closed":      "closed",
}

# ── Helpers ────────────────────────────────────────────────────────────────────
def format_ticket(row):
    return {
        "id":             row["id"],
        "user_id":        row["user_id"],
        "assigned_to":    row["assigned_to"],
        "title":          row["title"],
        "description":    row["description"],
        "status":         STATUS_DB_TO_UI.get(row["status"], row["status"]),
        "priority":       row["priority"],
        "created_at":     row["created_at"].isoformat() if row["created_at"] else None,
        "updated_at":     row["updated_at"].isoformat() if row["updated_at"] else None,
        "submitted_by":   row.get("submitted_by"),
        "assigned_admin": row.get("assigned_admin"),
    }

# ══════════════════════════════════════════════════════════════════════════════
#  AUTH ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/register", methods=["POST"])
def register():
    data     = request.get_json() or {}
    name     = (data.get("name") or "").strip()
    email    = (data.get("email") or "").strip()
    password = data.get("password", "")
    role     = data.get("role", "user")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400
    if not name:
        return jsonify({"error": "Name is required"}), 400
    if role not in ("user", "admin"):
        role = "user"

    hashed_pw = pbkdf2_sha256.hash(password)

    conn   = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO users (name, email, password_hash, role) VALUES (%s, %s, %s, %s)",
            (name, email, hashed_pw, role)
        )
        conn.commit()
        new_id = cursor.lastrowid
        return jsonify({"message": "User registered successfully", "user_id": new_id}), 201
    except mysql.connector.IntegrityError:
        return jsonify({"error": "An account with that email already exists"}), 400
    finally:
        cursor.close()
        conn.close()


@app.route("/login", methods=["POST"])
def login():
    data     = request.get_json() or {}
    email    = (data.get("email") or "").strip()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    conn   = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()

    if not user or not pbkdf2_sha256.verify(password, user["password_hash"]):
        return jsonify({"error": "Invalid email or password"}), 401

    access_token = create_access_token(
        identity=str(user["id"]),
        additional_claims={"role": user["role"]}
    )
    return jsonify({
        "token": access_token,
        "role":  user["role"],
        "name":  user["name"],
        "id":    user["id"],
    }), 200


# ══════════════════════════════════════════════════════════════════════════════
#  USER ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/")
def home():
    return jsonify({"message": "CloudDesk backend is running!"})


@app.route("/users", methods=["GET"])
def get_users():
    conn   = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id, name, email, role, created_at FROM users ORDER BY id")
    users = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify(users)


# ══════════════════════════════════════════════════════════════════════════════
#  TICKET ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/tickets", methods=["GET"])
@jwt_required()
def get_tickets():
    """
    Returns tickets belonging to the currently logged-in user.
    Admins can optionally pass ?user_id=X to filter by a specific user,
    or omit it to see all tickets.
    """
    current_user_id = int(get_jwt_identity())

    conn   = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        # Check role
        cursor.execute("SELECT role FROM users WHERE id = %s", (current_user_id,))
        user_record = cursor.fetchone()
        if not user_record:
            return jsonify({"error": "User not found"}), 404

        is_admin = user_record["role"] == "admin"

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

        if is_admin:
            # Admins see everything (optionally filtered by user_id query param)
            filter_user = request.args.get("user_id", type=int)
            if filter_user:
                query += " WHERE t.user_id = %s"
                params.append(filter_user)
        else:
            # Regular users only see their own tickets
            query += " WHERE t.user_id = %s"
            params.append(current_user_id)

        query += " ORDER BY t.created_at DESC"
        cursor.execute(query, params)
        tickets = [format_ticket(row) for row in cursor.fetchall()]
        return jsonify(tickets)

    finally:
        cursor.close()
        conn.close()


@app.route("/tickets/<int:ticket_id>", methods=["GET"])
@jwt_required()
def get_ticket(ticket_id):
    current_user_id = int(get_jwt_identity())

    conn   = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("SELECT role FROM users WHERE id = %s", (current_user_id,))
        user_record = cursor.fetchone()
        is_admin = user_record and user_record["role"] == "admin"

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
            return jsonify({"error": "Ticket not found"}), 404

        # Non-admins cannot view other users' tickets
        if not is_admin and row["user_id"] != current_user_id:
            return jsonify({"error": "Forbidden"}), 403

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
        for r in responses:
            if r.get("created_at"):
                r["created_at"] = r["created_at"].isoformat()

        ticket = format_ticket(row)
        ticket["responses"] = responses
        return jsonify(ticket)

    finally:
        cursor.close()
        conn.close()


@app.route("/tickets", methods=["POST"])
@jwt_required()
def create_ticket():
    data            = request.get_json() or {}
    current_user_id = int(get_jwt_identity())   # ← FIX: was undefined `user_id`

    title       = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    priority    = data.get("priority", "medium")
    if priority not in ("low", "medium", "high"):
        priority = "medium"

    if not title:
        return jsonify({"error": "Title is required"}), 400
    if not description:
        return jsonify({"error": "Description is required"}), 400

    conn   = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO tickets (user_id, title, description, status, priority)
            VALUES (%s, %s, %s, 'open', %s)
        """, (current_user_id, title, description, priority))
        conn.commit()
        ticket_id = cursor.lastrowid
        return jsonify({"message": "Ticket created successfully", "ticket_id": ticket_id}), 201
    finally:
        cursor.close()
        conn.close()


@app.route("/tickets/<int:ticket_id>", methods=["DELETE"])
@jwt_required()
def delete_ticket(ticket_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Optional: Check if user is admin or the owner before deleting
        cursor.execute("DELETE FROM tickets WHERE id = %s", (ticket_id,))
        conn.commit()
        
        if cursor.rowcount == 0:
            return jsonify({"error": "Ticket not found"}), 404
            
        return jsonify({"message": "Ticket deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@app.route("/tickets/<int:ticket_id>/status", methods=["PATCH"])
@jwt_required()
def update_ticket_status(ticket_id):
    current_user_id = int(get_jwt_identity())
    data            = request.get_json() or {}
    new_status      = STATUS_UI_TO_DB.get(data.get("status"))

    if not new_status:
        return jsonify({"error": "Invalid status value"}), 400

    conn   = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # Only admins can change status
        cursor.execute("SELECT role FROM users WHERE id = %s", (current_user_id,))
        user_record = cursor.fetchone()
        if not user_record or user_record["role"] != "admin":
            return jsonify({"error": "Only admins can update ticket status"}), 403

        cursor.execute("SELECT id FROM tickets WHERE id = %s", (ticket_id,))
        if not cursor.fetchone():
            return jsonify({"error": "Ticket not found"}), 404

        cursor.execute("UPDATE tickets SET status = %s WHERE id = %s", (new_status, ticket_id))
        conn.commit()
        return jsonify({"message": "Ticket status updated successfully"})
    finally:
        cursor.close()
        conn.close()


@app.route("/tickets/<int:ticket_id>/responses", methods=["POST"])
@jwt_required()
def add_ticket_response(ticket_id):
    current_user_id = int(get_jwt_identity())
    data            = request.get_json() or {}
    message         = (data.get("message") or "").strip()

    if not message:
        return jsonify({"error": "Message is required"}), 400

    conn   = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM tickets WHERE id = %s", (ticket_id,))
        if not cursor.fetchone():
            return jsonify({"error": "Ticket not found"}), 404

        cursor.execute("""
            INSERT INTO ticket_responses (ticket_id, responder_id, message)
            VALUES (%s, %s, %s)
        """, (ticket_id, current_user_id, message))
        conn.commit()
        return jsonify({"message": "Response added successfully"}), 201
    finally:
        cursor.close()
        conn.close()


# ══════════════════════════════════════════════════════════════════════════════
#  ADMIN ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/admin/tickets", methods=["GET"])
@jwt_required()
def admin_get_tickets():
    current_user_id = int(get_jwt_identity())

    conn   = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT role FROM users WHERE id = %s", (current_user_id,))
        user_record = cursor.fetchone()
        if not user_record or user_record["role"] != "admin":
            return jsonify({"error": "Unauthorized. Admin access required."}), 403

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
        return jsonify(tickets), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
