import sqlite3
from flask import Blueprint, jsonify, request
from db import get_db
from auth_utils import current_user, admin_required, login_required
from mailer import notify_application_received, notify_closure
import application_cvs


bp = Blueprint("ads", __name__)

def fetch_ad(conn, ad_id):
    return conn.execute(
        """SELECT ads.id, ads.title, ads.short_description, ads.description,
                  ads.salary, ads.location, ads.working_time, ads.contract_type,
                  ads.status, ads.created_at,
                  companies.name AS company,
                  categories.name AS category,
                  ads.contact_id
           FROM ads
           JOIN companies ON companies.id = ads.company_id
           JOIN categories ON categories.id = ads.category_id
           WHERE ads.id = ?""",
        (ad_id,),
    ).fetchone()

#--------------------list_ads----------------

# This is a decorator. It tells Flask: "when someone sends a GET request to the URL /ads, run the function just below."
@bp.route("/ads", methods=["GET"])
def list_ads():
    # Optional pagination: None, (page, per_page) or "invalid"
    pagination = read_pagination()
    if pagination == "invalid":
        return jsonify({"error": "Invalid pagination"}), 400

    # Condition always present: only open ads
    conditions = ["ads.status = 'open'"]
    params = []

    # q filter: text in the title or the short description
    q = request.args.get("q")
    if q:
        conditions.append("(ads.title LIKE ? OR ads.short_description LIKE ?)")
        params.extend([f"%{q}%", f"%{q}%"])

    # category filter: exact category name
    category = request.args.get("category")
    if category:
        conditions.append("categories.name = ?")
        params.append(category)

    # contract_type filter: exact contract type
    contract_type = request.args.get("contract_type")
    if contract_type:
        conditions.append("ads.contract_type = ?")
        params.append(contract_type)

    # location filter: exact place
    location = request.args.get("location")
    if location:
        conditions.append("ads.location = ?")
        params.append(location)

    # Assembly: only our own SQL fragments, never a received value
    sql = (
        """SELECT ads.id, ads.title, ads.short_description,
                  companies.name AS company, ads.location, ads.contract_type,
                  ads.salary, ads.status, ads.created_at
           FROM ads
           JOIN companies ON companies.id = ads.company_id
           JOIN categories ON categories.id = ads.category_id
           WHERE """
        + " AND ".join(conditions)
        + " ORDER BY ads.created_at DESC, ads.id DESC"
    )

    conn = get_db()

    # Total number of rows (filters included), before LIMIT/OFFSET
    total = conn.execute(
        """SELECT COUNT(*)
           FROM ads
           JOIN companies ON companies.id = ads.company_id
           JOIN categories ON categories.id = ads.category_id
           WHERE """
        + " AND ".join(conditions),
        params,
    ).fetchone()[0]

    # Pagination requested: only the rows of the page
    if pagination is not None:
        page, per_page = pagination
        sql += " LIMIT ? OFFSET ?"
        params = params + [per_page, (page - 1) * per_page]

    rows = conn.execute(sql, params).fetchall()
    conn.close()

    response = jsonify([dict(r) for r in rows])
    response.headers["X-Total-Count"] = str(total)
    return response

#-------------------get ad-------------------------

@bp.route("/ads/<int:ad_id>", methods=["GET"])
def get_ad(ad_id):
    conn = get_db()
    row = fetch_ad(conn, ad_id)
    conn.close()
    if row is None:
        return jsonify({"error": "Ad not found"}), 404
    return jsonify(dict(row))


#-------------------list_company_ads----------------

@bp.route("/companies/<int:company_id>/ads", methods=["GET"])
def list_company_ads(company_id):
    conn = get_db()

    company = conn.execute(
        "SELECT id FROM companies WHERE id = ?", (company_id,)
    ).fetchone()
    if company is None:
        conn.close()
        return jsonify({"error": "Company not found"}), 404

    rows = conn.execute(
        """SELECT ads.id, ads.title, ads.short_description,
                  companies.name AS company, ads.location, ads.contract_type,
                  ads.salary, ads.status, ads.created_at
           FROM ads
           JOIN companies ON companies.id = ads.company_id
           WHERE ads.company_id = ? AND ads.status = 'open'
           ORDER BY ads.created_at DESC, ads.id DESC""",
        (company_id,),
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

#------------------------------ POST/ads --------------------------------

@bp.route("/ads", methods=["POST"])
@admin_required
def create_ad():
    data = request.get_json(silent=True) or {}

    for field in ("title", "short_description", "company_id", "category_id"):
        if data.get(field) in (None, ""):
            return jsonify({"error": f"Missing field: {field}"}), 400

    conn = get_db()
    try:
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
                data["company_id"],
                data["category_id"],
                data.get("contact_id"),
            ),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"error": "Unknown company_id or category_id"}), 400

    row = fetch_ad(conn, cur.lastrowid)
    conn.close()
    return jsonify(dict(row)), 201



#------------------create_application-------------------

