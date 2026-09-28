/*
 * Interactions de la page : ce module expose ses fonctions d'initialisation.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
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
 */
function checkField(field, messages) {
    if (field.validity.valueMissing) showFieldError(field, messages.required);
    else if (field.validity.typeMismatch) showFieldError(field, messages.email);
    else clearFieldError(field);
}
/*
 * Envoie le formulaire sans quitter la page et affiche l'état sous le bouton.
 * Sans JavaScript, l'attribut action du formulaire garde l'envoi classique vers Formspree.
 */
export function initContactForm(messages) {
    const form = document.querySelector(".contact-form");
    const submit = document.querySelector(".contact-form__submit");
    const status = document.querySelector(".contact-form__status");
    if (!form || !submit || !status) return;
    /*
     * matches vérifie qu'un élément correspond au sélecteur : seuls les champs du formulaire sont testés.
     */
    const isField = element => element.matches("input, textarea");
    /*
     * Vérifie un champ quand le visiteur le quitte, pas pendant sa première saisie.
     */
    form.addEventListener("focusout", event => {
        if (isField(event.target)) checkField(event.target, messages);
    });
    /*
     * Un champ déjà signalé est revérifié à chaque frappe : l'erreur disparaît dès la correction.
     */
    form.addEventListener("input", event => {
        if (event.target.getAttribute("aria-invalid") === "true") checkField(event.target, messages);
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
        submit.disabled = true;
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
            showStatus("success");
        } catch {
            showStatus("error");
        } finally {
            submit.disabled = false;
        }
    });
}
