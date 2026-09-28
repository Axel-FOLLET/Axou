// -------------------- VALIDATION DES CHAMPS --------------------

/*
    Affiche le message d'erreur sous un champ.
    aria-invalid signale l'erreur aux lecteurs d'écran ;
    aria-describedby leur fait lire le message avec le champ.
*/
function showFieldError(field, message) {

    const errorId = field.id + "-error";
    let error = document.getElementById(errorId);

    // Le paragraphe n'est créé qu'une fois, puis son texte est mis à jour.
    if (!error) {
        error = document.createElement("p");
        error.id = errorId;
        error.classList.add("form__error");
        field.after(error);
        field.setAttribute("aria-describedby", errorId);
    }

    error.textContent = message;
    field.setAttribute("aria-invalid", "true");

}


// Retire le message et les attributs d'erreur d'un champ corrigé.
function clearFieldError(field) {

    document.getElementById(field.id + "-error")?.remove();
    field.removeAttribute("aria-invalid");
    field.removeAttribute("aria-describedby");

}


/*
    validity est fourni par le navigateur à partir de required et type="email".
    Les textes viennent du HTML (data-invalid-...) : un seul script pour FR et EN.
*/
function checkField(field, form) {

    if (field.validity.valueMissing) {
        showFieldError(field, form.dataset.invalidRequired);
    } else if (field.validity.typeMismatch) {
        showFieldError(field, form.dataset.invalidEmail);
    } else {
        clearFieldError(field);
    }

}


export function initContact() {
// -------------------- FORMULAIRE DE CONTACT --------------------

// Le formulaire n'existe que sur la page Contact.
const contactForm = document.getElementById("contact-form");

if (contactForm) {

    const formStatus = document.getElementById("form-status");
    const submitButton = contactForm.querySelector("[type=\"submit\"]");

    // Vérifie un champ quand le visiteur le quitte, pas pendant sa première saisie.
    contactForm.addEventListener("focusout", function(event) {

        if (event.target.classList.contains("form__input")) {
            checkField(event.target, contactForm);
        }

    });

    // Un champ déjà signalé est revérifié à chaque frappe : l'erreur disparaît dès la correction.
    contactForm.addEventListener("input", function(event) {

        if (event.target.getAttribute("aria-invalid") === "true") {
            checkField(event.target, contactForm);
        }

    });

    /*
        À l'envoi, le navigateur déclenche "invalid" sur chaque champ incorrect.
        L'événement ne remonte pas : true l'écoute pendant sa descente (capture).
        preventDefault remplace la bulle du navigateur par nos messages,
        puis le premier champ en erreur reçoit le focus.
    */
    contactForm.addEventListener("invalid", function(event) {

        event.preventDefault();
        checkField(event.target, contactForm);
        contactForm.querySelector("[aria-invalid=\"true\"]").focus();

    }, true);

    contactForm.addEventListener("submit", function(event) {

        /*
            On empêche l'envoi classique pour rester sur la page
            et afficher un message. Sans JavaScript,
            le formulaire fonctionne quand même (envoi normal).
        */
        event.preventDefault();

        // Bouton désactivé pendant l'envoi : évite un double envoi.
        submitButton.disabled = true;

        // Les messages sont écrits dans le HTML (data-success / data-error).
        formStatus.textContent = contactForm.dataset.sending;

        fetch(contactForm.action, {
            method: "POST",
            body: new FormData(contactForm),
            headers: { "Accept": "application/json" }
        })
            .then(function(response) {

                if (response.ok) {

                    formStatus.textContent = contactForm.dataset.success;
                    contactForm.reset();

                } else {

                    formStatus.textContent = contactForm.dataset.error;

                }

            })
            .catch(function() {

                // Erreur réseau : le visiteur est prévenu.
                formStatus.textContent = contactForm.dataset.error;

            })
            .finally(function() {

                // Réussite ou erreur : le bouton redevient utilisable.
                submitButton.disabled = false;

            });

    });

}



}
