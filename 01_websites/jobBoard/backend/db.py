import sqlite3

DB_FILE = "jobboard.db"


def get_db():
    conn = sqlite3.connect(DB_FILE)  # opens the database.
    conn.execute("PRAGMA foreign_keys = ON")  # enables foreign keys for this connection.
    conn.row_factory = sqlite3.Row  # rows read like dictionaries (row["title"]) and work with dict(row)
    return conn