/*
 * Interactions de la page : ce module expose ses fonctions d'initialisation.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
import { createHumanCheck } from "./human-check.js";
/*
 * Affiche le message d'erreur sous un champ, en créant le paragraphe une seule fois.
 * aria-invalid signale l'erreur ; aria-describedby fait lire le message avec le champ.
 */
function showFieldError(field, message) {
    const errorId = field.id + "-error";
    let error = document.getElementById(errorId);
    if (!error) {
        error = document.createElement("p");
        error.id = errorId;
        error.className = "contact-form__error";
        field.after(error);
        field.setAttribute("aria-describedby", errorId);
    }
    error.textContent = message;
    field.setAttribute("aria-invalid", "true");
    field.classList.remove("contact-form__control--valid");
}
/*
 * Retire le message et les attributs d'erreur d'un champ corrigé.
 */
function clearFieldError(field) {
    document.getElementById(field.id + "-error")?.remove();
    field.removeAttribute("aria-invalid");
    field.removeAttribute("aria-describedby");
}
/*
 * validity est fourni par le navigateur à partir de required et type="email".
 * Un champ correct et non vide reçoit la coche de validation (contact.css).
 */
function checkField(field, messages) {
    if (field.validity.valueMissing) showFieldError(field, messages.required);
    else if (field.validity.typeMismatch) showFieldError(field, messages.email);
    else {
        clearFieldError(field);
        field.classList.toggle("contact-form__control--valid", field.value.trim() !== "");
    }
}
// ms pendant lesquels le bouton affiche « Envoyé » avant de reprendre son texte
const SENT_DURATION = 2600;
/*
 * Réussite : le bouton affiche « Envoyé » avec une coche qui se dessine (contact.css), puis redevient normal.
 */
function flashSent(button, label) {
    const original = button.textContent;
    button.textContent = label;
    button.classList.add("contact-form__submit--sent");
    setTimeout(() => {
        button.textContent = original;
        button.classList.remove("contact-form__submit--sent");
    }, SENT_DURATION);
}
/*
 * Échec : le bouton secoue une fois. Retirer puis remettre la classe relance l'animation ;
 * lire offsetWidth force le navigateur à prendre en compte le retrait avant l'ajout.
 */
function shakeButton(button) {
    button.classList.remove("contact-form__submit--shake");
    void button.offsetWidth;
    button.classList.add("contact-form__submit--shake");
    button.addEventListener("animationend", () => button.classList.remove("contact-form__submit--shake"), { once: true });
}
/*
 * Envoie le formulaire sans quitter la page et affiche l'état sous le bouton.
 * Sans JavaScript, l'attribut action du formulaire garde l'envoi classique vers Formspree.
 * humanTexts contient les textes de la fenêtre anti-robot (human-check.js).
 */
export function initContactForm(messages, humanTexts) {
    const form = document.querySelector(".contact-form");
    const submit = document.querySelector(".contact-form__submit");
    const status = document.querySelector(".contact-form__status");
    if (!form || !submit || !status) return;
    const humanCheck = createHumanCheck(humanTexts);
    /*
     * matches vérifie qu'un élément correspond au sélecteur : seuls les champs visibles sont testés,
     * pas le champ piège anti-robots.
     */
    const isField = element => element.matches(".contact-form__control");
    /*
     * Premier clic dans un champ : la fenêtre anti-robot s'ouvre tant que le visiteur n'est pas validé.
     */
    form.addEventListener("focusin", event => {
        if (isField(event.target)) humanCheck.askOnFocus(event.target);
    });
    /*
     * Vérifie un champ quand le visiteur le quitte, pas pendant sa première saisie.
     * Pendant l'ouverture de la fenêtre anti-robot, le champ perd le focus sans que le visiteur l'ait quitté :
     * il ne faut pas lui reprocher d'être vide.
     */
    form.addEventListener("focusout", event => {
        if (isField(event.target) && !humanCheck.isOpen()) checkField(event.target, messages);
    });
    /*
     * Un champ déjà vérifié (en erreur ou coché) est revérifié à chaque frappe :
     * l'erreur disparaît dès la correction, la coche dès qu'il redevient incorrect.
     */
    form.addEventListener("input", event => {
        const field = event.target;
        const wasChecked = field.getAttribute("aria-invalid") === "true"
            || field.classList.contains("contact-form__control--valid");
        if (isField(field) && wasChecked) checkField(field, messages);
    });
    /*
     * À l'envoi, le navigateur déclenche "invalid" sur chaque champ incorrect.
     * Cet événement ne remonte pas : true l'écoute pendant sa descente (capture).
     * preventDefault remplace la bulle du navigateur ; le premier champ en erreur reçoit le focus.
     */
    form.addEventListener("invalid", event => {
        event.preventDefault();
        checkField(event.target, messages);
        form.querySelector("[aria-invalid='true']").focus();
    }, true);
    /*
     * state vaut "sending", "success" ou "error" ; il devient un modificateur BEM.
     */
    function showStatus(state) {
        status.textContent = messages[state];
        status.className = "contact-form__status contact-form__status--" + state;
    }
    /*
     * async permet d'utiliser await : la fonction attend la réponse du serveur sans bloquer la page.
     */
    form.addEventListener("submit", async event => {
        /*
         * Empêche le navigateur de quitter la page pour afficher celle de Formspree.
         */
        event.preventDefault();
        /*
         * Visiteur déjà validé : la réponse est immédiate. Sinon la fenêtre obligatoire s'ouvre et l'envoi attend.
         */
        if (!await humanCheck.require()) return;
        submit.disabled = true;
        submit.classList.add("contact-form__submit--loading");
        showStatus("sending");
        /*
         * try essaie l'envoi ; catch traite l'erreur réseau ou serveur ; finally s'exécute dans tous les cas.
         */
        try {
            /*
             * FormData lit tous les champs nommés ; Accept demande à Formspree une réponse JSON au lieu d'une page.
             */
            const response = await fetch(form.action, {
                method: "POST",
                body: new FormData(form),
                headers: { "Accept": "application/json" }
            });
            /*
             * ok est vrai pour un code HTTP de réussite (200 à 299).
             */
            if (!response.ok) throw new Error("Réponse " + response.status);
            form.reset();
            form.querySelectorAll(".contact-form__control--valid").forEach(field => {
                field.classList.remove("contact-form__control--valid");
            });
            showStatus("success");
            flashSent(submit, messages.sent);
        } catch {
            showStatus("error");
            shakeButton(submit);
        } finally {
            submit.disabled = false;
            submit.classList.remove("contact-form__submit--loading");
        }
    });
}
