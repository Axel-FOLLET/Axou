import sqlite3
from flask import Blueprint, jsonify, request, session
from werkzeug.security import check_password_hash

import pending_email_changes
import pending_registrations
from mailer import send_email_change_link, send_verification_link
from auth_utils import (
    create_person,
    current_user,
    get_json_object,
    hash_password,
    login_required,
    needs_rehash,
    validate_text_field,
)
from login_limit import seconds_blocked, record_failure, reset
from db import get_db


auth = Blueprint("auth", __name__)


@auth.route("/register", methods=["POST"])
def register():
    data, error = get_json_object()

    if error:
        return error

    for field in ("first_name", "last_name", "email", "password"):
        error = validate_text_field(data, field, email=(field == "email"))

        if error:
            return error

    password = data["password"]

    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    email = data["email"].strip().lower()
    conn = get_db()

    # Adresse déjà dans people, mais sans mot de passe : la personne existe (elle a candidaté
    # sans compte, ou une entreprise l'a saisie) et n'a jamais eu de compte. Sa fiche n'est pas
    # modifiée ici : l'inscription attend le lien envoyé à cette adresse, sinon connaître un
    # email suffirait à prendre la main sur ses candidatures.
    existing = conn.execute(
        """
        SELECT id, password_hash
        FROM people
        WHERE email = ?
        """,
        (email,),
    ).fetchone()

    if existing is not None and not existing["password_hash"]:
        first_name = data["first_name"].strip()

        token = pending_registrations.create(
            conn,
            existing["id"],
            first_name,
            data["last_name"].strip(),
            (data.get("phone") or "").strip() or None,
            hash_password(password),
        )

        conn.close()

        # Le jeton part par email, et dans le journal du serveur si l'envoi est désactivé.
        # Il ne figure jamais dans la réponse, qui est la même pour tout le monde.
        send_verification_link(email, first_name, token)

        return jsonify({"message": "Verification required"}), 202

    try:
        person_id = create_person(
            conn,
            data["first_name"],
            data["last_name"],
            email,
            password,
            phone=data.get("phone"),
        )

    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"error": "Email already used"}), 409

    row = conn.execute(
        """
        SELECT id, first_name, last_name, email, phone, role
        FROM people
        WHERE id = ?
        """,
        (person_id,),
    ).fetchone()

    conn.close()

    # Compte neuf, mot de passe choisi à l'instant : la session s'ouvre comme à la connexion.
    # Le cas 202 n'y passe jamais, tant que le lien n'a pas été ouvert.
    session.clear()
    session["user_id"] = person_id

    return jsonify(dict(row)), 201


@auth.route("/login", methods=["POST"])
def login():
    data, error = get_json_object()

    if error:
        return error

    for field in ("email", "password"):
        error = validate_text_field(data, field, email=(field == "email"))

        if error:
            return error

    email = data["email"].strip().lower()
    password = data["password"]

    blocked_seconds = seconds_blocked(email)

    if blocked_seconds > 0:
        response = jsonify({"error": "Too many attempts"})
        response.status_code = 429
        response.headers["Retry-After"] = str(blocked_seconds)
        return response

    conn = get_db()

    row = conn.execute(
        """
        SELECT id, first_name, last_name, email, phone, role, password_hash
        FROM people
        WHERE email = ?
        """,
        (email,),
    ).fetchone()

    if (
        row is None
        or not row["password_hash"]
        or not check_password_hash(row["password_hash"], password)
    ):
        record_failure(email)
        conn.close()
        return jsonify({"error": "Invalid credentials"}), 401

    # Empreinte d'un ancien réglage : le mot de passe vient d'être vérifié, on la recalcule.
    if needs_rehash(row["password_hash"]):
        conn.execute(
            "UPDATE people SET password_hash = ? WHERE id = ?",
            (hash_password(password), row["id"]),
        )
        conn.commit()

    reset(email)
    session.clear()
    session["user_id"] = row["id"]

    response = {
        "id": row["id"],
        "first_name": row["first_name"],
        "last_name": row["last_name"],
        "email": row["email"],
        "phone": row["phone"],
        "role": row["role"],
    }

    conn.close()

    return jsonify(response), 200

@auth.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return "", 204


