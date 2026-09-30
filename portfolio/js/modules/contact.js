/*
 * Formulaire de contact : validation des champs et envoi sans quitter la page.
 * Les textes viennent des attributs data-* du formulaire : un seul script pour FR et EN.
 * Sans JavaScript, le formulaire garde l'envoi classique vers Formspree.
 */

import { requireHuman } from "./human-check.js";


// -------------------- VALIDATION DES CHAMPS --------------------

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
        error.className = "form__error";
        field.after(error);
        field.setAttribute("aria-describedby", errorId);
    }
    error.textContent = message;
    field.setAttribute("aria-invalid", "true");
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
 * Un champ correct et rempli reçoit une coche (form__input--valid).
 */
function checkField(field, form) {
    if (field.validity.valueMissing) showFieldError(field, form.dataset.invalidRequired);
    else if (field.validity.typeMismatch) showFieldError(field, form.dataset.invalidEmail);
    else clearFieldError(field);
    field.classList.toggle("form__input--valid", field.validity.valid && field.value.trim() !== "");
}


/*
 * Vérifie un champ quand le visiteur le quitte, pas pendant sa première saisie.
 * Un champ déjà signalé est revérifié à chaque frappe : l'erreur disparaît dès la correction.
 * À l'envoi, "invalid" est déclenché sur chaque champ incorrect ; cet événement ne remonte pas,
 * true l'écoute donc pendant sa descente (capture). preventDefault remplace la bulle du navigateur.
 */
function watchFields(form) {
    form.addEventListener("focusout", event => {
        if (event.target.classList.contains("form__input")) checkField(event.target, form);
    });
    form.addEventListener("input", event => {
        if (event.target.getAttribute("aria-invalid") === "true") checkField(event.target, form);
    });
    form.addEventListener("invalid", event => {
        event.preventDefault();
        checkField(event.target, form);
        form.querySelector("[aria-invalid='true']").focus();
    }, true);
}


// -------------------- ENVOI --------------------

/*
 * Envoie les champs à Formspree et renvoie true si le serveur a accepté le message.
 * async permet d'attendre la réponse avec await ; une erreur réseau renvoie false.
 */
async function sendForm(form) {
    try {
        const response = await fetch(form.action, {
            method: "POST",
            body: new FormData(form),
            headers: { "Accept": "application/json" }
        });
        return response.ok;
    } catch {
        return false;
    }
}


/*
 * Pendant l'envoi, le bouton est désactivé pour éviter un double envoi et affiche une roue.
 * Le message d'état (role="status") est lu par les lecteurs d'écran ; sa classe choisit
 * l'encadré de confirmation ou d'erreur.
 */
function watchSubmit(form, status, submitButton) {
    form.addEventListener("submit", async event => {
        event.preventDefault();
        // Case « Are you human? » pas encore validée : fenêtre obligatoire, l'envoi part après
        await requireHuman();
        submitButton.disabled = true;
        submitButton.classList.add("button--loading");
        status.className = "form__status";
        status.textContent = form.dataset.sending;
        const isSent = await sendForm(form);
        status.textContent = isSent ? form.dataset.success : form.dataset.error;
        status.classList.add(isSent ? "form__status--success" : "form__status--error");
        if (isSent) {
            form.reset();
            form.querySelectorAll(".form__input--valid").forEach(field => field.classList.remove("form__input--valid"));
        }
        submitButton.classList.remove("button--loading");
        submitButton.disabled = false;
    });
}


/*
 * Le formulaire n'existe que sur la page Contact : ailleurs, la fonction s'arrête.
 */
export function initContact() {
    const form = document.getElementById("contact-form");
    const status = document.getElementById("form-status");
    const submitButton = form?.querySelector("[type='submit']");
    if (!form || !status || !submitButton) return;
    watchFields(form);
    watchSubmit(form, status, submitButton);
}
