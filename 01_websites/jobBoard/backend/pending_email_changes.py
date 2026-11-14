"""Email address changes waiting for confirmation.

Target case: a logged-in person wants a new address. The address on their record does
not change here: the request is set aside, and is applied only after the click on the
link sent to the NEW address. This way a typo never cuts the person off from their
emails, and a session left open is not enough to hijack the account: the password
(checked by the route) and access to the mailbox are needed too.

Same construction as pending_registrations.py: the token is never stored in plain
text, only its SHA-256 fingerprint is stored. The link sent by email is the only copy
of the token.
"""
import hashlib
import secrets

VALIDITY = "+1 day"  # lifetime of the link, read as is by SQLite


def ensure_table(conn):
    """Creates the table if it is missing: an existing database does not need to be rebuilt."""
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS pending_email_changes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            person_id INTEGER NOT NULL UNIQUE REFERENCES people(id) ON DELETE CASCADE,
            new_email TEXT NOT NULL,
            token_hash TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            expires_at TEXT NOT NULL
        )
        """
    )
    conn.commit()


def _fingerprint(token):
    """Fingerprint of the token: it is what goes into the database, never the token itself."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create(conn, person_id, new_email):
    """Saves the request and returns the plain token, for the link.

    One request per person: a new request replaces the previous one, so the previous
    link no longer works.
    """
    ensure_table(conn)

    token = secrets.token_urlsafe(32)

    conn.execute(
        "DELETE FROM pending_email_changes WHERE person_id = ?",
        (person_id,),
    )
    conn.execute(
        """
        INSERT INTO pending_email_changes
        (person_id, new_email, token_hash, expires_at)
        VALUES (?, ?, ?, datetime('now', ?))
        """,
        (person_id, new_email, _fingerprint(token), VALIDITY),
    )
    conn.commit()

    return token


def take(conn, token):
    """Reads the request matching the token, then deletes it.

    Returns the row (person_id, new_email), or None if the token is unknown, already
    used or expired. The deletion makes a link usable only once.
    """
    ensure_table(conn)

    row = conn.execute(
        """
        SELECT id, person_id, new_email
        FROM pending_email_changes
        WHERE token_hash = ? AND expires_at > datetime('now')
        """,
        (_fingerprint(token),),
    ).fetchone()

    if row is None:
        return None

    conn.execute(
        "DELETE FROM pending_email_changes WHERE id = ?",
        (row["id"],),
    )
    conn.commit()

    return row
