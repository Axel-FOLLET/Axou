"""Envoi des vrais emails du Job Board (accusé de réception, retenue, refus).

Les réglages viennent de .env (jamais du code) :
    MAIL_ENABLED=1                 # 0 ou absent : rien n'est envoyé, le message s'affiche dans le terminal
    SMTP_HOST=smtp.gmail.com
    SMTP_PORT=587
    SMTP_USER=adresse@example.com  # le compte d'envoi de l'équipe, seulement dans .env
    SMTP_PASSWORD=...              # seulement dans .env
    MAIL_FROM=adresse@example.com

Règle importante : un email qui échoue ne doit jamais faire échouer la candidature ni la clôture.
Les fonctions renvoient donc True ou False, et ne lèvent jamais d'exception.
"""
import os
import smtplib
from email.message import EmailMessage


def send_email(to, subject, body):
    """Envoie un email texte. Renvoie True si l'envoi a réussi, False sinon."""
    if os.environ.get("MAIL_ENABLED") != "1":
        print(f"[mail désactivé] À : {to} | Sujet : {subject}")
        return False

    msg = EmailMessage()
    msg["From"] = os.environ.get("MAIL_FROM", os.environ.get("SMTP_USER", ""))
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    try:
        port = int(os.environ.get("SMTP_PORT", "587"))
        with smtplib.SMTP(os.environ["SMTP_HOST"], port, timeout=10) as smtp:
            smtp.starttls()
            smtp.login(os.environ["SMTP_USER"], os.environ["SMTP_PASSWORD"])
            smtp.send_message(msg)
        return True
    except Exception as err:  # réseau, identifiants, réglage manquant : on note et on continue
        print(f"[mail non envoyé] À : {to} | {type(err).__name__} : {err}")
        return False


def notify_application_received(conn, application_id):
    """Accusé de réception, juste après la création d'une candidature."""
    row = conn.execute(
        """SELECT people.email, people.first_name, ads.title, companies.name AS company
           FROM applications
           JOIN people ON people.id = applications.person_id
           JOIN ads ON ads.id = applications.ad_id
           JOIN companies ON companies.id = ads.company_id
           WHERE applications.id = ?""",
        (application_id,),
    ).fetchone()
    if row is None:
        sent = False
        return sent
    body = (
        f"Bonjour {row['first_name']},\n\n"
        f"Nous avons bien reçu votre candidature pour l'annonce « {row['title']} ».\n\n"
        f"Nous vous mettons en contact avec {row['company']}. Vous pouvez suivre l'état de votre candidature via votre espace personnel.\n\n"
        "L'équipe de recrutement vous remercie pour votre intérêt !\n\n"
        "Cordialement,\nL'équipe Y.I.A Jobs"
    )
    sent = send_email(row["email"], f"Candidature reçue : {row['title']}", body)

    # Envoi réussi : on note quand l'accusé de réception est parti
    if sent:
        conn.execute(
            "UPDATE applications SET receipt_email_sent_at = datetime('now') WHERE id = ?",
            (application_id,),
        )
        conn.commit()

    return sent

def rejection_text(title, company):
    """Texte du « non retenu », le même à la clôture et au refus d'une seule candidature."""
    return (
        f"Nous vous remercions pour votre candidature à l'annonce « {title} ».\n"
        f"L'équipe de {company} n'a pas donné suite à votre candidature. N'hésitez pas à consulter nos autres offres d'emploi sur le site carrière Y.I.A Jobs."
    )


def notify_closure(conn, ad_id):
    """Après la clôture d'une annonce : un email au candidat retenu, un email à chaque candidat refusé.
    Les candidats déjà prévenus (refus d'une seule candidature, decision_email_sent_at rempli) ne reçoivent rien.
    Renvoie le nombre d'emails envoyés."""
    rows = conn.execute(
        """SELECT people.email, people.first_name, applications.status, ads.title, companies.name AS company, applications.id
           FROM applications
           JOIN people ON people.id = applications.person_id
           JOIN ads ON ads.id = applications.ad_id
           JOIN companies ON companies.id = ads.company_id
           WHERE applications.ad_id = ? AND applications.decision_email_sent_at IS NULL""",
        (ad_id,),
    ).fetchall()
    sent = 0
    for row in rows:
        if row["status"] == "accepted":
            subject = f"Information concernant votre candidature : {row['title']}"
            text = (
                f"C'est avec plaisir que nous vous informons que votre candidature pour l'annonce « {row['title']} » est retenue.\n"
                f"L'équipe de {row['company']} va vous contacter pour la suite."
            )
        elif row["status"] == "rejected":
            subject = f"Information concernant votre candidature : {row['title']}"
            text = rejection_text(row["title"], row["company"])
        else:
            continue
        body = f"Bonjour {row['first_name']},\n\n{text}\n\nCordialement,\nL'équipe Y.I.A Jobs"

        # Envoi réussi : on compte l'email et on note quand la réponse est partie
        if send_email(row["email"], subject, body):
            sent += 1
            conn.execute(
                "UPDATE applications SET decision_email_sent_at = datetime('now') WHERE id = ?",
                (row["id"],),
            )

    # Un seul commit pour toutes les dates de la boucle
    conn.commit()
    return sent


