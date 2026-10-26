"""Vérification de l'adresse email après une inscription mise en attente.

Deuxième moitié du parcours écrit dans docs/contrat_api.md : register met l'inscription
de côté et envoie un lien, cette route applique l'inscription quand le lien est ouvert.
La route vit dans son propre fichier, comme login_limit pour la limite de connexion :
routes/auth.py n'a ainsi qu'un ajout de quelques lignes.
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

    # Jeton inconnu, déjà utilisé ou expiré : même refus dans les trois cas, pour ne rien
    # apprendre à quelqu'un qui essaierait des jetons au hasard.
    if pending is None:
        conn.close()
        return jsonify({"error": "Invalid value"}), 400

    # Le mot de passe choisi à l'inscription n'est posé qu'ici. La condition sur
    # password_hash protège le cas où la fiche aurait reçu un compte entre-temps :
    # un lien en attente ne peut pas écraser un mot de passe déjà en place.
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

    # Aucune session n'est ouverte ici : la personne se connecte avec le mot de passe
    # qu'elle vient de confirmer, et ses candidatures redeviennent visibles à ce moment-là.
    return jsonify(dict(row)), 200
