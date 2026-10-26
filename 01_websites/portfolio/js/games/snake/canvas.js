/*
 * Crée la surface de dessin et récupère son contexte 2D (ctx).
 * width/height définissent sa résolution interne ; le CSS gère sa taille affichée.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
import { language } from "./translations.js";

const root = document.getElementById("jeu-snake");
export const canvas = document.createElement("canvas");
canvas.width = 600;
canvas.height = 660;
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