def notify_rejection(conn, application_id):
    """Refus d'une seule candidature, annonce encore ouverte : un email « non retenu » à ce candidat."""
    row = conn.execute(
        """SELECT people.email, people.first_name, ads.title, companies.name AS company
           FROM applications
           JOIN people ON people.id = applications.person_id
           JOIN ads ON ads.id = applications.ad_id
           JOIN companies ON companies.id = ads.company_id
           WHERE applications.id = ?""",
        (application_id,),
    ).fetchone()
    if row is None:
        return False

    body = f"Bonjour {row['first_name']},\n\n{rejection_text(row['title'], row['company'])}\n\nCordialement,\nL'équipe Y.I.A Jobs"
    sent = send_email(row["email"], f"Information concernant votre candidature : {row['title']}", body)

    # Envoi réussi : on note quand la réponse est partie (la clôture ne lui écrira plus)
    if sent:
        conn.execute(
            "UPDATE applications SET decision_email_sent_at = datetime('now') WHERE id = ?",
            (application_id,),
        )
        conn.commit()

    return sent


def send_verification_link(to, first_name, token):
    """Lien de vérification d'une inscription mise en attente.

    Le lien n'est écrit dans le journal du serveur que si l'envoi est désactivé
    (MAIL_ENABLED différent de "1", en développement) : la procédure reste testable
    sans SMTP. Si l'envoi est activé mais échoue, le lien n'est écrit nulle part.
    Il ne sort jamais dans la réponse HTTP.
    """
    base_url = os.environ.get("APP_BASE_URL", "http://localhost:5173")
    link = f"{base_url}/verification?token={token}"

    body = (
        f"Bonjour {first_name},\n\n"
        "Votre adresse est déjà enregistrée sur Y.I.A Jobs, sans compte associé.\n"
        "Pour créer votre compte et retrouver vos candidatures, confirmez votre adresse "
        "en ouvrant ce lien :\n\n"
        f"{link}\n\n"
        "Ce lien est valable 24 heures et ne fonctionne qu'une fois. "
        "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : "
        "votre compte reste inaccessible.\n\n"
        "Cordialement,\nL'équipe Y.I.A Jobs"
    )

    sent = send_email(to, "Confirmez votre adresse — Y.I.A Jobs", body)

    if not sent and os.environ.get("MAIL_ENABLED") != "1":
        print(f"[vérification] lien pour {to} : {link}")

    return sent


def send_email_change_link(to, first_name, token):
    """Lien de confirmation d'un changement d'adresse, envoyé à la NOUVELLE adresse.

    Mêmes règles que send_verification_link : le lien n'est écrit dans le journal du
    serveur que si l'envoi est désactivé, et il ne sort jamais dans la réponse HTTP.
    """
    base_url = os.environ.get("APP_BASE_URL", "http://localhost:5173")
    link = f"{base_url}/confirmation-email?token={token}"

    body = (
        f"Bonjour {first_name},\n\n"
        "Une demande de changement d'adresse e-mail a été faite pour votre compte Y.I.A Jobs.\n"
        "Pour confirmer cette nouvelle adresse, ouvrez ce lien :\n\n"
        f"{link}\n\n"
        "Ce lien est valable 24 heures et ne fonctionne qu'une fois. "
        "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : "
        "votre adresse actuelle reste inchangée.\n\n"
        "Cordialement,\nL'équipe Y.I.A Jobs"
    )

    sent = send_email(to, "Confirmez votre nouvelle adresse — Y.I.A Jobs", body)

    if not sent and os.environ.get("MAIL_ENABLED") != "1":
        print(f"[changement d'adresse] lien pour {to} : {link}")

    return sent