@auth.route("/me", methods=["GET", "PATCH"])
@login_required
def me():
    user = current_user()

    if user is None:
        return jsonify({"error": "Login required"}), 401

    if request.method == "GET":
        return jsonify(user), 200

    data, error = get_json_object()

    if error:
        return error

    if not data:
        return jsonify({"error": "No fields to update"}), 400

    # L'adresse e-mail n'est pas modifiable ici : sans vérification de la nouvelle
    # adresse, on pourrait s'approprier celle d'une autre personne.
    allowed_fields = {"first_name", "last_name", "phone"}

    for field in data:
        if field not in allowed_fields:
            return jsonify({"error": f"Unknown field: {field}"}), 400

    for field in data:
        if field == "phone" and data[field] == "":
            continue

        error = validate_text_field(data, field)

        if error:
            return error

    conn = get_db()

    fields = list(data.keys())
    values = []

    for field in fields:
        value = data[field]

        if isinstance(value, str):
            value = value.strip()

        # Téléphone effacé : NULL en base, comme une personne qui n'en a jamais donné.
        if field == "phone" and value == "":
            value = None

        values.append(value)

    assignments = ", ".join(f"{field} = ?" for field in fields)
    values.append(user["id"])

    conn.execute(
        f"UPDATE people SET {assignments} WHERE id = ?",
        values,
    )
    conn.commit()

    row = conn.execute(
        """
        SELECT id, first_name, last_name, email, phone, role
        FROM people
        WHERE id = ?
        """,
        (user["id"],),
    ).fetchone()

    conn.close()

    return jsonify(dict(row)), 200


# ------------------- Changement d'adresse e-mail (contrat, section du même nom) -------------------
# Deux temps, comme la vérification d'inscription : la demande met la nouvelle adresse de côté
# et envoie un lien à cette adresse ; la confirmation, quand le lien est ouvert, applique le
# changement. PATCH /api/auth/me refuse toujours le champ email.


@auth.route("/email-change", methods=["POST"])
@login_required
def request_email_change():
    data, error = get_json_object()

    if error:
        return error

    for field in ("email", "password"):
        error = validate_text_field(data, field, email=(field == "email"))

        if error:
            return error

    new_email = data["email"].strip().lower()
    user = current_user()
    conn = get_db()

    # current_user() ne renvoie pas password_hash : on relit la fiche.
    row = conn.execute(
        """
        SELECT id, first_name, email, password_hash
        FROM people
        WHERE id = ?
        """,
        (user["id"],),
    ).fetchone()

    # Le mot de passe actuel prouve que la personne devant l'écran est bien la titulaire
    # du compte : une session laissée ouverte ne suffit pas.
    if (
        row is None
        or not row["password_hash"]
        or not check_password_hash(row["password_hash"], data["password"])
    ):
        conn.close()
        return jsonify({"error": "Invalid credentials"}), 401

    if new_email == row["email"].strip().lower():
        conn.close()
        return jsonify({"error": "Invalid value"}), 400

    # Adresse déjà dans people, avec ou sans compte : même refus qu'à l'inscription.
    existing = conn.execute(
        "SELECT id FROM people WHERE email = ?",
        (new_email,),
    ).fetchone()

    if existing is not None:
        conn.close()
        return jsonify({"error": "Email already used"}), 409

    token = pending_email_changes.create(conn, row["id"], new_email)
    conn.close()

    # Le lien part à la NOUVELLE adresse : c'est elle qu'il faut prouver. Le jeton ne
    # figure jamais dans la réponse.
    send_email_change_link(new_email, row["first_name"], token)

    return jsonify({"message": "Verification required"}), 202


@auth.route("/email-change/confirm", methods=["POST"])
def confirm_email_change():
    # Pas de session exigée : le lien peut être ouvert sur un autre appareil, le jeton
    # suffit à prouver que la nouvelle adresse est contrôlée.
    data, error = get_json_object()

    if error:
        return error

    error = validate_text_field(data, "token")

    if error:
        return error

    conn = get_db()
    pending = pending_email_changes.take(conn, data["token"].strip())

    # Jeton inconnu, déjà utilisé ou expiré : même refus dans les trois cas, pour ne rien
    # apprendre à quelqu'un qui essaierait des jetons au hasard.
    if pending is None:
        conn.close()
        return jsonify({"error": "Invalid value"}), 400

    # Entre la demande et le clic, une autre fiche a pu prendre cette adresse : la
    # contrainte UNIQUE de people.email refuse alors la mise à jour.
    try:
        conn.execute(
            "UPDATE people SET email = ? WHERE id = ?",
            (pending["new_email"], pending["person_id"]),
        )
        conn.commit()

    except sqlite3.IntegrityError:
        conn.rollback()
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

    # La session en cours, s'il y en a une, reste ouverte ; le mot de passe ne change pas.
    return jsonify(dict(row)), 200
