import re
import sqlite3
from flask import Blueprint, jsonify, request
from db import get_db
from auth_utils import admin_required
from routes.ads import read_pagination
bp = Blueprint("admin", __name__)

# Allowed tables
TABLES = {
    "companies": ["id", "name", "description", "location", "website", "siren"],
    "categories": ["id", "name"],
    "people": ["id", "first_name", "last_name", "email", "phone", "role", "company_id"],
    "ads": [
        "id",
        "title",
        "short_description",
        "description",
        "salary",
        "location",
        "working_time",
        "contract_type",
        "status",
        "created_at",
        "company_id",
        "category_id",
        "contact_id",
    ],
    "applications": [
        "id",
        "ad_id",
        "person_id",
        "message",
        "status",
        "created_at",
        "receipt_email_sent_at",
        "decision_email_sent_at",
    ],
}

# Editable fields
EDITABLE_FIELDS = {
    "companies": ["name", "description", "location", "website", "siren"],
    "categories": ["name"],
    "people": ["first_name", "last_name", "email", "phone", "role", "company_id"],
    "ads": [
        "title",
        "short_description",
        "description",
        "salary",
        "location",
        "working_time",
        "contract_type",
        "company_id",
        "category_id",
        "contact_id",
    ],
    "applications": [
        "ad_id",
        "person_id",
        "message",
    ],
}


# Fields required at creation
REQUIRED_FIELDS = {
    "companies": ["name", "siren"],
    "categories": ["name"],
    "people": ["first_name", "last_name", "email"],
    "ads": ["title", "short_description", "company_id", "category_id"],
    "applications": ["ad_id", "person_id", "message"],
}


# Check that a table is allowed
def check_table(table):
    if table not in TABLES:
        return False
    return True


# Check and clean the SIREN: None if valid, otherwise the error response.
# The SIREN must be a string (never a JSON number, to keep the leading zeros).
def check_siren(data):
    siren = data.get("siren")

    if isinstance(siren, str):
        siren = siren.strip()
        data["siren"] = siren

    # missing, null, empty or only spaces (also in PATCH: it cannot be cleared)
    if siren in (None, ""):
        return jsonify({"error": "Missing field: siren"}), 400

    # exactly 9 digits from 0 to 9, as text
    if not isinstance(siren, str) or not re.fullmatch(r"[0-9]{9}", siren):
        return jsonify({"error": "Invalid value"}), 400

    return None


# GET all rows
@bp.route("/admin/<table>", methods=["GET"])
@admin_required
def list_records(table):
    if not check_table(table):
        return jsonify({"error": "Unknown table"}), 404

    # Optional pagination: None, (page, per_page) or "invalid"
    pagination = read_pagination()
    if pagination == "invalid":
        return jsonify({"error": "Invalid pagination"}), 400

    # Optional sort direction: asc or desc; when absent, the order stays as before (id ascending).
    # Only the words ASC or DESC go into the SQL, never the received text.
    order = request.args.get("order")
    if order not in (None, "asc", "desc"):
        return jsonify({"error": "Invalid order"}), 400

    conn = get_db()

    columns = TABLES[table]

    # Dated tables (ads, applications): by date, then by id to break ties; the others by id.
    if order is None:
        order_by = "id"
    elif "created_at" in columns:
        order_by = f"created_at {order.upper()}, id {order.upper()}"
    else:
        order_by = f"id {order.upper()}"

    total = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]

    sql = f"""
        SELECT {", ".join(columns)}
        FROM {table}
        ORDER BY {order_by}
    """
    params = []

    if pagination is not None:
        page, per_page = pagination
        sql += " LIMIT ? OFFSET ?"
        params = [per_page, (page - 1) * per_page]

    rows = conn.execute(sql, params).fetchall()

    conn.close()

    response = jsonify([dict(row) for row in rows])
    response.headers["X-Total-Count"] = str(total)
    return response


# GET one row
@bp.route("/admin/<table>/<int:record_id>", methods=["GET"])
@admin_required
def get_record(table, record_id):
    if not check_table(table):
        return jsonify({"error": "Unknown table"}), 404

    conn = get_db()

    columns = TABLES[table]

    sql = f"""
        SELECT {", ".join(columns)}
        FROM {table}
        WHERE id = ?
    """

    row = conn.execute(sql, (record_id,)).fetchone()

    conn.close()

    if row is None:
        return jsonify({"error": "Record not found"}), 404

    return jsonify(dict(row))


