"""Mode démo (DEMO_MODE=1) : trois comptes de démonstration et une route qui ouvre
leur session.

Le portfolio pointe sur GET /api/demo/login?role=candidat|recruteur|admin : la
session s'ouvre, puis le navigateur est redirigé vers l'espace correspondant.
Les mots de passe sont tirés au hasard à chaque démarrage : ces comptes ne se
connectent que par cette route. Hors mode démo, rien n'est enregistré.
"""
import secrets
import sqlite3

from flask import Blueprint, jsonify, redirect, request, session

from auth_utils import create_person
from db import get_db

demo = Blueprint("demo", __name__)

# rôle demandé -> adresse, prénom, nom, page d'arrivée
ACCOUNTS = {
    "candidat": ("demo.candidat@example.com", "Camille", "Démo", "/"),
    "recruteur": ("demo.recruteur@example.com", "Robin", "Démo", "/recruteur"),
    "admin": ("demo.admin@example.com", "Alex", "Démo", "/admin"),
}


def ensure_demo_accounts():
    """Crée les trois comptes s'ils manquent (appelé au démarrage de l'API)."""
    conn = get_db()
    try:
        for role, (email, first_name, last_name, _) in ACCOUNTS.items():
            if conn.execute("SELECT id FROM people WHERE email = ?", (email,)).fetchone():
                continue
            person_id = create_person(
                conn, first_name, last_name, email,
                secrets.token_urlsafe(16),
                role="admin" if role == "admin" else "user",
            )
            if role == "recruteur":
                # rattaché à l'entreprise qui a le plus d'annonces
                company = conn.execute(
                    """SELECT company_id FROM ads
                       GROUP BY company_id ORDER BY COUNT(*) DESC, company_id LIMIT 1"""
                ).fetchone()
                if company is not None:
                    conn.execute("UPDATE people SET company_id = ? WHERE id = ?",
                                 (company["company_id"], person_id))
            elif role == "candidat":
                # deux candidatures, pour que « Mes candidatures » ait un contenu
                for ad in conn.execute(
                    "SELECT id FROM ads WHERE status = 'open' ORDER BY created_at DESC, id DESC LIMIT 2"
                ).fetchall():
                    conn.execute(
                        "INSERT INTO applications (ad_id, person_id, message) VALUES (?, ?, ?)",
                        (ad["id"], person_id, "Bonjour, candidature de démonstration."),
                    )
            conn.commit()
        print("[démo] comptes prêts : " + ", ".join(ACCOUNTS))
    except sqlite3.OperationalError as error:
        print(f"[démo] comptes non créés ({error}) : lancer init_db.py d'abord")
    finally:
        conn.close()


@demo.route("/login", methods=["GET"])
def demo_login():
    role = request.args.get("role", "")
    if role not in ACCOUNTS:
        return jsonify({"error": "Unknown role"}), 400
    email, _, _, landing = ACCOUNTS[role]
    conn = get_db()
    row = conn.execute("SELECT id FROM people WHERE email = ?", (email,)).fetchone()
    conn.close()
    if row is None:
        return jsonify({"error": "Demo account missing"}), 503
    session.clear()
    session["user_id"] = row["id"]
    return redirect(landing, code=302)
