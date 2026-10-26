/*
 * Fenêtre « Protection anti-robot » : la case doit être cochée par un humain avant l'envoi du formulaire.
 * Le site est statique : ces contrôles arrêtent les robots simples, pas un vrai navigateur piloté.
 *
 * Même fonctionnement que la fenêtre du portfolio : elle s'ouvre seulement à l'envoi du formulaire, sans croix ni Échap.
 * Une réponse validée est gardée pour l'onglet (sessionStorage) : la question revient quand l'onglet est fermé.
 * Les textes suivent la langue de la page (attribut lang de <html>).
 */


// -------------------- RÉGLAGES --------------------

const STORAGE_KEY = "resume-human-check";
const MIN_DELAY = 800;          // ms minimum entre l'ouverture et le clic : le temps de lire la consigne
const CLOSE_DELAY = 1500;       // ms pendant lesquels « Merci. » reste affiché

const TEXTS = {
    fr: {
        title: "Protection anti-robot",
        text: "Veuillez cocher la case, s'il vous plaît.",
        box: "Je ne suis pas un robot",
        success: "Merci.",
        retry: "Vérification impossible. Réessayez calmement."
    },
    en: {
        title: "Anti-robot protection",
        text: "Please tick the box.",
        box: "I'm not a robot",
        success: "Thank you.",
        retry: "Verification failed. Please try again, slowly."
    }
};


// -------------------- MÉMOIRE DE L'ONGLET --------------------

// Réponse gardée aussi en mémoire : suffit pour la page en cours si le stockage est bloqué
let verifiedOnPage = false;


/*
 * sessionStorage peut être bloqué (navigation privée stricte) : try/catch évite de casser la page.
 */
function isHumanVerified() {
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
        // Stockage indisponible : la question reviendra au prochain chargement
    }
}


// -------------------- CONTRÔLES ANTI-ROBOT --------------------

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


// -------------------- FENÊTRE --------------------

/*
 * Bouclier dessiné en SVG à la place des images du portfolio : la coche s'y trace en réussite (human-check.css).
 * aria-describedby fait lire la consigne avec le titre à l'ouverture.
 */
function createDialog(texts) {
    const dialog = document.createElement("dialog");
    dialog.className = "human-check";
    dialog.setAttribute("aria-labelledby", "human-check-title");
    dialog.setAttribute("aria-describedby", "human-check-text");
    // tabIndex = -1 : la fenêtre peut recevoir le focus (voir openDialog)
    dialog.tabIndex = -1;
    dialog.innerHTML = `
        <svg class="human-check__icon" viewBox="0 0 24 24" width="44" height="44" aria-hidden="true">
            <path class="human-check__shield" d="M12 2.5 4.5 5.6v5.9c0 4.7 3.2 8.2 7.5 10 4.3-1.8 7.5-5.3 7.5-10V5.6z"/>
            <path class="human-check__tick" d="m8.4 12.2 2.5 2.5 4.8-5"/>
        </svg>
        <h2 class="human-check__title" id="human-check-title">${texts.title}</h2>
        <p class="human-check__text" id="human-check-text" aria-live="polite">${texts.text}</p>
        <label class="human-check__box">
            <input class="human-check__input" type="checkbox">
            <span>${texts.box}</span>
        </label>
        <p class="human-check__hint" role="status" aria-live="polite"></p>
    `;
    document.body.append(dialog);
    return dialog;
}


function showSuccess(dialog, texts) {
    dialog.classList.add("human-check--success");
    dialog.querySelector(".human-check__text").textContent = texts.success;
    dialog.querySelector(".human-check__hint").textContent = "";
    dialog.querySelector(".human-check__input").disabled = true;
}


/*
 * Ouvre la fenêtre et renvoie une promesse résolue quand le visiteur est validé.
 * showModal rend le reste de la page inerte (ni clic ni Tab).
 * Échap déclenche "cancel" : preventDefault garde la fenêtre ouverte ;
 * si le navigateur la ferme malgré tout, "close" la rouvre.
 */
function openDialog() {
    const texts = TEXTS[document.documentElement.lang === "en" ? "en" : "fr"];
    return new Promise(resolve => {
        const dialog = createDialog(texts);
        const checkbox = dialog.querySelector(".human-check__input");
        const gestures = watchGestures(dialog);
        let verified = false;

        dialog.addEventListener("cancel", event => event.preventDefault());
        dialog.addEventListener("close", () => {
            if (!verified) dialog.showModal();
        });
        dialog.showModal();
        // showModal place le focus sur la case : on le déplace sur la fenêtre,
        // pas de contour avant le premier Tab
        dialog.focus();
        const openedAt = performance.now();

        checkbox.addEventListener("change", event => {
            if (!checkbox.checked) return;
            if (!looksHuman(event, openedAt, gestures)) {
                checkbox.checked = false;
                dialog.querySelector(".human-check__hint").textContent = texts.retry;
                return;
            }
            verified = true;
            saveVerified();
            showSuccess(dialog, texts);
            setTimeout(() => {
                dialog.close();
                dialog.remove();
                resolve(true);
            }, CLOSE_DELAY);
        });
    });
}


// -------------------- POINT D'ENTRÉE --------------------

/*
 * Formulaire de contact : renvoie true tout de suite si le visiteur est déjà validé,
 * sinon ouvre la fenêtre et attend la validation.
 * Navigateur sans <dialog> : aucune vérification possible, l'envoi reste permis.
 */
export function requireHuman() {
    if (isHumanVerified() || typeof HTMLDialogElement !== "function") return Promise.resolve(true);
    return openDialog();
}