@bp.route("/ads/<int:ad_id>/applications", methods=["POST"])
def create_application(ad_id):
    # Two formats: JSON, or a multipart form when a CV is attached (file field "cv").
    if request.mimetype == "multipart/form-data":
        data = request.form.to_dict()
    else:
        data = request.get_json(silent=True) or {}

    user = current_user()

    # Attached CV: checked before any write (PDF of 2 MB at most).
    cv = None
    cv_file = request.files.get("cv")
    if cv_file is not None and cv_file.filename:
        cv = application_cvs.read_upload(cv_file)
        if cv is None:
            return jsonify({"error": "Invalid field: cv"}), 400

    # Logged-in person without a new file: they can attach the CV of their profile.
    use_profile_cv = user is not None and cv is None and data.get("use_profile_cv") in (True, "1", "true")

    # --------------------------------------------------
    # Logged-in user
    # --------------------------------------------------
    if user is not None:
        if not isinstance(data.get("message"), str) or not data["message"].strip():
            return jsonify({"error": "Missing field: message"}), 400

        person_id = user["id"]

    # --------------------------------------------------
    # Visitor not logged in
    # --------------------------------------------------
    else:
        for field in ("first_name", "last_name", "email", "message"):
            value = data.get(field)

            if not isinstance(value, str) or not value.strip():
                return jsonify({"error": f"Missing field: {field}"}), 400

        first_name = data["first_name"].strip()
        last_name = data["last_name"].strip()
        email = data["email"].strip().lower()

    conn = get_db()
    application_cvs.ensure_tables(conn)

    # Profile CV requested, but the profile has none
    if use_profile_cv and application_cvs.profile_info(conn, person_id) is None:
        conn.close()
        return jsonify({"error": "Invalid field: cv"}), 400

    # --------------------------------------------------
    # Check that the ad exists
    # --------------------------------------------------
    ad = conn.execute(
        "SELECT id, status FROM ads WHERE id = ?",
        (ad_id,)
    ).fetchone()

    if ad is None:
        conn.close()
        return jsonify({"error": "Ad not found"}), 404

    # --------------------------------------------------
    # Check that the ad is open
    # --------------------------------------------------
    if ad["status"] == "closed":
        conn.close()
        return jsonify({"error": "Ad is closed"}), 409

    # --------------------------------------------------
    # Visitor: find or create the person
    # --------------------------------------------------
    if user is None:
        person = conn.execute(
            "SELECT id, password_hash FROM people WHERE email = ?",
            (email,)
        ).fetchone()

        if person is None:
            cur = conn.execute(
                """
                INSERT INTO people
                (first_name, last_name, email, phone)
                VALUES (?, ?, ?, ?)
                """,
                (
                    first_name,
                    last_name,
                    email,
                    data.get("phone")
                )
            )

            person_id = cur.lastrowid

        elif person["password_hash"]:
            conn.close()
            return jsonify(
                {"error": "Login required for this email"}
            ), 401

        else:
            person_id = person["id"]

    # --------------------------------------------------
    # Check whether the person has already applied
    # --------------------------------------------------
    existing_application = conn.execute(
        """
        SELECT id
        FROM applications
        WHERE ad_id = ? AND person_id = ?
        """,
        (ad_id, person_id)
    ).fetchone()

    if existing_application is not None:
        conn.rollback()
        conn.close()
        return jsonify({"error": "Already applied"}), 409

    # --------------------------------------------------
    # Create the application
    # --------------------------------------------------
    try:
        cur = conn.execute(
            """
            INSERT INTO applications
            (ad_id, person_id, message)
            VALUES (?, ?, ?)
            """,
            (
                ad_id,
                person_id,
                data["message"]
            )
        )

        # Attached CV or copy of the profile CV, in the same transaction as the application
        if cv is not None:
            application_cvs.attach(conn, cur.lastrowid, *cv)
        elif use_profile_cv:
            application_cvs.attach_profile(conn, cur.lastrowid, person_id)

        # A single transaction
        conn.commit()

    except sqlite3.IntegrityError:
        conn.rollback()
        conn.close()
        return jsonify({"error": "Already applied"}), 409

    notify_application_received(conn, cur.lastrowid)
    
    # --------------------------------------------------
    # Return the application that was created
    # --------------------------------------------------
    row = conn.execute(
        """
        SELECT id, ad_id, person_id, message, status, created_at,
               EXISTS (SELECT 1 FROM application_cvs WHERE application_id = applications.id) AS has_cv
        FROM applications
        WHERE id = ?
        """,
        (cur.lastrowid,)
    ).fetchone()

    conn.close()

    application = dict(row)
    application["has_cv"] = bool(application["has_cv"])
    return jsonify(application), 201


