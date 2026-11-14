import json
import random
import re
import sqlite3
import sys
import unicodedata

from db import get_db

DATA_FILE = "data/ads.json"
TABLES = ("companies", "categories", "people", "ads", "applications")

# Demonstration candidates (step 4 quater): names drawn at random, without an account (no password)
CANDIDATES_COUNT = 100
FIRST_NAMES = (
    "Léa", "Hugo", "Chloé", "Lucas", "Emma", "Nathan", "Inès", "Théo", "Manon", "Louis",
    "Camille", "Gabriel", "Sarah", "Arthur", "Jade", "Raphaël", "Zoé", "Adam", "Clara", "Jules",
    "Lina", "Mathis", "Alice", "Tom", "Louise", "Noah", "Anaïs", "Yanis", "Julie", "Maxime",
    "Rose", "Enzo", "Lucie", "Ethan", "Margaux", "Sacha", "Elsa", "Paul", "Nina", "Victor",
)
LAST_NAMES = (
    "Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit", "Durand", "Leroy", "Moreau",
    "Simon", "Laurent", "Lefèvre", "Michel", "Garcia", "David", "Bertrand", "Roux", "Vincent", "Fournier",
    "Morel", "Girard", "André", "Mercier", "Dupont", "Lambert", "Bonnet", "François", "Martinez", "Legrand",
    "Garnier", "Faure", "Rousseau", "Blanc", "Guérin", "Muller", "Henry", "Roussel", "Nicolas", "Perrin",
)
# Application messages are demo data shown in the app, so they stay in French.
MESSAGES = (
    "Bonjour, votre annonce correspond à mon parcours et je serais ravi(e) d'en discuter avec vous.",
    "Bonjour, je vous adresse ma candidature : ce poste correspond à ce que je recherche.",
    "Bonjour, je suis disponible rapidement et très motivé(e) par votre entreprise.",
    "Bonjour, mon expérience récente me semble proche de vos besoins. Au plaisir d'échanger.",
    "Bonjour, je souhaite rejoindre votre équipe et me tiens à votre disposition pour un entretien.",
)


def email_part(text):
    """"Léa" -> "lea": no accent or space, for the email address."""
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z]", "", ascii_text.lower())

# Read the data file (4 lists: companies, categories, contacts, ads)
with open(DATA_FILE, encoding="utf-8") as f:
    data = json.load(f)

# --------------------------------------------------
# 0. SIRENs of the file: 9-digit text, no duplicates
#    (checked before opening the database: on error, nothing is inserted)
# --------------------------------------------------
seen_sirens = set()

for company in data["companies"]:
    siren = company.get("siren")

    if siren is None:
        continue  # no SIREN: the company will be found by its name

    if not isinstance(siren, str) or not re.fullmatch(r"[0-9]{9}", siren.strip()):
        sys.exit(
            f"Invalid SIREN for {company['name']}: {siren!r} "
            "(expected: a string of 9 digits). Report this to Axel."
        )

    siren = siren.strip()
    if siren in seen_sirens:
        sys.exit(f"Duplicate SIREN in the file: {siren}. Report this to Axel.")

    seen_sirens.add(siren)
    company["siren"] = siren

conn = get_db()

# --------------------------------------------------
# 0 bis. Second run: stop without inserting anything
#        A company is found by its SIREN if present, otherwise by its name.
# --------------------------------------------------
already = []

for company in data["companies"]:
    if company.get("siren") is not None:
        row = conn.execute(
            "SELECT id FROM companies WHERE siren = ?",
            (company["siren"],),
        ).fetchone()
    else:
        row = conn.execute(
            "SELECT id FROM companies WHERE name = ?",
            (company["name"],),
        ).fetchone()

    if row is not None:
        already.append(company["name"])

if already:
    conn.close()
    sys.exit(
        f"Database already filled: {len(already)} company(ies) of the file already exist "
        f"({', '.join(already)}). Nothing was inserted. "
        "Run python init_db.py again before python seed_data.py."
    )

