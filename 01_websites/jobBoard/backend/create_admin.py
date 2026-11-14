import os

from dotenv import load_dotenv

from auth_utils import create_person
from db import get_db


load_dotenv()

admin_email = os.environ.get("ADMIN_EMAIL")
admin_password = os.environ.get("ADMIN_PASSWORD")

if not admin_email or not admin_password:
    raise RuntimeError(
        "ADMIN_EMAIL and ADMIN_PASSWORD must be set in the .env file"
    )

admin_email = admin_email.strip().lower()

conn = get_db()

try:
    existing_admin = conn.execute(
        "SELECT id FROM people WHERE email = ?",
        (admin_email,),
    ).fetchone()

    if existing_admin:
        print("Admin already exists")
    else:
        create_person(
            conn,
            first_name="Admin",
            last_name="Y.I.A Jobs",
            email=admin_email,
            password=admin_password,
            role="admin",
        )

        print(f"Admin created: {admin_email}")

finally:
    conn.close()
