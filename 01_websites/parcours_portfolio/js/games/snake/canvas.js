/*
 * Creates the drawing surface and gets its 2D context (ctx).
 * width/height set its internal resolution; the CSS handles its displayed size.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
import { language } from "./translations.js";

const root = document.getElementById("snake-game");
export const canvas = document.createElement("canvas");
/*
 * On a high-density screen (devicePixelRatio 2), 600 displayed pixels cover 1,200: the resolution follows,
 * ctx.scale keeps the game coordinates in 600 x 660, and the displayed size stays 600 px at most, proportions kept.
 */
const density = Math.min(Math.ceil(window.devicePixelRatio || 1), 3);
canvas.width = 600 * density;
canvas.height = 660 * density;
canvas.style.width = "min(600px, 100%, calc((100vh - 32px) * 600 / 660))";
/*
 * Makes the canvas reachable with keyboard focus.
 */
canvas.tabIndex = 0;
canvas.setAttribute("aria-label", language === "en" ? "Playable Snake game" : "Jeu du Snake jouable");

canvas.className = "game-player__canvas";

root.appendChild(canvas);

/*
 * The 2D context provides the drawing methods: fillRect, arc, fillText, etc.
 */
export const ctx = canvas.getContext("2d");
ctx.scale(density, density);
