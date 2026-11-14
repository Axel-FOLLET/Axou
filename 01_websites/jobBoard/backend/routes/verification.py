"""Email address verification after a pending registration.

Second half of the flow described in docs/contrat_api.md: register sets the registration
aside and sends a link, this route applies the registration when the link is opened.
The route lives in its own file, like login_limit for the login limit:
routes/auth.py therefore only gets an addition of a few lines.
"""
from flask import Blueprint, jsonify

import pending_registrations
from auth_utils import get_json_object, validate_text_field
from db import get_db


verification = Blueprint("verification", __name__)


@verification.route("/verify", methods=["POST"])
def verify():
    data, error = get_json_object()

    if error:
        return error

    error = validate_text_field(data, "token")

    if error:
        return error

    conn = get_db()
    pending = pending_registrations.take(conn, data["token"].strip())

    # Unknown, already used or expired token: same refusal in all three cases, so as to
    # teach nothing to someone trying random tokens.
    if pending is None:
        conn.close()
        return jsonify({"error": "Invalid value"}), 400

    # The password chosen at registration is set only here. The condition on
    # password_hash covers the case where the record got an account in the meantime:
    # a pending link cannot overwrite a password that is already in place.
    cursor = conn.execute(
        """
        UPDATE people
        SET first_name = ?,
            last_name = ?,
            phone = COALESCE(?, phone),
            password_hash = ?
        WHERE id = ? AND (password_hash IS NULL OR password_hash = '')
        """,
        (
            pending["first_name"],
            pending["last_name"],
            pending["phone"],
            pending["password_hash"],
            pending["person_id"],
        ),
    )
    conn.commit()

    if cursor.rowcount == 0:
        conn.close()
        return jsonify({"error": "Email already used"}), 409

    row = conn.execute(
        """
        SELECT id, first_name, last_name, email, phone, role
        FROM people
        WHERE id = ?
        """,
        (pending["person_id"],),
    ).fetchone()

    conn.close()

    # No session is opened here: the person logs in with the password they just
    # confirmed, and their applications become visible again at that point.
    return jsonify(dict(row)), 200
