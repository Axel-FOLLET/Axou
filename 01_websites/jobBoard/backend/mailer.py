"""Sending of the real Job Board emails (acknowledgement, acceptance, rejection).

The settings come from .env (never from the code):
    MAIL_ENABLED=1                 # 0 or absent: nothing is sent, the message is printed in the terminal
    SMTP_HOST=smtp.gmail.com
    SMTP_PORT=587
    SMTP_USER=address@example.com  # the team's sending account, only in .env
    SMTP_PASSWORD=...              # only in .env
    MAIL_FROM=address@example.com

Important rule: an email that fails must never make the application or the closure fail.
The functions therefore return True or False, and never raise an exception.
"""
import os
import smtplib
from email.message import EmailMessage


def send_email(to, subject, body):
    """Sends a plain-text email. Returns True if it was sent, False otherwise."""
    if os.environ.get("MAIL_ENABLED") != "1":
        print(f"[mail disabled] To: {to} | Subject: {subject}")
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
    except Exception as err:  # network, credentials, missing setting: log it and carry on
        print(f"[mail not sent] To: {to} | {type(err).__name__}: {err}")
        return False


def notify_application_received(conn, application_id):
    """Acknowledgement of receipt, right after an application is created."""
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

    # Sent successfully: record when the acknowledgement went out
    if sent:
        conn.execute(
            "UPDATE applications SET receipt_email_sent_at = datetime('now') WHERE id = ?",
            (application_id,),
        )
        conn.commit()

    return sent

def rejection_text(title, company):
    """Text of the "not selected" message, the same at closure and when a single application is rejected."""
    return (
        f"Nous vous remercions pour votre candidature à l'annonce « {title} ».\n"
        f"L'équipe de {company} n'a pas donné suite à votre candidature. N'hésitez pas à consulter nos autres offres d'emploi sur le site carrière Y.I.A Jobs."
    )


def notify_closure(conn, ad_id):
    """After an ad is closed: one email to the accepted candidate, one email to each rejected candidate.
    Candidates already notified (single-application rejection, decision_email_sent_at filled in) receive nothing.
    Returns the number of emails sent."""
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

        # Sent successfully: count the email and record when the answer went out
        if send_email(row["email"], subject, body):
            sent += 1
            conn.execute(
                "UPDATE applications SET decision_email_sent_at = datetime('now') WHERE id = ?",
                (row["id"],),
            )

    # A single commit for all the dates set in the loop
    conn.commit()
    return sent


def notify_rejection(conn, application_id):
    """Rejection of a single application, ad still open: a "not selected" email to this candidate."""
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

    # Sent successfully: record when the answer went out (the closure will not write to them again)
    if sent:
        conn.execute(
            "UPDATE applications SET decision_email_sent_at = datetime('now') WHERE id = ?",
            (application_id,),
        )
        conn.commit()

    return sent


def send_verification_link(to, first_name, token):
    """Verification link for a pending registration.

    The link is written to the server log only if sending is disabled
    (MAIL_ENABLED different from "1", in development): the procedure stays testable
    without SMTP. If sending is enabled but fails, the link is written nowhere.
    It never appears in the HTTP response.
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
        print(f"[verification] link for {to}: {link}")

    return sent


def send_email_change_link(to, first_name, token):
    """Confirmation link for an address change, sent to the NEW address.

    Same rules as send_verification_link: the link is written to the server log
    only if sending is disabled, and it never appears in the HTTP response.
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
        print(f"[email change] link for {to}: {link}")

    return sent
