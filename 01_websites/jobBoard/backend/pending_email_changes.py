"""Changements d'adresse e-mail en attente de confirmation.

Cas visé : une personne connectée veut une nouvelle adresse. L'adresse de sa fiche ne
change pas ici : la demande est gardée de côté, et n'est appliquée qu'après le clic sur
le lien envoyé à la NOUVELLE adresse. Ainsi une faute de frappe ne coupe jamais la
personne de ses e-mails, et une session laissée ouverte ne suffit pas à détourner le
compte : il faut aussi le mot de passe (vérifié par la route) et l'accès à la boîte.

Même construction que pending_registrations.py : le jeton n'est jamais enregistré en
clair, seule son empreinte SHA-256 est stockée. Le lien envoyé par e-mail est la seule
copie du jeton.
"""
import hashlib
import secrets

VALIDITY = "+1 day"  # durée de vie du lien, lue telle quelle par SQLite


def ensure_table(conn):
    """Crée la table si elle manque : une base déjà en place n'a pas besoin d'être refaite."""
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
    """Empreinte du jeton : c'est elle qui va en base, jamais le jeton lui-même."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create(conn, person_id, new_email):
    """Enregistre la demande et renvoie le jeton en clair, pour le lien.

    Une seule demande par personne : une nouvelle demande remplace la précédente, donc
    le lien précédent ne fonctionne plus.
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
    """Lit la demande correspondant au jeton, puis la supprime.

    Renvoie la ligne (person_id, new_email), ou None si le jeton est inconnu, déjà
    utilisé ou expiré. La suppression fait qu'un lien ne sert qu'une seule fois.
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
