from functools import wraps
from flask import Blueprint, jsonify, request
from auth_utils import current_user
from db import get_db
from routes.ads import fetch_ad, close_ad_in_db
from mailer import notify_rejection
import application_cvs

recruiter = Blueprint("recruiter", __name__)

# Champs que le recruteur peut modifier sur son entreprise (pas le siren)
COMPANY_FIELDS = ["name", "description", "location", "website"]

# Champs acceptés pour une nouvelle annonce (company_id et contact_id : remplis par le serveur)
AD_FIELDS = [
    "title",
    "short_description",
    "category_id",
    "description",
    "salary",
    "location",
    "working_time",
    "contract_type",
]
AD_REQUIRED = ["title", "short_description", "category_id"]

# Une candidature avec son candidat, au format du contrat (liste et refus)
APPLICATION_SELECT = """SELECT applications.id, people.first_name, people.last_name, people.email,
                  people.phone, applications.message, applications.status, applications.created_at,
                  EXISTS (SELECT 1 FROM application_cvs
                          WHERE application_cvs.application_id = applications.id) AS has_cv
           FROM applications
           JOIN people ON people.id = applications.person_id"""


def application_json(row):
    """Une ligne de APPLICATION_SELECT au format du contrat : has_cv en vrai ou faux."""
    application = dict(row)
    application["has_cv"] = bool(application["has_cv"])
    return application

# l'annonce, seulement si elle appartient à l'entreprise du recruteur ; sinon None
def fetch_own_ad(conn, ad_id, company_id):
    return conn.execute(
        "SELECT id, status FROM ads WHERE id = ? AND company_id = ?",
        (ad_id, company_id),
    ).fetchone()

# Vérifier que la personne connectée est recruteur.
# Le company_id vient toujours de la fiche de la personne connectée, jamais du client :
# il est transmis à la route en argument (def ma_route(company_id): ...).
def recruiter_required(view):
    @wraps(view)
    def wrapped_view(*args, **kwargs):
        user = current_user()

        # 1. pas de session -> 401 Login required
        if user is None:
            return jsonify({"error": "Login required"}), 401

        # current_user() ne renvoie pas company_id : on le lit dans la base
        conn = get_db()
        row = conn.execute(
            "SELECT company_id FROM people WHERE id = ?",
            (user["id"],),
        ).fetchone()
        conn.close()

        # 2. pas de company_id -> 403 Recruiter only (même pour un admin)
        if row is None or row["company_id"] is None:
            return jsonify({"error": "Recruiter only"}), 403

        # 3. sinon : appeler la vraie route, avec l'entreprise du recruteur
        return view(*args, company_id=row["company_id"], **kwargs)

    return wrapped_view


# Lire l'entreprise dans le format du contrat
def fetch_company(conn, company_id):
    return conn.execute(
        """SELECT id, name, description, location, website, siren
           FROM companies
           WHERE id = ?""",
        (company_id,),
    ).fetchone()


#------------------- GET /api/categories (publique) -------------------

@recruiter.route("/categories", methods=["GET"])
def list_categories():
    conn = get_db()
    rows = conn.execute("SELECT id, name FROM categories ORDER BY name").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


#------------------- POST /api/recruiter/ads/<id>/closure -------------------

@recruiter.route("/recruiter/ads/<int:ad_id>/closure", methods=["POST"])
@recruiter_required
def close_company_ad(ad_id, company_id):
    data = request.get_json(silent=True) or {}
    conn = get_db()

    # annonce d'une autre entreprise ou inexistante : même 404, rien n'est modifié
    if fetch_own_ad(conn, ad_id, company_id) is None:
        conn.close()
        return jsonify({"error": "Ad not found"}), 404

    # mêmes règles que la clôture admin : la fonction est partagée
    return close_ad_in_db(conn, ad_id, data)


#------------------- GET /api/recruiter/company -------------------

@recruiter.route("/recruiter/company", methods=["GET"])
@recruiter_required
def get_company(company_id):
    conn = get_db()
    row = fetch_company(conn, company_id)
    conn.close()
    return jsonify(dict(row))


#------------------- PATCH /api/recruiter/company -------------------

