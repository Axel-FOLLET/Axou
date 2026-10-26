import sqlite3

DB_FILE = "jobboard.db" #fichier SQLite qui contient ta base
TABLES = ("companies", "categories", "people", "ads", "applications")

#ouvre la base, et la crée si le fichier n'existe pas.
conn = sqlite3.connect(DB_FILE)

#active les clés étrangères pour cette connexion (sans ça, elles ne protègent rien)
conn.execute("PRAGMA foreign_keys = ON")

#il fait un SELECT COUNT(*) et récupère le nombre de lignes par tables
for filename in ("schema.sql", "seed.sql"):
    with open(filename, encoding="utf-8") as f:
        conn.executescript(f.read()) #exécute un fichier SQL entier (plusieurs instructions d'un coup)

for table in TABLES:
    count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    print(f"{table}: {count}")

conn.close()