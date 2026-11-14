"""PDF CVs: the one on a person's profile and the one attached to an application.

Two tables, both in the database (no folder of files to manage):
- person_cvs: the CV saved in the candidate area, one per person, replaceable;
- application_cvs: the CV attached to an application. It is a copy: if the candidate
  later changes the CV on their profile, the recruiter keeps the one they received.

A file is accepted only if it starts with the PDF signature (%PDF-) and weighs at most
2 MB: the server trusts neither the file name nor the type announced by the browser.
"""
import io
import os

from flask import send_file

MAX_SIZE = 2 * 1024 * 1024  # 2 MB
PDF_SIGNATURE = b"%PDF-"


def ensure_tables(conn):
    """Creates the tables if they are missing: an existing database does not need to be rebuilt."""
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS person_cvs (
            person_id INTEGER PRIMARY KEY REFERENCES people(id) ON DELETE CASCADE,
            filename TEXT NOT NULL,
            content BLOB NOT NULL,
            uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS application_cvs (
            application_id INTEGER PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
            filename TEXT NOT NULL,
            content BLOB NOT NULL,
            uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        """
    )
    conn.commit()


def read_upload(file):
    """Reads the uploaded file (cv field); returns (name, content), or None if it is refused."""
    content = file.read(MAX_SIZE + 1)
    if not content or len(content) > MAX_SIZE or not content.startswith(PDF_SIGNATURE):
        return None
    return clean_filename(file.filename), content


def clean_filename(filename):
    """Name shown on download: no folder or control character, ending with .pdf."""
    name = os.path.basename((filename or "").replace("\\", "/"))
    name = "".join(c for c in name if c.isprintable()).strip()[:100]
    if not name.lower().endswith(".pdf"):
        name = (name or "cv") + ".pdf"
    return name


def save_profile(conn, person_id, filename, content):
    """Saves or replaces the profile CV."""
    conn.execute(
        """INSERT INTO person_cvs (person_id, filename, content) VALUES (?, ?, ?)
           ON CONFLICT (person_id) DO UPDATE SET filename = excluded.filename,
               content = excluded.content, uploaded_at = datetime('now')""",
        (person_id, filename, content),
    )
    conn.commit()


def profile_info(conn, person_id):
    """Name and date of the profile CV, without the content; None if there is none."""
    return conn.execute(
        "SELECT filename, uploaded_at FROM person_cvs WHERE person_id = ?",
        (person_id,),
    ).fetchone()


def profile_file(conn, person_id):
    return conn.execute(
        "SELECT filename, content FROM person_cvs WHERE person_id = ?",
        (person_id,),
    ).fetchone()


def delete_profile(conn, person_id):
    """Deletes the profile CV; returns False if there was none. CVs already attached stay."""
    cur = conn.execute("DELETE FROM person_cvs WHERE person_id = ?", (person_id,))
    conn.commit()
    return cur.rowcount > 0


def attach(conn, application_id, filename, content):
    """Attaches a CV to an application, in the current transaction (no commit here)."""
    conn.execute(
        "INSERT INTO application_cvs (application_id, filename, content) VALUES (?, ?, ?)",
        (application_id, filename, content),
    )


def attach_profile(conn, application_id, person_id):
    """Copies the profile CV onto the application (no commit here); False if the profile has none."""
    cur = conn.execute(
        """INSERT INTO application_cvs (application_id, filename, content)
           SELECT ?, filename, content FROM person_cvs WHERE person_id = ?""",
        (application_id, person_id),
    )
    return cur.rowcount > 0


def application_file(conn, application_id):
    return conn.execute(
        "SELECT filename, content FROM application_cvs WHERE application_id = ?",
        (application_id,),
    ).fetchone()


def send_pdf(row):
    """Download response: the PDF, with its original name."""
    return send_file(
        io.BytesIO(row["content"]),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=row["filename"],
    )