@bp.route("/me/applications", methods=["GET"])
@login_required
def my_applications():
    user = current_user()
    conn = get_db()
    rows = conn.execute(
        """SELECT applications.id, applications.ad_id, ads.title,
                  companies.name AS company, applications.status,
                  applications.message, applications.created_at
           FROM applications
           JOIN ads ON ads.id = applications.ad_id
           JOIN companies ON companies.id = ads.company_id
           WHERE applications.person_id = ?
           ORDER BY applications.created_at DESC, applications.id DESC""",
        (user["id"],),
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


#-------------------- Profile CV (candidate area) --------------------
# The person is always the one in the session: everyone sees and changes only their own CV.

@bp.route("/me/cv", methods=["GET"])
@login_required
def my_cv():
    conn = get_db()
    application_cvs.ensure_tables(conn)
    row = application_cvs.profile_info(conn, current_user()["id"])
    conn.close()
    if row is None:
        return jsonify({"error": "CV not found"}), 404
    return jsonify(dict(row))


@bp.route("/me/cv/file", methods=["GET"])
@login_required
def my_cv_file():
    conn = get_db()
    application_cvs.ensure_tables(conn)
    row = application_cvs.profile_file(conn, current_user()["id"])
    conn.close()
    if row is None:
        return jsonify({"error": "CV not found"}), 404
    return application_cvs.send_pdf(row)


@bp.route("/me/cv", methods=["PUT"])
@login_required
def upload_my_cv():
    cv_file = request.files.get("cv")
    cv = application_cvs.read_upload(cv_file) if cv_file is not None and cv_file.filename else None
    if cv is None:
        return jsonify({"error": "Invalid field: cv"}), 400

    person_id = current_user()["id"]
    conn = get_db()
    application_cvs.ensure_tables(conn)
    application_cvs.save_profile(conn, person_id, *cv)
    row = application_cvs.profile_info(conn, person_id)
    conn.close()
    return jsonify(dict(row))


@bp.route("/me/cv", methods=["DELETE"])
@login_required
def delete_my_cv():
    conn = get_db()
    application_cvs.ensure_tables(conn)
    deleted = application_cvs.delete_profile(conn, current_user()["id"])
    conn.close()
    if not deleted:
        return jsonify({"error": "CV not found"}), 404
    return "", 204



# close_ad
@bp.route("/ads/<int:ad_id>/closure", methods=["POST"])
@admin_required
def close_ad(ad_id):
    data = request.get_json(silent=True) or {}
    conn = get_db()
    return close_ad_in_db(conn, ad_id, data)


# Closure shared by the admin (close_ad above) and the recruiter (routes/recruiter.py).
# The permission checks are done before the call. Closes conn in every case.
def close_ad_in_db(conn, ad_id, data):
    # Check that the ad exists
    ad = conn.execute(
        "SELECT id, status FROM ads WHERE id = ?",
        (ad_id,)
    ).fetchone()

    if ad is None:
        conn.close()
        return jsonify({"error": "Ad not found"}), 404

    # Check that the ad is not already closed
    if ad["status"] == "closed":
        conn.close()
        return jsonify({"error": "Ad already closed"}), 409

    # Check whether the ad has applications
    application = conn.execute(
        "SELECT id FROM applications WHERE ad_id = ?",
        (ad_id,)
    ).fetchone()

    # accepted_application_id is optional: when absent or null, no candidate is accepted
    accepted_application_id = data.get("accepted_application_id")

    # Applications exist, but no candidate is accepted: all are rejected
    if application is not None and accepted_application_id is None:
        conn.execute(
            "UPDATE applications SET status = 'rejected' WHERE ad_id = ?",
            (ad_id,)
        )

    # Applications and an accepted candidate (with no application, the ad is simply closed)
    elif application is not None:

        # Check that the application really belongs to this ad
        accepted_application = conn.execute(
            "SELECT id FROM applications WHERE id = ? AND ad_id = ?",
            (accepted_application_id, ad_id)
        ).fetchone()

        if accepted_application is None:
            conn.close()
            return jsonify(
                {"error": "Application does not belong to this ad"}
            ), 400

        # Accept the chosen application
        conn.execute(
            "UPDATE applications SET status = 'accepted' "
            "WHERE id = ?",
            (accepted_application_id,)
        )

        # Reject all the other applications
        conn.execute(
            "UPDATE applications SET status = 'rejected' "
            "WHERE ad_id = ? AND id != ?",
            (ad_id, accepted_application_id)
        )

    # Close the ad
    conn.execute(
        "UPDATE ads SET status = 'closed' WHERE id = ?",
        (ad_id,)
    )

    # A single commit of the transaction
    conn.commit()
    notify_closure(conn, ad_id)

    # Fetch the ad in the same format as GET /api/ads/<id>
    row = fetch_ad(conn, ad_id)

    conn.close()

    return jsonify(dict(row)), 200

#------------------read_pagination----------------

# Returns None (no pagination), (page, per_page) (valid) or "invalid"
def read_pagination():
    page_raw = request.args.get("page")
    per_page_raw = request.args.get("per_page")

    # no pagination requested
    if page_raw is None and per_page_raw is None:
        return None

    # only one value given: complete it with a default value
    if page_raw is None:
        page_raw = "1"
    if per_page_raw is None:
        per_page_raw = "10"

    # both must be integers
    try:
        page = int(page_raw)
        per_page = int(per_page_raw)
    except ValueError:
        # page number or page size is not an integer
        return "invalid"

    # page >= 1 and 1 <= per_page <= 50
    if page < 1 or per_page < 1 or per_page > 50:
        # invalid range
        return "invalid"

    return page, per_page
