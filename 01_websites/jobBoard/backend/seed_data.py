import json
import random
import re
import sqlite3
import sys
import unicodedata

from db import get_db

DATA_FILE = "data/annonces.json"
TABLES = ("companies", "categories", "people", "ads", "applications")

# Candidats de démonstration (étape 4 quater) : noms tirés au hasard, sans compte (pas de mot de passe)
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
MESSAGES = (
    "Bonjour, votre annonce correspond à mon parcours et je serais ravi(e) d'en discuter avec vous.",
    "Bonjour, je vous adresse ma candidature : ce poste correspond à ce que je recherche.",
    "Bonjour, je suis disponible rapidement et très motivé(e) par votre entreprise.",
    "Bonjour, mon expérience récente me semble proche de vos besoins. Au plaisir d'échanger.",
    "Bonjour, je souhaite rejoindre votre équipe et me tiens à votre disposition pour un entretien.",
)


def email_part(text):
    """« Léa » -> « lea » : sans accent ni espace, pour l'adresse e-mail."""
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z]", "", ascii_text.lower())

# Lire le fichier de données (4 listes : companies, categories, contacts, ads)
with open(DATA_FILE, encoding="utf-8") as f:
    data = json.load(f)

# --------------------------------------------------
# 0. SIREN du fichier : texte de 9 chiffres, sans doublon
#    (vérifié avant d'ouvrir la base : en cas d'erreur, rien n'est inséré)
# --------------------------------------------------
seen_sirens = set()

for company in data["companies"]:
    siren = company.get("siren")

    if siren is None:
        continue  # SIREN absent : l'entreprise sera retrouvée par son nom

    if not isinstance(siren, str) or not re.fullmatch(r"[0-9]{9}", siren.strip()):
        sys.exit(
            f"SIREN invalide pour {company['name']} : {siren!r} "
            "(attendu : une chaîne de 9 chiffres). À signaler à Axel."
        )

    siren = siren.strip()
    if siren in seen_sirens:
        sys.exit(f"SIREN en double dans le fichier : {siren}. À signaler à Axel.")

    seen_sirens.add(siren)
    company["siren"] = siren

conn = get_db()

# --------------------------------------------------
# 0 bis. Deuxième lancement : on s'arrête sans rien insérer
#        Une entreprise est retrouvée par son SIREN s'il est présent, sinon par son nom.
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
        f"Base déjà remplie : {len(already)} entreprise(s) du fichier existe(nt) déjà "
        f"({', '.join(already)}). Rien n'a été inséré. "
        "Relance python init_db.py avant python seed_data.py."
    )

try:
    # --------------------------------------------------
    # 1. Entreprises : insérer et garder nom -> id
    #    (les annonces du fichier désignent toujours l'entreprise par son nom)
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
        # lastrowid : l'id que la base vient d'attribuer à cette entreprise
        company_ids[company["name"]] = cur.lastrowid

    # --------------------------------------------------
    # 2. Catégories : chercher d'abord (name est UNIQUE), insérer si absente
    # --------------------------------------------------
    category_ids = {}

    for category in data["categories"]:
        row = conn.execute(
            "SELECT id FROM categories WHERE name = ?",
            (category["name"],),
        ).fetchone()

        if row is not None:
            # déjà dans seed.sql (Développement, Design, Data) : on reprend son id
            category_ids[category["name"]] = row["id"]
        else:
            cur = conn.execute(
                "INSERT INTO categories (name) VALUES (?)",
                (category["name"],),
            )
            category_ids[category["name"]] = cur.lastrowid

    # --------------------------------------------------
    # 3. Recruteurs : insérer dans people et garder email -> id
    #    (pas de password_hash, role vaut 'user' par défaut)
    # --------------------------------------------------
    contact_ids = {}

    for contact in data["contacts"]:
        email = contact["email"].strip().lower()  # même normalisation que l'inscription

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
    # 4. Annonces : retrouver les 3 id à partir des noms et de l'email
    #    (ni status ni created_at : la base met 'open' et la date du moment)
    # --------------------------------------------------
    contact_companies = {}  # id du contact -> id de l'entreprise de ses annonces

    for ad in data["ads"]:
        company_id = company_ids[ad["company"]]
        category_id = category_ids[ad["category"]]
        contact_id = contact_ids[ad["contact_email"].strip().lower()]

        # un recruteur appartient à une seule entreprise
        if contact_companies.get(contact_id, company_id) != company_id:
            conn.rollback()
            conn.close()
            sys.exit(
                f"{ad['contact_email']} publie pour deux entreprises différentes. "
                "Rien n'a été inséré. À signaler à Axel."
            )
        contact_companies[contact_id] = company_id

        # salary : converti en entier (la colonne est un INTEGER)
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
    # 4 bis. Recruteurs : rattacher chaque contact à l'entreprise de ses annonces
    #        (sans mot de passe : ils ne peuvent pas se connecter)
    # --------------------------------------------------
    for contact_id, company_id in contact_companies.items():
        conn.execute(
            "UPDATE people SET company_id = ? WHERE id = ?",
            (company_id, contact_id),
        )

    # Tirage fixe : la même base à chaque lancement
    rng = random.Random(14)

    # --------------------------------------------------
    # 4 ter. Vieillir les annonces : seules les 2 dernières gardent la date du moment
    #        (badge « Nouveau » à moins de 7 jours) ; les autres datent de 8 à 57 jours
    # --------------------------------------------------
    ad_ids = [row["id"] for row in conn.execute("SELECT id FROM ads ORDER BY id")]

    for ad_id in ad_ids[:-2]:
        conn.execute(
            "UPDATE ads SET created_at = datetime('now', ?) WHERE id = ?",
            (f"-{rng.randint(8, 57)} days", ad_id),
        )

    # --------------------------------------------------
    # 4 quater. 100 candidats sans compte, et 10 à 40 candidatures par annonce ouverte
    #           (statut pending ou rejected : accepted n'arrive que par la clôture)
    # --------------------------------------------------
    candidate_ids = []
    names = rng.sample([(first, last) for first in FIRST_NAMES for last in LAST_NAMES], CANDIDATES_COUNT)
    # email est UNIQUE : adresses déjà prises (seed.sql, recruteurs), pour ajouter un numéro si besoin
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

    # age_minutes : âge de l'annonce, pour dater chaque candidature après sa publication
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
    # erreur de la base (ex. SIREN déjà pris) : on annule tout, rien n'est enregistré
    conn.rollback()
    conn.close()
    sys.exit(f"Remplissage annulé, base inchangée : {error}")

# --------------------------------------------------
# 5. Un seul commit : tout est enregistré, ou rien si le script s'arrête avant
# --------------------------------------------------
conn.commit()

for table in TABLES:
    count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    print(f"{table}: {count}")

conn.close()
