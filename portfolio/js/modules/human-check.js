/*
 * Fenêtre « Are you human? » : la case doit être cochée par un humain.
 * Le site est statique : ces contrôles arrêtent les robots simples, pas un vrai navigateur piloté.
 *
 * - À l'arrivée sur le site : fenêtre bloquante, mais la croix ou Échap la ferment.
 * - À l'envoi du formulaire sans validation : fenêtre obligatoire, sans croix ni Échap.
 * La réponse (validée ou fermée) est gardée pour l'onglet (sessionStorage) : on navigue
 * librement entre les pages, la question revient quand l'onglet est fermé.
 */


// -------------------- RÉGLAGES --------------------

const STORAGE_KEY = "portfolio-human-check";
const MIN_DELAY = 800;          // ms minimum entre l'ouverture et le clic
const CLOSE_DELAY = 1500;       // ms pendant lesquels « Hi human! » reste affiché

// Chemins calculés depuis ce fichier : valables à la racine comme dans pages/
const IMAGES = {
    loving: new URL("../../assets/images/human-check/loving.jpg", import.meta.url).href,
    suspicious: [1, 2, 3].map(number =>
        new URL(`../../assets/images/human-check/suspicious-${number}.jpg`, import.meta.url).href
    )
};


// -------------------- MÉMOIRE DE L'ONGLET --------------------

// Réponse gardée aussi en mémoire : suffit pour la page en cours si le stockage est bloqué
let answerOnPage = null;


/*
 * sessionStorage peut être bloqué (navigation privée stricte) : try/catch évite de casser la page.
 * Valeurs possibles : "yes" (humain validé), "dismissed" (fenêtre fermée), null (jamais vue).
 */
function readAnswer() {
    if (answerOnPage) return answerOnPage;
    try {
        return sessionStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
}


function saveAnswer(answer) {
    answerOnPage = answer;
    try {
        sessionStorage.setItem(STORAGE_KEY, answer);
    } catch {
        // Stockage indisponible : la question reviendra à la page suivante
    }
}


export function isHumanVerified() {
    return readAnswer() === "yes";
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

function pickSuspiciousImage() {
    const index = Math.floor(Math.random() * IMAGES.suspicious.length);
    return IMAGES.suspicious[index];
}


/*
 * alt="" : l'image est décorative, le titre suffit à comprendre la fenêtre.
 * La croix n'existe que si la fenêtre peut être fermée.
 */
function createDialog(canClose) {
    const dialog = document.createElement("dialog");
    dialog.className = "human-check";
    dialog.setAttribute("aria-labelledby", "human-check-title");
    // tabIndex = -1 : la fenêtre peut recevoir le focus (voir openDialog)
    dialog.tabIndex = -1;
    const closeButton = canClose
        ? `<button class="human-check__close" type="button" aria-label="Close">×</button>`
        : "";
    dialog.innerHTML = `
        ${closeButton}
        <img class="human-check__image" src="${pickSuspiciousImage()}" alt="" width="240" height="240">
        <p class="human-check__title" id="human-check-title">Are you human?</p>
        <label class="human-check__box">
            <input class="human-check__input" type="checkbox">
            <span>I'm human</span>
        </label>
        <p class="human-check__hint" role="status" aria-live="polite"></p>
    `;
    document.body.append(dialog);
    return dialog;
}


function showSuccess(dialog) {
    dialog.classList.add("human-check--success");
    dialog.querySelector(".human-check__close")?.remove();
    dialog.querySelector(".human-check__image").src = IMAGES.loving;
    dialog.querySelector(".human-check__title").textContent = "Hi human!";
    dialog.querySelector(".human-check__hint").textContent = "";
    dialog.querySelector(".human-check__input").disabled = true;
}


function showFailure(dialog, checkbox) {
    checkbox.checked = false;
    dialog.querySelector(".human-check__hint").textContent = "Hmm… try again, slowly.";
}


/*
 * Échap déclenche "cancel". Fenêtre obligatoire (ou « Hi human! » affiché) : preventDefault
 * la garde ouverte ; si le navigateur la ferme malgré tout, "close" la rouvre.
 * Fenêtre facultative : la croix ou Échap la ferment, et la réponse "dismissed" est gardée.
 */
function watchClosing(dialog, canClose, state, resolve) {
    dialog.addEventListener("cancel", event => {
        if (!canClose || state.verified) event.preventDefault();
    });
    dialog.querySelector(".human-check__close")?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => {
        if (state.verified) return;
        if (!canClose) {
            dialog.showModal();
            return;
        }
        saveAnswer("dismissed");
        dialog.remove();
        resolve(false);
    });
}


/*
 * Ouvre la fenêtre et renvoie une promesse : true quand le visiteur est validé,
 * false s'il a fermé la fenêtre facultative.
 * showModal rend le reste de la page inerte (ni clic ni Tab).
 */
function openDialog(canClose) {
    return new Promise(resolve => {
        const dialog = createDialog(canClose);
        const checkbox = dialog.querySelector(".human-check__input");
        const state = { verified: false };
        const gestures = watchGestures(dialog);

        watchClosing(dialog, canClose, state, resolve);
        dialog.showModal();
        // showModal place le focus sur le premier bouton : on le déplace sur la fenêtre,
        // pas de contour avant le premier Tab
        dialog.focus();
        const openedAt = performance.now();

        checkbox.addEventListener("change", event => {
            if (!checkbox.checked) return;
            if (!looksHuman(event, openedAt, gestures)) {
                showFailure(dialog, checkbox);
                return;
            }
            state.verified = true;
            saveAnswer("yes");
            showSuccess(dialog);
            setTimeout(() => {
                dialog.close();
                dialog.remove();
                resolve(true);
            }, CLOSE_DELAY);
        });
    });
}


// -------------------- POINTS D'ENTRÉE --------------------

/*
 * Arrivée sur le site : fenêtre facultative, seulement si la question n'a jamais été vue dans l'onglet.
 */
export function initHumanCheck() {
    if (readAnswer() || typeof HTMLDialogElement !== "function") return;
    openDialog(true);
}


/*
 * Formulaire de contact : renvoie true tout de suite si le visiteur est déjà validé,
 * sinon ouvre la fenêtre obligatoire et attend la validation.
 * Navigateur sans <dialog> : aucune vérification possible, l'envoi reste permis.
 */
export function requireHuman() {
    if (isHumanVerified() || typeof HTMLDialogElement !== "function") return Promise.resolve(true);
    return openDialog(false);
}
