/*
 * Crée la surface de dessin et récupère son contexte 2D (ctx).
 * width/height définissent sa résolution interne ; le CSS gère sa taille affichée.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
import { language } from "./translations.js";

const root = document.getElementById("jeu-pendu");
export const canvas = document.createElement("canvas");
canvas.width = 1200;
canvas.height = 800;
/*
 * Rend le canvas accessible au focus clavier.
 */
canvas.tabIndex = 0;
canvas.setAttribute("aria-label", language === "en" ? "Playable Hangman game" : "Jeu du Pendu jouable");

canvas.className = "game-player__canvas";

root.appendChild(canvas);

/*
 * Le contexte 2D fournit les méthodes de dessin : fillRect, arc, fillText, etc.
 */
export const ctx = canvas.getContext("2d");
