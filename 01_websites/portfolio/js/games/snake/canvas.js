/*
 * Crée la surface de dessin et récupère son contexte 2D (ctx).
 * width/height définissent sa résolution interne ; le CSS gère sa taille affichée.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
import { language } from "./translations.js";

const root = document.getElementById("jeu-snake");
export const canvas = document.createElement("canvas");
/*
 * Sur un écran haute densité (devicePixelRatio 2), 600 pixels affichés en couvrent 1 200 : la résolution suit,
 * ctx.scale garde les coordonnées du jeu en 600 × 660, et la taille affichée reste 600 px au plus, proportions gardées.
 */
const densite = Math.min(Math.ceil(window.devicePixelRatio || 1), 3);
canvas.width = 600 * densite;
canvas.height = 660 * densite;
canvas.style.width = "min(600px, 100%, calc((100vh - 32px) * 600 / 660))";
/*
 * Rend le canvas accessible au focus clavier.
 */
canvas.tabIndex = 0;
canvas.setAttribute("aria-label", language === "en" ? "Playable Snake game" : "Jeu du Snake jouable");

canvas.className = "game-player__canvas";

root.appendChild(canvas);

/*
 * Le contexte 2D fournit les méthodes de dessin : fillRect, arc, fillText, etc.
 */
export const ctx = canvas.getContext("2d");
ctx.scale(densite, densite);
