import sqlite3

DB_FILE = "jobboard.db"


def get_db():
    conn = sqlite3.connect(DB_FILE) #ouvre la base.
    conn.execute("PRAGMA foreign_keys = ON") #active les clés étrangères pour cette connexion.
    conn.row_factory = sqlite3.Row #les lignes se lisent comme des dictionnaires (row["title"]), et dict(row)
    return conn