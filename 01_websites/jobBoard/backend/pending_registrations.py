"""Inscriptions en attente de vérification de l'email.

Cas visé : une personne déjà enregistrée dans people n'a pas de mot de passe (elle a
candidaté sans compte, ou une entreprise l'a saisie). Connaître son email ne doit jamais
suffire à prendre la main sur sa fiche ni à voir ses candidatures : l'inscription est
gardée de côté ici, et n'est appliquée qu'après le clic sur le lien envoyé à l'adresse.

Le jeton n'est jamais enregistré en clair : seule son empreinte SHA-256 est stockée,
comme pour un mot de passe. Le lien envoyé par email est la seule copie du jeton.
"""
import hashlib
import secrets

VALIDITY = "+1 day"  # durée de vie du lien, lue telle quelle par SQLite


def ensure_table(conn):
    """Crée la table si elle manque : une base déjà en place n'a pas besoin d'être refaite."""
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
    """Empreinte du jeton : c'est elle qui va en base, jamais le jeton lui-même."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create(conn, person_id, first_name, last_name, phone, password_hash):
    """Enregistre l'inscription en attente et renvoie le jeton en clair, pour le lien.

    Une seule attente par personne : une nouvelle demande remplace la précédente, donc
    le lien précédent ne fonctionne plus.
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
    """Lit l'inscription en attente correspondant au jeton, puis la supprime.

    Renvoie la ligne, ou None si le jeton est inconnu, déjà utilisé ou expiré.
    La suppression fait qu'un lien ne sert qu'une seule fois.
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
