/*
 * Données de traduction : les clés restent les mêmes en français et en anglais.
 * Les fonctions présentes dans les textes insèrent les valeurs variables, comme le score.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
export const translations = {
    "fr": {
        "contact": {
            "sending": "Envoi en cours…",
            "success": "Merci, votre message a bien été envoyé.",
            "sent": "Envoyé",
            "error": "L'envoi a échoué. Vérifiez votre connexion puis réessayez, ou contactez-moi sur LinkedIn.",
            "required": "Ce champ est obligatoire.",
            "email": "Adresse e-mail invalide (exemple : nom@domaine.fr)."
        },
        "humanCheck": {
            "title": "Protection anti-robot",
            "text": "Veuillez cocher la case, s'il vous plaît.",
            "label": "Je ne suis pas un robot",
            "success": "Merci.",
            "failure": "Vérification impossible. Réessayez calmement.",
            "close": "Fermer"
        }
    },
    "en": {
        "contact": {
            "sending": "Sending…",
            "success": "Thank you, your message has been sent.",
            "sent": "Sent",
            "error": "Sending failed. Check your connection and try again, or contact me on LinkedIn.",
            "required": "This field is required.",
            "email": "Invalid email address (example: name@domain.com)."
        },
        "humanCheck": {
            "title": "Anti-robot protection",
            "text": "Please tick the box.",
            "label": "I'm not a robot",
            "success": "Thank you.",
            "failure": "Verification failed. Please try again, slowly.",
            "close": "Close"
        }
    }
};