# POST create a row
@bp.route("/admin/<table>", methods=["POST"])
@admin_required
def create_record(table):
    if not check_table(table):
        return jsonify({"error": "Unknown table"}), 404

    data = request.get_json(silent=True) or {}

    # Check for unknown fields
    for field in data:
        if field not in EDITABLE_FIELDS[table]:
            return jsonify({"error": f"Unknown field: {field}"}), 400

    # Check the required fields
    for field in REQUIRED_FIELDS[table]:
        if data.get(field) in (None, ""):
            return jsonify({"error": f"Missing field: {field}"}), 400

    # Validate the SIREN (required at creation)
    if table == "companies":
        error = check_siren(data)
        if error:
            return error

    # Normalize the email
    if table == "people":
        data["email"] = data["email"].strip().lower()

    fields = list(data.keys())
    values = [data[field] for field in fields]

    conn = get_db()

    placeholders = ", ".join(["?"] * len(fields))

    sql = f"""
        INSERT INTO {table} ({", ".join(fields)})
        VALUES ({placeholders})
    """

    try:
        cursor = conn.execute(sql, values)
        conn.commit()

    except sqlite3.IntegrityError as error:
        conn.rollback()
        conn.close()

        if "UNIQUE" in str(error):
            return jsonify({"error": "Already exists"}), 409

        if "FOREIGN KEY" in str(error):
            return jsonify({"error": "Unknown reference"}), 400

        if "CHECK" in str(error):
            return jsonify({"error": "Invalid value"}), 400

        return jsonify({"error": "Database error"}), 400

    record_id = cursor.lastrowid

    row = conn.execute(
        f"SELECT {', '.join(TABLES[table])} "
        f"FROM {table} WHERE id = ?",
        (record_id,),
    ).fetchone()

    conn.close()

    return jsonify(dict(row)), 201


# PATCH edit a row
@bp.route("/admin/<table>/<int:record_id>", methods=["PATCH"])
@admin_required
def update_record(table, record_id):
    if not check_table(table):
        return jsonify({"error": "Unknown table"}), 404

    data = request.get_json(silent=True) or {}

    # Check the fields sent
    for field in data:
        if field not in EDITABLE_FIELDS[table]:
            return jsonify({"error": f"Unknown field: {field}"}), 400

    if not data:
        return jsonify({"error": "No fields to update"}), 400

    # Validate the SIREN only if it is sent (otherwise it keeps its value)
    if table == "companies" and "siren" in data:
        error = check_siren(data)
        if error:
            return error

    # Normalize the email
    if table == "people" and "email" in data:
        data["email"] = data["email"].strip().lower()

    conn = get_db()

    # Check that the row exists
    row = conn.execute(
        f"SELECT id FROM {table} WHERE id = ?",
        (record_id,),
    ).fetchone()

    if row is None:
        conn.close()
        return jsonify({"error": "Record not found"}), 404

    fields = list(data.keys())
    values = [data[field] for field in fields]

    assignments = ", ".join(
        f"{field} = ?" for field in fields
    )

    sql = f"""
        UPDATE {table}
        SET {assignments}
        WHERE id = ?
    """

    try:
        conn.execute(sql, values + [record_id])
        conn.commit()

    except sqlite3.IntegrityError as error:
        conn.rollback()
        conn.close()

        if "UNIQUE" in str(error):
            return jsonify({"error": "Already exists"}), 409

        if "FOREIGN KEY" in str(error):
            return jsonify({"error": "Unknown reference"}), 400

        if "CHECK" in str(error):
            return jsonify({"error": "Invalid value"}), 400

        return jsonify({"error": "Database error"}), 400

    row = conn.execute(
        f"SELECT {', '.join(TABLES[table])} "
        f"FROM {table} WHERE id = ?",
        (record_id,),
    ).fetchone()

    conn.close()

    return jsonify(dict(row)), 200


# DELETE a row
@bp.route("/admin/<table>/<int:record_id>", methods=["DELETE"])
@admin_required
def delete_record(table, record_id):
    if not check_table(table):
        return jsonify({"error": "Unknown table"}), 404

    conn = get_db()

    # Check that the row exists
    row = conn.execute(
        f"SELECT id FROM {table} WHERE id = ?",
        (record_id,),
    ).fetchone()

    if row is None:
        conn.close()
        return jsonify({"error": "Record not found"}), 404

    try:
        conn.execute(
            f"DELETE FROM {table} WHERE id = ?",
            (record_id,),
        )

        conn.commit()

    except sqlite3.IntegrityError:
        conn.rollback()
        conn.close()
        return jsonify({"error": "Record is still referenced"}), 409

    conn.close()

    return "", 204