/*
 * "Are you human?" window: a human must tick the box before the form is sent.
 * The site is static: these checks stop simple robots, not a real remote-controlled browser.
 *
 * The window opens only when the form is submitted, with no cross and no Escape.
 * A validated answer is kept for the tab (sessionStorage): the question comes back once the tab is closed.
 * The texts follow the language of the page (lang attribute of <html>).
 */
import { catFacets, placeFacets } from "./cat.js";


// -------------------- SETTINGS --------------------

const STORAGE_KEY = "portfolio-human-check";
const MIN_DELAY = 800;          // minimum ms between opening and click
const CLOSE_DELAY = 1500;       // ms during which "Hi human!" stays displayed
const TURN_DURATION = 450;      // ms for the cat to turn toward the visitor

const SVG = "http://www.w3.org/2000/svg";
const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)");

// Suspicious three-quarter poses of the cat: [rotateX, rotateY] in degrees, one picked at random
const SUSPICIOUS_POSES = [[-8, 38], [-8, -38], [10, 28]];

// The title "Are you human?" stays in English: it is a nod to cat memes
const TEXTS = {
    fr: { title: "Are you human?", box: "Je ne suis pas un robot", success: "Hi human!", retry: "Hmm… réessayez, doucement." },
    en: { title: "Are you human?", box: "I'm human", success: "Hi human!", retry: "Hmm… try again, slowly." }
};


// -------------------- TAB MEMORY --------------------

// Answer also kept in memory: enough for the current page if storage is blocked
let verifiedOnPage = false;


/*
 * sessionStorage can be blocked (strict private browsing): try/catch keeps the page from breaking.
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
        // Storage unavailable: the question will come back on the next load
    }
}


// -------------------- ANTI-ROBOT CHECKS --------------------

/*
 * Counts real gestures (mouse, finger, keyboard) while the window is open.
 * isTrusted is false for an event made by a script.
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
 * A human: real click, after a short delay, with at least one gesture before it,
 * and a browser that does not declare itself automated (navigator.webdriver).
 */
function looksHuman(event, openedAt, gestures) {
    return event.isTrusted
        && performance.now() - openedAt >= MIN_DELAY
        && gestures.count > 0
        && navigator.webdriver !== true;
}


// -------------------- WINDOW --------------------

/*
 * Draws the faceted cat of cat.js and returns a function that places it according to two angles.
 * aria-hidden: the cat is decorative, the title is enough to understand the window.
 */
function createCat() {
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("class", "human-check__cat");
    svg.setAttribute("viewBox", "0 0 400 534");
    svg.setAttribute("aria-hidden", "true");
    const facets = catFacets();
    const shapes = new Map(facets.map(item => [item, document.createElementNS(SVG, "polygon")]));

    function pose(rx, ry) {
        for (const { item, points, light, away } of placeFacets(facets, rx, ry)) {
            const shape = shapes.get(item);
            shape.classList.toggle("human-check__away", away);
            shape.setAttribute("points", points.map(point => point.map(value => value.toFixed(1)).join(",")).join(" "));
            shape.style.setProperty("--light", light.toFixed(2));
            svg.append(shape);
        }
    }
    return { svg, pose };
}


/*
 * The cat turns from its suspicious pose toward the visitor (slowing down at the end of the gesture); at once with reduced motion.
 */
function turnToVisitor(cat, [rx, ry]) {
    if (REDUCED_MOTION.matches) {
        cat.pose(0, 0);
        return;
    }
    const start = performance.now();
    function frame(now) {
        const progress = Math.min((now - start) / TURN_DURATION, 1);
        const keep = (1 - progress) ** 3;
        cat.pose(rx * keep, ry * keep);
        if (progress < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}


function createDialog(texts) {
    const dialog = document.createElement("dialog");
    dialog.className = "human-check";
    dialog.setAttribute("aria-labelledby", "human-check-title");
    // tabIndex = -1: the window can receive focus (see openDialog)
    dialog.tabIndex = -1;
    dialog.innerHTML = `
        <p class="human-check__title" id="human-check-title" lang="en">${texts.title}</p>
        <label class="human-check__box">
            <input class="human-check__input" type="checkbox">
            <span>${texts.box}</span>
        </label>
        <p class="human-check__hint" role="status" aria-live="polite"></p>
    `;
    const cat = createCat();
    cat.suspicion = SUSPICIOUS_POSES[Math.floor(Math.random() * SUSPICIOUS_POSES.length)];
    cat.pose(...cat.suspicion);
    dialog.prepend(cat.svg);
    dialog.cat = cat;
    document.body.append(dialog);
    return dialog;
}


function showSuccess(dialog, texts) {
    dialog.classList.add("human-check--success");
    turnToVisitor(dialog.cat, dialog.cat.suspicion);
    dialog.querySelector(".human-check__title").textContent = texts.success;
    dialog.querySelector(".human-check__hint").textContent = "";
    dialog.querySelector(".human-check__input").disabled = true;
}


/*
 * Opens the window and returns a promise resolved once the visitor is validated.
 * showModal makes the rest of the page inert (no click, no Tab).
 * Escape fires "cancel": preventDefault keeps the window open;
 * if the browser closes it anyway, "close" reopens it.
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
        // showModal puts the focus on the checkbox: it is moved to the window,
        // so there is no outline before the first Tab
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


// -------------------- ENTRY POINT --------------------

/*
 * Contact form: returns true at once if the visitor is already validated,
 * otherwise opens the window and waits for the validation.
 * Browser without <dialog>: no check is possible, sending stays allowed.
 */
export function requireHuman() {
    if (isHumanVerified() || typeof HTMLDialogElement !== "function") return Promise.resolve(true);
    return openDialog();
}
