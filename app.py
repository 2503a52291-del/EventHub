from flask import (
    Flask, render_template, request,
    jsonify, redirect, url_for, session, flash
)
import sqlite3
import threading
import os
from pathlib import Path
from datetime import datetime, timezone, timedelta
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)

# =====================================
# CONFIGURATION
# =====================================

app.secret_key = os.environ.get("SECRET_KEY", "eventhub-local-development-key")

DATABASE = Path(__file__).resolve().parent / "database.db"

registration_lock = threading.Lock()

IST = timezone(timedelta(hours=5, minutes=30))

ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")

if not ADMIN_PASSWORD:
    raise RuntimeError(
        "Set the ADMIN_PASSWORD environment variable before starting EventHub."
    )

ADMIN_PASSWORD_HASH = generate_password_hash(ADMIN_PASSWORD)


# =====================================
# DATABASE CONNECTION
# =====================================

def get_db_connection():
    connection = sqlite3.connect(str(DATABASE))
    connection.row_factory = sqlite3.Row
    return connection


# =====================================
# ADMIN AUTHENTICATION
# =====================================

def admin_required(function):

    @wraps(function)
    def wrapper(*args, **kwargs):

        if not session.get("admin_logged_in"):
            if request.path.startswith("/api/"):
                return jsonify({
                    "success": False,
                    "message": "Admin login required."
                }), 401

            return redirect(url_for("admin_login"))

        return function(*args, **kwargs)

    return wrapper


# =====================================
# DATABASE INITIALIZATION
# =====================================