try:
    # --------------------------------------------------
    # 1. Companies: insert and keep name -> id
    #    (the ads in the file always designate the company by its name)
    # --------------------------------------------------
    company_ids = {}

    for company in data["companies"]:
        cur = conn.execute(
            """INSERT INTO companies (name, description, location, website, siren)
               VALUES (?, ?, ?, ?, ?)""",
            (
                company["name"],
                company.get("description"),
                company.get("location"),
                company.get("website"),
                company.get("siren"),
            ),
        )
        # lastrowid: the id the database has just assigned to this company
        company_ids[company["name"]] = cur.lastrowid

    # --------------------------------------------------
    # 2. Categories: look first (name is UNIQUE), insert if absent
    # --------------------------------------------------
    category_ids = {}

    for category in data["categories"]:
        row = conn.execute(
            "SELECT id FROM categories WHERE name = ?",
            (category["name"],),
        ).fetchone()

        if row is not None:
            # already in seed.sql (Développement, Design, Data): reuse its id
            category_ids[category["name"]] = row["id"]
        else:
            cur = conn.execute(
                "INSERT INTO categories (name) VALUES (?)",
                (category["name"],),
            )
            category_ids[category["name"]] = cur.lastrowid

    # --------------------------------------------------
    # 3. Recruiters: insert into people and keep email -> id
    #    (no password_hash, role is 'user' by default)
    # --------------------------------------------------
    contact_ids = {}

    for contact in data["contacts"]:
        email = contact["email"].strip().lower()  # same normalization as registration

        cur = conn.execute(
            """INSERT INTO people (first_name, last_name, email, phone)
               VALUES (?, ?, ?, ?)""",
            (
                contact["first_name"],
                contact["last_name"],
                email,
                contact.get("phone"),
            ),
        )
        contact_ids[email] = cur.lastrowid

    # --------------------------------------------------
    # 4. Ads: find the 3 ids from the names and the email
    #    (neither status nor created_at: the database sets 'open' and the current date)
    # --------------------------------------------------
    contact_companies = {}  # contact id -> id of the company of their ads

    for ad in data["ads"]:
        company_id = company_ids[ad["company"]]
        category_id = category_ids[ad["category"]]
        contact_id = contact_ids[ad["contact_email"].strip().lower()]

        # a recruiter belongs to a single company
        if contact_companies.get(contact_id, company_id) != company_id:
            conn.rollback()
            conn.close()
            sys.exit(
                f"{ad['contact_email']} publishes for two different companies. "
                "Nothing was inserted. Report this to Axel."
            )
        contact_companies[contact_id] = company_id

        # salary: converted to an integer (the column is an INTEGER)
        salary = ad.get("salary")
        if salary is not None:
            salary = int(salary)

        conn.execute(
            """INSERT INTO ads (title, short_description, description, salary,
                                location, working_time, contract_type,
                                company_id, category_id, contact_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                ad["title"],
                ad["short_description"],
                ad.get("description"),
                salary,
                ad.get("location"),
                ad.get("working_time"),
                ad.get("contract_type"),
                company_id,
                category_id,
                contact_id,
            ),
        )

    # --------------------------------------------------
    # 4 bis. Recruiters: attach each contact to the company of their ads
    #        (no password: they cannot log in)
    # --------------------------------------------------
    for contact_id, company_id in contact_companies.items():
        conn.execute(
            "UPDATE people SET company_id = ? WHERE id = ?",
            (company_id, contact_id),
        )

    # Fixed draw: the same database at every run
    rng = random.Random(14)

    # --------------------------------------------------
    # 4 ter. Age the ads: only the last 2 keep the current date
    #        ("New" badge under 7 days); the others are 8 to 57 days old
    # --------------------------------------------------
    ad_ids = [row["id"] for row in conn.execute("SELECT id FROM ads ORDER BY id")]

    for ad_id in ad_ids[:-2]:
        conn.execute(
            "UPDATE ads SET created_at = datetime('now', ?) WHERE id = ?",
            (f"-{rng.randint(8, 57)} days", ad_id),
        )

    # --------------------------------------------------
    # 4 quater. 100 candidates without an account, and 10 to 40 applications per open ad
    #           (status pending or rejected: accepted only happens through the closure)
    # --------------------------------------------------
    candidate_ids = []
    names = rng.sample([(first, last) for first in FIRST_NAMES for last in LAST_NAMES], CANDIDATES_COUNT)
    # email is UNIQUE: addresses already taken (seed.sql, recruiters), so a number is added if needed
    used_emails = {row["email"] for row in conn.execute("SELECT email FROM people")}

    for first_name, last_name in names:
        base = f"{email_part(first_name)}.{email_part(last_name)}"
        email = f"{base}@example.com"
        number = 2
        while email in used_emails:
            email = f"{base}{number}@example.com"
            number += 1
        used_emails.add(email)

        cur = conn.execute(
            """INSERT INTO people (first_name, last_name, email, phone)
               VALUES (?, ?, ?, ?)""",
            (
                first_name,
                last_name,
                email,
                f"06{rng.randint(0, 99999999):08d}" if rng.random() < 0.7 else None,
            ),
        )
        candidate_ids.append(cur.lastrowid)

    # age_minutes: age of the ad, to date each application after its publication
    open_ads = conn.execute(
        """SELECT id, created_at,
                  CAST((julianday('now') - julianday(created_at)) * 1440 AS INTEGER) AS age_minutes
           FROM ads WHERE status = 'open'"""
    ).fetchall()

    for ad in open_ads:
        for person_id in rng.sample(candidate_ids, rng.randint(10, 40)):
            conn.execute(
                """INSERT INTO applications (ad_id, person_id, message, status, created_at)
                   VALUES (?, ?, ?, ?, datetime(?, ?))""",
                (
                    ad["id"],
                    person_id,
                    rng.choice(MESSAGES),
                    "rejected" if rng.random() < 0.2 else "pending",
                    ad["created_at"],
                    f"+{rng.randint(0, max(ad['age_minutes'], 0))} minutes",
                ),
            )

except sqlite3.Error as error:
    # database error (e.g. SIREN already taken): cancel everything, nothing is saved
    conn.rollback()
    conn.close()
    sys.exit(f"Seeding cancelled, database unchanged: {error}")

# --------------------------------------------------
# 5. A single commit: everything is saved, or nothing if the script stops before
# --------------------------------------------------
conn.commit()

for table in TABLES:
    count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    print(f"{table}: {count}")

conn.close()
