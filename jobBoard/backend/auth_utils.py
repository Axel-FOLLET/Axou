import os
import sqlite3

from datetime import timedelta
from functools import wraps

from dotenv import load_dotenv
from flask import jsonify, request, session
from werkzeug.security import generate_password_hash

from db import get_db

# scrypt N=2^15, r=8, p=3 : l'un des réglages minimaux de l'OWASP. Le réglage par
# défaut de Werkzeug (p=1) reste en dessous.
PASSWORD_METHOD = "scrypt:32768:8:3"


def hash_password(password):
    return generate_password_hash(password, method=PASSWORD_METHOD)


def needs_rehash(password_hash):
    """Vrai pour une empreinte calculée avec un ancien réglage : à recalculer."""
    return not password_hash.startswith(PASSWORD_METHOD + "$")



def init_security(app):
    load_dotenv()

    secret_key = os.environ.get("SECRET_KEY")

    if not secret_key:
        raise RuntimeError(
            "SECRET_KEY manquante : copie .env.example en .env"
        )

    app.secret_key = secret_key

    app.config.update(
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=os.environ.get("COOKIE_SECURE") == "1",
        # Un cookie signé depuis plus d'un jour est refusé (31 jours par défaut) :
        # une copie dérobée ne sert pas longtemps, même après la déconnexion.
        PERMANENT_SESSION_LIFETIME=timedelta(days=1),
    )

def current_user():
    user_id = session.get("user_id")

    if user_id is None:
        return None

    conn = get_db()

    row = conn.execute(
        """
        SELECT id, first_name, last_name, email, phone, role
        FROM people
        WHERE id = ?
        """,
        (user_id,),
    ).fetchone()

    conn.close()

    if row is None:
        return None

    return dict(row)

def login_required(view):
    @wraps(view)
    def wrapped_view(*args, **kwargs):
        if current_user() is None:
            return jsonify({"error": "Login required"}), 401

        return view(*args, **kwargs)

    return wrapped_view

def admin_required(view):
    @wraps(view)
    def wrapped_view(*args, **kwargs):
        user = current_user()

        if user is None:
            return jsonify({"error": "Login required"}), 401

        if user["role"] != "admin":
            return jsonify({"error": "Admin only"}), 403

        return view(*args, **kwargs)

    return wrapped_view

def get_json_object():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return None, (jsonify({"error": "JSON object expected"}), 400)

    return data, None

def validate_text_field(data, field, email=False):
    value = data.get(field)

    if not isinstance(value, str):
        return jsonify({"error": f"Invalid field: {field}"}), 400

    value = value.strip()

    if not value or len(value) > 100:
        return jsonify({"error": f"Invalid field: {field}"}), 400

    if email and "@" not in value:
        return jsonify({"error": f"Invalid field: {field}"}), 400

    return None

def create_person(
    conn,
    first_name,
    last_name,
    email,
    password,
    role="user",
    phone=None,
):
    email = email.strip().lower()
    password_hash = hash_password(password)

    cursor = conn.execute(
        """
        INSERT INTO people
        (first_name, last_name, email, phone, password_hash, role)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            first_name,
            last_name,
            email,
            phone,
            password_hash,
            role,
        ),
    )

    conn.commit()

    return cursor.lastrowid
