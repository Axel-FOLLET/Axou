export function initContact() {
// -------------------- FORMULAIRE DE CONTACT --------------------

// Le formulaire n'existe que sur la page Contact.
const contactForm = document.getElementById("contact-form");

if (contactForm) {

    const formStatus = document.getElementById("form-status");

    contactForm.addEventListener("submit", function(event) {

        /*
            On empêche l'envoi classique pour rester sur la page
            et afficher un message. Sans JavaScript,
            le formulaire fonctionne quand même (envoi normal).
        */
        event.preventDefault();

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

            });

    });

}



}
