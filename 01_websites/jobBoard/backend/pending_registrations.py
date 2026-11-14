"""Registrations waiting for email verification.

Target case: a person already recorded in people has no password (they applied without
an account, or a company entered them). Knowing their email must never be enough to
take over their record or to see their applications: the registration is set aside
here, and is applied only after the click on the link sent to the address.

The token is never stored in plain text: only its SHA-256 fingerprint is stored, as
for a password. The link sent by email is the only copy of the token.
"""
import hashlib
import secrets

VALIDITY = "+1 day"  # lifetime of the link, read as is by SQLite


def ensure_table(conn):
    """Creates the table if it is missing: an existing database does not need to be rebuilt."""
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS pending_registrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            person_id INTEGER NOT NULL UNIQUE REFERENCES people(id) ON DELETE CASCADE,
            token_hash TEXT NOT NULL UNIQUE,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            phone TEXT,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            expires_at TEXT NOT NULL
        )
        """
    )
    conn.commit()


def _fingerprint(token):
    """Fingerprint of the token: it is what goes into the database, never the token itself."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create(conn, person_id, first_name, last_name, phone, password_hash):
    """Saves the pending registration and returns the plain token, for the link.

    One pending registration per person: a new request replaces the previous one, so
    the previous link no longer works.
    """
    ensure_table(conn)

    token = secrets.token_urlsafe(32)

    conn.execute(
        "DELETE FROM pending_registrations WHERE person_id = ?",
        (person_id,),
    )
    conn.execute(
        """
        INSERT INTO pending_registrations
        (person_id, token_hash, first_name, last_name, phone, password_hash, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now', ?))
        """,
        (
            person_id,
            _fingerprint(token),
            first_name,
            last_name,
            phone,
            password_hash,
            VALIDITY,
        ),
    )
    conn.commit()

    return token


def take(conn, token):
    """Reads the pending registration matching the token, then deletes it.

    Returns the row, or None if the token is unknown, already used or expired.
    The deletion makes a link usable only once.
    """
    ensure_table(conn)

    row = conn.execute(
        """
        SELECT id, person_id, first_name, last_name, phone, password_hash
        FROM pending_registrations
        WHERE token_hash = ? AND expires_at > datetime('now')
        """,
        (_fingerprint(token),),
    ).fetchone()

    if row is None:
        return None

    conn.execute(
        "DELETE FROM pending_registrations WHERE id = ?",
        (row["id"],),
    )
    conn.commit()

    return row
