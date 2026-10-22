"""CV en PDF : celui du profil d'une personne et celui joint à une candidature.

Deux tables, toutes deux dans la base (pas de dossier de fichiers à gérer) :
- person_cvs : le CV enregistré dans l'espace candidat, un seul par personne, remplaçable ;
- application_cvs : le CV joint à une candidature. C'est une copie : si le candidat change
  ensuite le CV de son profil, le recruteur garde celui qu'il a reçu.

Un fichier n'est accepté que s'il commence par la signature d'un PDF (%PDF-) et pèse au plus
2 Mo : le serveur ne se fie ni au nom du fichier ni au type annoncé par le navigateur.
"""
import io
import os

from flask import send_file

MAX_SIZE = 2 * 1024 * 1024  # 2 Mo
PDF_SIGNATURE = b"%PDF-"


def ensure_tables(conn):
    """Crée les tables si elles manquent : une base déjà en place n'a pas besoin d'être refaite."""
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
    """Lit le fichier envoyé (champ cv) ; renvoie (nom, contenu), ou None s'il est refusé."""
    content = file.read(MAX_SIZE + 1)
    if not content or len(content) > MAX_SIZE or not content.startswith(PDF_SIGNATURE):
        return None
    return clean_filename(file.filename), content


def clean_filename(filename):
    """Nom affiché au téléchargement : sans dossier ni caractère de contrôle, terminé par .pdf."""
    name = os.path.basename((filename or "").replace("\\", "/"))
    name = "".join(c for c in name if c.isprintable()).strip()[:100]
    if not name.lower().endswith(".pdf"):
        name = (name or "cv") + ".pdf"
    return name


def save_profile(conn, person_id, filename, content):
    """Enregistre ou remplace le CV du profil."""
    conn.execute(
        """INSERT INTO person_cvs (person_id, filename, content) VALUES (?, ?, ?)
           ON CONFLICT (person_id) DO UPDATE SET filename = excluded.filename,
               content = excluded.content, uploaded_at = datetime('now')""",
        (person_id, filename, content),
    )
    conn.commit()


def profile_info(conn, person_id):
    """Nom et date du CV du profil, sans le contenu ; None s'il n'y en a pas."""
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
    """Supprime le CV du profil ; renvoie False s'il n'y en avait pas. Les CV déjà joints restent."""
    cur = conn.execute("DELETE FROM person_cvs WHERE person_id = ?", (person_id,))
    conn.commit()
    return cur.rowcount > 0


def attach(conn, application_id, filename, content):
    """Joint un CV à une candidature, dans la transaction en cours (pas de commit ici)."""
    conn.execute(
        "INSERT INTO application_cvs (application_id, filename, content) VALUES (?, ?, ?)",
        (application_id, filename, content),
    )


def attach_profile(conn, application_id, person_id):
    """Copie le CV du profil sur la candidature (pas de commit ici) ; False si le profil n'en a pas."""
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
    """Réponse de téléchargement : le PDF, avec son nom d'origine."""
    return send_file(
        io.BytesIO(row["content"]),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=row["filename"],
    )