def initialize_database():

    connection = get_db_connection()

    try:

        connection.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                date TEXT NOT NULL,
                description TEXT NOT NULL,
                capacity INTEGER NOT NULL,
                venue TEXT DEFAULT 'SR University, Warangal'
            )
        """)

        connection.execute("""
            CREATE TABLE IF NOT EXISTS registrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                email TEXT NOT NULL,
                event_id INTEGER NOT NULL,
                registered_at TEXT,
                FOREIGN KEY (event_id) REFERENCES events(id),
                UNIQUE(event_id, email)
            )
        """)

        event_columns = [
            row["name"]
            for row in connection.execute(
                "PRAGMA table_info(events)"
            ).fetchall()
        ]

        registration_columns = [
            row["name"]
            for row in connection.execute(
                "PRAGMA table_info(registrations)"
            ).fetchall()
        ]

        if "venue" not in event_columns:
            connection.execute("""
                ALTER TABLE events
                ADD COLUMN venue TEXT DEFAULT 'SR University, Warangal'
            """)

        if "registered_at" not in registration_columns:
            connection.execute("""
                ALTER TABLE registrations
                ADD COLUMN registered_at TEXT
            """)

        current_time = datetime.now(IST).strftime(
            "%d-%m-%Y %I:%M:%S %p"
        )

        connection.execute("""
            UPDATE registrations
            SET registered_at = ?
            WHERE registered_at IS NULL
        """, (current_time,))

        connection.execute("""
            INSERT OR IGNORE INTO events
            (id, name, date, description, capacity, venue)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            1,
            "Python & AI Workshop",
            "2026-12-15",
            "Learn Python programming and Artificial Intelligence basics.",
            5,
            "SR University, Warangal"
        ))

        connection.execute("""
            INSERT OR IGNORE INTO events
            (id, name, date, description, capacity, venue)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            2,
            "Web Development Workshop",
            "2026-12-20",
            "Learn HTML, CSS, JavaScript and build interactive websites.",
            10,
            "SR University, Warangal"
        ))

        connection.commit()

    except sqlite3.Error:
        connection.rollback()
        raise

    finally:
        connection.close()


# =====================================
# HOME PAGE
# =====================================

@app.route("/")
def home():

    connection = get_db_connection()

    try:

        events = connection.execute("""
            SELECT
                events.*,
                COUNT(registrations.id) AS registered,
                events.capacity - COUNT(registrations.id)
                AS available_seats
            FROM events
            LEFT JOIN registrations
            ON events.id = registrations.event_id
            GROUP BY events.id
            ORDER BY events.id
        """).fetchall()

        return render_template(
            "index.html",
            events=events
        )

    finally:
        connection.close()


# =====================================
# ADMIN LOGIN
# =====================================

@app.route("/admin/login", methods=["GET", "POST"])
def admin_login():

    if session.get("admin_logged_in"):
        return redirect(url_for("admin_dashboard"))

    if request.method == "POST":

        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")

        if (
            username == ADMIN_USERNAME
            and check_password_hash(ADMIN_PASSWORD_HASH, password)
        ):

            session.clear()
            session["admin_logged_in"] = True
            session["admin_username"] = username

            return redirect(url_for("admin_dashboard"))

        flash("Invalid username or password.", "error")

    return render_template("login.html")


# =====================================
# ADMIN LOGOUT
# =====================================

@app.route("/admin/logout")
@admin_required
def admin_logout():

    session.clear()

    return redirect(url_for("admin_login"))


# =====================================
# ADMIN DASHBOARD PAGE
# =====================================

@app.route("/admin")
@admin_required
def admin_dashboard():

    return render_template("admin.html")


# =====================================
# ADD EVENT API
# =====================================

@app.route("/api/admin/events", methods=["POST"])
@admin_required
def add_event():

    data = request.get_json(silent=True) or {}

    name = data.get("name", "")
    date = data.get("date", "")
    description = data.get("description", "")
    venue = data.get("venue", "SR University, Warangal")

    if not all(
        isinstance(value, str)
        for value in [name, date, description, venue]
    ):
        return jsonify({
            "success": False,
            "message": "Invalid event details."
        }), 400

    name = name.strip()
    date = date.strip()
    description = description.strip()
    venue = venue.strip()

    try:
        datetime.strptime(date, "%Y-%m-%d")
        capacity = int(data.get("capacity", 0))
    except (ValueError, TypeError):
        return jsonify({
            "success": False,
            "message": "Enter a valid date and capacity."
        }), 400

    if not name or not description or not venue or capacity <= 0:
        return jsonify({
            "success": False,
            "message": "Please enter all event details and a valid capacity."
        }), 400

    connection = get_db_connection()

    try:

        cursor = connection.execute("""
            INSERT INTO events
            (name, date, description, capacity, venue)
            VALUES (?, ?, ?, ?, ?)
        """, (
            name,
            date,
            description,
            capacity,
            venue
        ))

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Event added successfully!",
            "event_id": cursor.lastrowid
        }), 201

    except sqlite3.Error:

        connection.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to add event."
        }), 500

    finally:
        connection.close()


# =====================================
# REGISTRATION API
# =====================================

@app.route("/register", methods=["POST"])
def register():

    data = request.get_json(silent=True) or {}

    username = data.get("username", "")
    email = data.get("email", "")

    if not isinstance(username, str) or not isinstance(email, str):
        return jsonify({
            "success": False,
            "message": "Invalid name or email."
        }), 400

    username = username.strip()
    email = email.strip().lower()

    try:
        event_id = int(data.get("event_id", 0))
    except (ValueError, TypeError):
        event_id = 0

    if not username or not email or event_id <= 0:
        return jsonify({
            "success": False,
            "message": "Please enter your name, email and select an event."
        }), 400

    with registration_lock:

        connection = get_db_connection()

        try:

            connection.execute("BEGIN IMMEDIATE")

            event = connection.execute("""
                SELECT *
                FROM events
                WHERE id = ?
            """, (event_id,)).fetchone()

            if event is None:
                connection.rollback()
                return jsonify({
                    "success": False,
                    "message": "Event not found."
                }), 404

            existing = connection.execute("""
                SELECT id
                FROM registrations
                WHERE event_id = ? AND email = ?
            """, (event_id, email)).fetchone()

            if existing:
                connection.rollback()
                return jsonify({
                    "success": False,
                    "message": "You are already registered for this event!"
                }), 409

            registered = connection.execute("""
                SELECT COUNT(*) AS total
                FROM registrations
                WHERE event_id = ?
            """, (event_id,)).fetchone()["total"]

            if registered >= event["capacity"]:
                connection.rollback()
                return jsonify({
                    "success": False,
                    "message": "Registration Full! No seats available."
                }), 400

            registration_time = datetime.now(IST).strftime(
                "%d-%m-%Y %I:%M:%S %p"
            )

            connection.execute("""
                INSERT INTO registrations
                (username, email, event_id, registered_at)
                VALUES (?, ?, ?, ?)
            """, (
                username,
                email,
                event_id,
                registration_time
            ))

            connection.commit()

            available_seats = event["capacity"] - registered - 1

            return jsonify({
                "success": True,
                "message": f"Registration successful! Welcome, {username}.",
                "available_seats": available_seats,
                "event_id": event_id,
                "registered_at": registration_time
            })

        except sqlite3.Error:

            connection.rollback()

            return jsonify({
                "success": False,
                "message": "Database error. Please try again."
            }), 500

        finally:
            connection.close()


# =====================================
# CANCELLATION API
# =====================================

@app.route("/cancel", methods=["POST"])
def cancel():

    data = request.get_json(silent=True) or {}

    email = data.get("email", "")

    if not isinstance(email, str):
        return jsonify({
            "success": False,
            "message": "Invalid email address."
        }), 400

    email = email.strip().lower()

    try:
        event_id = int(data.get("event_id", 0))
    except (ValueError, TypeError):
        event_id = 0

    if not email or event_id <= 0:
        return jsonify({
            "success": False,
            "message": "Please enter your email and select an event."
        }), 400

    with registration_lock:

        connection = get_db_connection()

        try:

            connection.execute("BEGIN IMMEDIATE")

            registration = connection.execute("""
                SELECT *
                FROM registrations
                WHERE event_id = ? AND email = ?
            """, (event_id, email)).fetchone()

            if registration is None:
                connection.rollback()
                return jsonify({
                    "success": False,
                    "message": "No registration found for this event and email."
                }), 404

            connection.execute("""
                DELETE FROM registrations
                WHERE id = ?
            """, (registration["id"],))

            event = connection.execute("""
                SELECT capacity
                FROM events
                WHERE id = ?
            """, (event_id,)).fetchone()

            registered = connection.execute("""
                SELECT COUNT(*) AS total
                FROM registrations
                WHERE event_id = ?
            """, (event_id,)).fetchone()["total"]

            connection.commit()

            available_seats = event["capacity"] - registered

            return jsonify({
                "success": True,
                "message": "Registration cancelled successfully!",
                "available_seats": available_seats,
                "event_id": event_id
            })

        except sqlite3.Error:

            connection.rollback()

            return jsonify({
                "success": False,
                "message": "Database error. Please try again."
            }), 500

        finally:
            connection.close()


# =====================================
# ADMIN DASHBOARD DATA API
# =====================================

@app.route("/api/admin/dashboard")
@admin_required
def admin_dashboard_data():

    connection = get_db_connection()

    try:

        events = connection.execute("""
            SELECT
                events.id,
                events.name,
                events.date,
                events.venue,
                events.capacity,
                COUNT(registrations.id) AS registered,
                events.capacity - COUNT(registrations.id)
                AS available_seats
            FROM events
            LEFT JOIN registrations
            ON events.id = registrations.event_id
            GROUP BY events.id
            ORDER BY events.id
        """).fetchall()

        event_list = []

        total_capacity = 0
        total_registered = 0

        for event in events:

            registered = event["registered"]
            capacity = event["capacity"]

            total_capacity += capacity
            total_registered += registered

            occupancy = (
                registered / capacity * 100
                if capacity > 0 else 0
            )

            event_list.append({
                "id": event["id"],
                "name": event["name"],
                "date": event["date"],
                "venue": event["venue"],
                "capacity": capacity,
                "registered": registered,
                "available_seats": event["available_seats"],
                "occupancy": round(occupancy, 2)
            })

        registrations = connection.execute("""
            SELECT
                registrations.id,
                registrations.username,
                registrations.email,
                registrations.registered_at,
                events.name AS event_name
            FROM registrations
            JOIN events
            ON registrations.event_id = events.id
            ORDER BY registrations.id DESC
        """).fetchall()

        participants = [
            {
                "id": row["id"],
                "name": row["username"],
                "email": row["email"],
                "event_name": row["event_name"],
                "registered_at": row["registered_at"],
                "timezone": "IST"
            }
            for row in registrations
        ]

        remaining = max(
            0,
            total_capacity - total_registered
        )

        occupancy = (
            total_registered / total_capacity * 100
            if total_capacity > 0 else 0
        )

        return jsonify({
            "success": True,
            "summary": {
                "total_capacity": total_capacity,
                "registered": total_registered,
                "available_seats": remaining,
                "occupancy": round(occupancy, 2)
            },
            "events": event_list,
            "participants": participants
        })

    finally:
        connection.close()


# =====================================
# START APPLICATION
# =====================================

initialize_database()


if __name__ == "__main__":

    app.run(
        debug=True,
        use_reloader=False
    )
