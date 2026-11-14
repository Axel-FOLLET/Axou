/*
 * Creates the drawing surface and gets its 2D context (ctx).
 * width/height set its internal resolution; the CSS handles its displayed size.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
import { language } from "./translations.js";

const root = document.getElementById("hangman-root");
export const canvas = document.createElement("canvas");

/*
 * Under 700 px of width, the game switches to portrait (600 x 900): shrunk to the width of a phone,
 * the landscape layout (1200 x 800) would show its 30 px texts at under 10 px.
 * Above that, the original landscape layout is kept as is.
 */
export const portrait = window.matchMedia("(max-width: 699px)");

function resizeCanvas() {
    canvas.width = portrait.matches ? 600 : 1200;
    canvas.height = portrait.matches ? 900 : 800;
}

resizeCanvas();
portrait.addEventListener("change", resizeCanvas);

/*
 * Makes the canvas reachable by keyboard focus.
 * role="application": a screen reader passes the keys to the game (letters, Enter, Escape);
 * what the canvas shows is read from the live region of the page (screens.js, announce).
 */
canvas.tabIndex = 0;
canvas.setAttribute("role", "application");
canvas.setAttribute("aria-label", language === "en" ? "Playable Hangman game" : "Jeu du Pendu jouable");

canvas.className = "game-player__canvas";

root.appendChild(canvas);

/*
 * The 2D context provides the drawing methods: fillRect, arc, fillText, etc.
 */
export const ctx = canvas.getContext("2d");
