import os

from dotenv import load_dotenv

from auth_utils import create_person
from db import get_db


load_dotenv()

admin_email = os.environ.get("ADMIN_EMAIL")
admin_password = os.environ.get("ADMIN_PASSWORD")

if not admin_email or not admin_password:
    raise RuntimeError(
        "ADMIN_EMAIL et ADMIN_PASSWORD doivent être définis dans le fichier .env"
    )

admin_email = admin_email.strip().lower()

conn = get_db()

try:
    existing_admin = conn.execute(
        "SELECT id FROM people WHERE email = ?",
        (admin_email,),
    ).fetchone()

    if existing_admin:
        print("Admin déjà existant")
    else:
        create_person(
            conn,
            first_name="Admin",
            last_name="Y.I.A Jobs",
            email=admin_email,
            password=admin_password,
            role="admin",
        )

        print(f"Admin créé : {admin_email}")

finally:
    conn.close()
