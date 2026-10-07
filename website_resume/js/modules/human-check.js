/*
 * Interactions de la page : ce module expose ses fonctions d'initialisation.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
/*
 * Fenêtre « Protection anti-robot » du formulaire de contact : la case doit être cochée par un humain.
 * Le site est statique : ces contrôles arrêtent les robots simples, pas un vrai navigateur piloté.
 *
 * - Au premier clic dans un champ : fenêtre bloquante, que la croix ou Échap peuvent fermer.
 * - À l'envoi sans validation : fenêtre obligatoire, sans croix ni Échap.
 * La validation est gardée pour l'onglet (sessionStorage) : la fenêtre ne revient plus à l'envoi suivant.
 */
const STORAGE_KEY = "resume-human-check";
// ms minimum entre l'ouverture et le clic : le temps de lire la consigne
const MIN_DELAY = 800;
// ms pendant lesquels la vérification tourne avant le « Merci »
const CHECK_DURATION = 900;
// ms pendant lesquels le « Merci » reste affiché
const CLOSE_DELAY = 1200;
// ms après une fermeture pendant lesquels le retour du focus ne rouvre pas la fenêtre
const REOPEN_GUARD = 500;
/*
 * Réponse gardée aussi en mémoire : suffit pour la page en cours si le stockage est bloqué.
 */
let verifiedOnPage = false;
/*
 * sessionStorage peut être bloqué (navigation privée stricte) : try/catch évite de casser la page.
 */
function readVerified() {
    if (verifiedOnPage) return true;
    try {
        return sessionStorage.getItem(STORAGE_KEY) === "yes";
    } catch {
        return false;
    }
}
function saveVerified() {
    verifiedOnPage = true;
    try {
        sessionStorage.setItem(STORAGE_KEY, "yes");
    } catch {
        // Stockage indisponible : la fenêtre reviendra après un rechargement
    }
}
/*
 * Compte les gestes réels (souris, doigt, clavier) pendant que la fenêtre est ouverte.
 * isTrusted vaut false pour un événement fabriqué par un script.
 */
function watchGestures(dialog) {
    const gestures = { count: 0 };
    const count = event => {
        if (event.isTrusted) gestures.count++;
    };
    ["pointermove", "pointerdown", "touchstart", "keydown"].forEach(type =>
        dialog.addEventListener(type, count, { passive: true })
    );
    return gestures;
}
/*
 * Un humain : clic réel, après un court délai, avec au moins un geste avant,
 * et un navigateur qui ne se déclare pas automatisé (navigator.webdriver).
 */
function looksHuman(event, openedAt, gestures) {
    return event.isTrusted
        && performance.now() - openedAt >= MIN_DELAY
        && gestures.count > 0
        && navigator.webdriver !== true;
}
/*
 * Construit la fenêtre. Les textes viennent de translations.js (français ou anglais).
 * La croix n'existe que si la fenêtre peut être fermée.
 */
function createDialog(texts, canClose) {
    const dialog = document.createElement("dialog");
    dialog.className = "human-check";
    dialog.setAttribute("aria-labelledby", "human-check-title");
    dialog.setAttribute("aria-describedby", "human-check-text");
    const closeButton = canClose
        ? `<button class="human-check__close" type="button" aria-label="${texts.close}">×</button>`
        : "";
    dialog.innerHTML = `
        ${closeButton}
        <svg class="human-check__icon" viewBox="0 0 24 24" width="44" height="44" aria-hidden="true">
            <path class="human-check__shield" d="M12 2.5 4.5 5.6v5.9c0 4.7 3.2 8.2 7.5 10 4.3-1.8 7.5-5.3 7.5-10V5.6z"/>
            <path class="human-check__tick" d="m8.4 12.2 2.5 2.5 4.8-5"/>
        </svg>
        <h2 class="human-check__title" id="human-check-title">${texts.title}</h2>
        <p class="human-check__text" id="human-check-text" aria-live="polite">${texts.text}</p>
        <label class="human-check__box">
            <input class="human-check__input" type="checkbox">
            <span>${texts.label}</span>
        </label>
        <p class="human-check__hint" role="status" aria-live="polite"></p>
    `;
    document.body.append(dialog);
    return dialog;
}
/*
 * Vérification en cours (anneau qui tourne), puis « Merci » et fermeture.
 */
