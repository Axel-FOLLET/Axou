import sqlite3

DB_FILE = "jobboard.db"  # SQLite file that holds the database
TABLES = ("companies", "categories", "people", "ads", "applications")

# opens the database, and creates it if the file does not exist.
conn = sqlite3.connect(DB_FILE)

# enables foreign keys for this connection (without this, they protect nothing)
conn.execute("PRAGMA foreign_keys = ON")

# runs the schema and the seed, then (below) counts the rows of each table with SELECT COUNT(*)
for filename in ("schema.sql", "seed.sql"):
    with open(filename, encoding="utf-8") as f:
        conn.executescript(f.read())  # runs a whole SQL file (several statements at once)

for table in TABLES:
    count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    print(f"{table}: {count}")

conn.close()