@recruiter.route("/recruiter/company", methods=["PATCH"])
@recruiter_required
def update_company(company_id):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        data = {}

    if not data:
        return jsonify({"error": "No fields to update"}), 400

    # siren, id ou tout autre champ : refusé
    for field in data:
        if field not in COMPANY_FIELDS:
            return jsonify({"error": f"Unknown field: {field}"}), 400

    # name ne peut pas être vidé
    if "name" in data:
        name = data["name"]
        if not isinstance(name, str) or not name.strip():
            return jsonify({"error": "Missing field: name"}), 400
        data["name"] = name.strip()

    fields = list(data.keys())
    assignments = ", ".join(f"{field} = ?" for field in fields)  # noms tirés de COMPANY_FIELDS
    values = [data[field] for field in fields]

    conn = get_db()
    # WHERE id = l'entreprise du recruteur : il ne peut modifier que la sienne
    conn.execute(
        f"UPDATE companies SET {assignments} WHERE id = ?",
        values + [company_id],
    )
    conn.commit()
    row = fetch_company(conn, company_id)
    conn.close()
    return jsonify(dict(row)), 200


#------------------- GET /api/recruiter/ads -------------------

@recruiter.route("/recruiter/ads", methods=["GET"])
@recruiter_required
def list_company_ads(company_id):
    conn = get_db()
    # LEFT JOIN : garde les annonces sans candidature (applications_count = 0)
    rows = conn.execute(
        """SELECT ads.id, ads.title, ads.short_description, ads.location,
                  ads.contract_type, ads.status, ads.created_at,
                  COUNT(applications.id) AS applications_count,
                  MIN(CASE WHEN applications.status = 'pending'
                           THEN applications.created_at END) AS oldest_unanswered_at
           FROM ads
           LEFT JOIN applications ON applications.ad_id = ads.id
           WHERE ads.company_id = ?
           GROUP BY ads.id
           ORDER BY ads.created_at DESC, ads.id DESC""",
        (company_id,),
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


#------------------- POST /api/recruiter/ads -------------------

@recruiter.route("/recruiter/ads", methods=["POST"])
@recruiter_required
def create_company_ad(company_id):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        data = {}

    # company_id, contact_id ou tout autre champ : refusé
    for field in data:
        if field not in AD_FIELDS:
            return jsonify({"error": f"Unknown field: {field}"}), 400

    for field in AD_REQUIRED:
        if data.get(field) in (None, ""):
            return jsonify({"error": f"Missing field: {field}"}), 400

    # category_id doit être un identifiant (pas une liste, pas true/false)
    category_id = data["category_id"]
    if isinstance(category_id, bool) or not isinstance(category_id, (int, str)):
        return jsonify({"error": "Unknown category_id"}), 400

    conn = get_db()

    category = conn.execute(
        "SELECT id FROM categories WHERE id = ?",
        (category_id,),
    ).fetchone()
    if category is None:
        conn.close()
        return jsonify({"error": "Unknown category_id"}), 400

    # le serveur remplit l'entreprise (celle du recruteur) et le contact (le recruteur)
    contact_id = current_user()["id"]

    cur = conn.execute(
        """INSERT INTO ads (title, short_description, description, salary,
                            location, working_time, contract_type,
                            company_id, category_id, contact_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            data["title"],
            data["short_description"],
            data.get("description"),
            data.get("salary"),
            data.get("location"),
            data.get("working_time"),
            data.get("contract_type"),
            company_id,
            data["category_id"],
            contact_id,
        ),
    )
    conn.commit()

    row = fetch_ad(conn, cur.lastrowid)
    conn.close()
    return jsonify(dict(row)), 201

@recruiter.route("/recruiter/ads/<int:ad_id>/applications", methods=["GET"])
@recruiter_required
def list_ad_applications(ad_id, company_id):
    conn = get_db()
    application_cvs.ensure_tables(conn)

    if fetch_own_ad(conn, ad_id, company_id) is None:
        conn.close()
        return jsonify({"error": "Ad not found"}), 404

    # les candidatures de l'annonce, avec le candidat, de la plus ancienne à la plus récente
    rows = conn.execute(
        f"""{APPLICATION_SELECT}
           WHERE applications.ad_id = ?
           ORDER BY applications.created_at, applications.id""",
        (ad_id,),
    ).fetchall()

    conn.close()
    return jsonify([application_json(r) for r in rows])


#------------------- GET /api/recruiter/ads/<id>/applications/<application_id>/cv -------------------

@recruiter.route("/recruiter/ads/<int:ad_id>/applications/<int:application_id>/cv", methods=["GET"])
@recruiter_required
def download_application_cv(ad_id, application_id, company_id):
    conn = get_db()
    application_cvs.ensure_tables(conn)

    # annonce d'une autre entreprise ou inexistante : même 404
    if fetch_own_ad(conn, ad_id, company_id) is None:
        conn.close()
        return jsonify({"error": "Ad not found"}), 404

    # la candidature doit appartenir à cette annonce
    application = conn.execute(
        "SELECT id FROM applications WHERE id = ? AND ad_id = ?",
        (application_id, ad_id),
    ).fetchone()
    if application is None:
        conn.close()
        return jsonify({"error": "Application not found"}), 404

    row = application_cvs.application_file(conn, application_id)
    conn.close()
    if row is None:
        return jsonify({"error": "CV not found"}), 404
    return application_cvs.send_pdf(row)


#------------------- POST /api/recruiter/ads/<id>/applications/<application_id>/rejection -------------------

@recruiter.route("/recruiter/ads/<int:ad_id>/applications/<int:application_id>/rejection", methods=["POST"])
@recruiter_required
def reject_application(ad_id, application_id, company_id):
    conn = get_db()
    application_cvs.ensure_tables(conn)

    # annonce d'une autre entreprise ou inexistante : même 404, rien n'est modifié
    ad = fetch_own_ad(conn, ad_id, company_id)
    if ad is None:
        conn.close()
        return jsonify({"error": "Ad not found"}), 404

    if ad["status"] == "closed":
        conn.close()
        return jsonify({"error": "Ad already closed"}), 409

    # la candidature doit appartenir à cette annonce
    application = conn.execute(
        "SELECT status FROM applications WHERE id = ? AND ad_id = ?",
        (application_id, ad_id),
    ).fetchone()
    if application is None:
        conn.close()
        return jsonify({"error": "Application not found"}), 404

    # seule une candidature en attente se refuse
    if application["status"] != "pending":
        conn.close()
        return jsonify({"error": "Application already processed"}), 409

    # l'annonce reste ouverte, les autres candidatures ne changent pas
    conn.execute(
        "UPDATE applications SET status = 'rejected' WHERE id = ?",
        (application_id,),
    )
    conn.commit()

    # e-mail après la validation : un échec d'envoi ne change pas la réponse
    notify_rejection(conn, application_id)

    row = conn.execute(
        f"{APPLICATION_SELECT} WHERE applications.id = ?",
        (application_id,),
    ).fetchone()
    conn.close()
    return jsonify(application_json(row))

#------------------- PATCH /api/recruiter/ads -------------------

@recruiter.route("/recruiter/ads/<int:ad_id>", methods=["PATCH"])
@recruiter_required
def update_company_ad(ad_id, company_id):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        data = {}
    if not data:
        return jsonify({"error": "No fields to update"}), 400
    

    for field in data:
        if field not in AD_FIELDS: 
            return jsonify({"error": f"Unknown field: {field}"}), 400

    for field in AD_REQUIRED:
        if field in data and data[field] in (None, ""):
            return jsonify({"error": f"Missing field: {field}"}), 400

    conn = get_db()

    ad = fetch_own_ad(conn, ad_id, company_id)
    
    if ad is None:
        conn.close()
        return jsonify({"error": "Ad not found"}), 404

    if ad["status"] == "closed":
        conn.close()
        return jsonify({"error": "Ad is closed"}), 409

    # category_id vérifié seulement s'il est envoyé
    if "category_id" in data:
        category_id = data["category_id"]
        if isinstance(category_id, bool) or not isinstance(category_id, (int, str)):
            conn.close()
            return jsonify({"error": "Unknown category_id"}), 400

        category = conn.execute(
            "SELECT id FROM categories WHERE id = ?",
            (category_id,),
        ).fetchone()
        if category is None:
            conn.close()
            return jsonify({"error": "Unknown category_id"}), 400

    # seuls les champs envoyés changent
    fields = list(data.keys())
    assignments = ", ".join(f"{field} = ?" for field in fields)  # noms tirés de AD_FIELDS
    values = [data[field] for field in fields]

    conn.execute(
        f"UPDATE ads SET {assignments} WHERE id = ? AND company_id = ?",
        values + [ad_id, company_id],
    )
    conn.commit()

    row = fetch_ad(conn, ad_id)
    conn.close()
    return jsonify(dict(row)), 200

#------------------- DELETE /api/recruiter/ads/<id> -------------------

@recruiter.route("/recruiter/ads/<int:ad_id>", methods=["DELETE"])
@recruiter_required
def delete_company_ad(ad_id, company_id):
    conn = get_db()

    if fetch_own_ad(conn, ad_id, company_id) is None:
        conn.close()
        return jsonify({"error": "Ad not found"}), 404

    if conn.execute(
        "SELECT 1 FROM applications WHERE ad_id = ? LIMIT 1", (ad_id,)
    ).fetchone() is not None:
        conn.close()
        return jsonify({"error": "Ad has applications"}), 409
    
    conn.execute("DELETE FROM ads WHERE id = ?", (ad_id,))
    conn.commit()
    conn.close()
    return "", 204