function showVerified(dialog, texts, done) {
    dialog.classList.add("human-check--checking");
    dialog.querySelector(".human-check__input").disabled = true;
    dialog.querySelector(".human-check__close")?.remove();
    setTimeout(() => {
        dialog.classList.replace("human-check--checking", "human-check--success");
        dialog.querySelector(".human-check__text").textContent = texts.success;
        setTimeout(done, CLOSE_DELAY);
    }, CHECK_DURATION);
}
/*
 * Ouvre la fenêtre et renvoie une promesse : true quand le visiteur est validé,
 * false s'il a fermé la fenêtre facultative.
 * showModal rend le reste de la page inerte (ni clic ni Tab).
 * returnTo reçoit le focus à la fermeture : le visiteur reprend là où il s'était arrêté.
 */
function openDialog(texts, canClose, returnTo, onClosed) {
    return new Promise(resolve => {
        const dialog = createDialog(texts, canClose);
        const checkbox = dialog.querySelector(".human-check__input");
        const gestures = watchGestures(dialog);
        let verified = false;
        const finish = result => {
            dialog.remove();
            onClosed();
            returnTo?.focus();
            resolve(result);
        };
        /*
         * Échap déclenche "cancel". Fenêtre obligatoire, ou « Merci » affiché : preventDefault la garde ouverte.
         * Si le navigateur la ferme malgré tout, "close" la rouvre.
         */
        dialog.addEventListener("cancel", event => {
            if (!canClose || verified) event.preventDefault();
        });
        dialog.querySelector(".human-check__close")?.addEventListener("click", () => dialog.close());
        dialog.addEventListener("close", () => {
            if (verified) return;
            if (!canClose) {
                dialog.showModal();
                return;
            }
            finish(false);
        });
        dialog.showModal();
        checkbox.focus();
        const openedAt = performance.now();
        checkbox.addEventListener("change", event => {
            if (!checkbox.checked) return;
            if (!looksHuman(event, openedAt, gestures)) {
                checkbox.checked = false;
                dialog.querySelector(".human-check__hint").textContent = texts.failure;
                return;
            }
            verified = true;
            saveVerified();
            showVerified(dialog, texts, () => {
                dialog.close();
                finish(true);
            });
        });
    });
}
/*
 * Point d'entrée du formulaire : renvoie les trois actions dont contact-form.js a besoin.
 * Navigateur sans <dialog> : aucune vérification possible, l'envoi reste permis.
 */
export function createHumanCheck(texts) {
    const supported = typeof HTMLDialogElement === "function";
    let isOpen = false;
    let closedAt = -Infinity;
    const run = (canClose, returnTo) => {
        isOpen = true;
        return openDialog(texts, canClose, returnTo, () => {
            isOpen = false;
            closedAt = performance.now();
        });
    };
    return {
        // Vrai tant que la fenêtre est ouverte : le formulaire ne vérifie pas ses champs pendant ce temps
        isOpen: () => isOpen,
        /*
         * Premier clic dans un champ : fenêtre facultative, seulement si le visiteur n'est pas encore validé.
         * Le garde-fou évite que le retour du focus sur le champ rouvre aussitôt la fenêtre.
         */
        askOnFocus(field) {
            if (!supported || isOpen || readVerified()) return;
            if (performance.now() - closedAt < REOPEN_GUARD) return;
            run(true, field);
        },
        /*
         * Envoi du formulaire : renvoie true tout de suite si le visiteur est validé,
         * sinon ouvre la fenêtre obligatoire et attend la validation.
         */
        require() {
            if (!supported || readVerified()) return Promise.resolve(true);
            return run(false, null);
        }
    };
}
