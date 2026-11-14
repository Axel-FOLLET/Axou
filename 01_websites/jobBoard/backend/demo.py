"""Demo mode (DEMO_MODE=1): three demonstration accounts and a route that opens
their session.

The portfolio points to GET /api/demo/login?role=candidat|recruteur|admin: the
session is opened, then the browser is redirected to the matching area.
With &lang=fr or &lang=en (portfolio links), the interface opens in that language.
The passwords are drawn at random at every start: these accounts can only be
logged into through this route. Outside demo mode, nothing is created.
"""
import secrets
import sqlite3

from flask import Blueprint, jsonify, redirect, request, session

from auth_utils import create_person
from db import get_db

demo = Blueprint("demo", __name__)

# requested role -> email, first name, last name, landing page
ACCOUNTS = {
    "candidat": ("demo.candidat@example.com", "Camille", "Démo", "/"),
    "recruteur": ("demo.recruteur@example.com", "Robin", "Démo", "/recruteur"),
    "admin": ("demo.admin@example.com", "Alex", "Démo", "/admin"),
}


def ensure_demo_accounts():
    """Creates the three accounts if they are missing (called when the API starts)."""
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
                # attached to the company that has the most ads
                company = conn.execute(
                    """SELECT company_id FROM ads
                       GROUP BY company_id ORDER BY COUNT(*) DESC, company_id LIMIT 1"""
                ).fetchone()
                if company is not None:
                    conn.execute("UPDATE people SET company_id = ? WHERE id = ?",
                                 (company["company_id"], person_id))
            elif role == "candidat":
                # two applications, so that "My applications" has some content
                for ad in conn.execute(
                    "SELECT id FROM ads WHERE status = 'open' ORDER BY created_at DESC, id DESC LIMIT 2"
                ).fetchall():
                    conn.execute(
                        "INSERT INTO applications (ad_id, person_id, message) VALUES (?, ?, ?)",
                        (ad["id"], person_id, "Bonjour, candidature de démonstration."),
                    )
            conn.commit()
        print("[demo] accounts ready: " + ", ".join(ACCOUNTS))
    except sqlite3.OperationalError as error:
        print(f"[demo] accounts not created ({error}): run init_db.py first")
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
    # ?lang=fr|en is passed on to the landing page: the front end (LangProvider) reads it and shows that language.
    lang = request.args.get("lang")
    if lang in ("fr", "en"):
        landing += f"?lang={lang}"
    return redirect(landing, code=302)
