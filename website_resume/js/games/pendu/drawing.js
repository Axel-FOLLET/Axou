/*
 * Primitives réutilisables de dessin : textes et formes simples.
 * Les coordonnées sont celles du canvas, pas celles de la fenêtre du navigateur.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
import { canvas, ctx } from "./canvas.js";
import { NOIR } from "./constants.js";

/*
 * Dessine texteAffiche aux coordonnées x et y, en pixels du canvas.
 * Les paramètres par défaut permettent d'omettre taille, couleur et alignement.
 */
export function texte(texteAffiche, x, y, taille = 30, couleur = NOIR, alignement = "left") {
    ctx.font = `${taille}px Avenir, "Avenir Next", sans-serif`;
    ctx.fillStyle = couleur;
    ctx.textAlign = alignement;
    ctx.textBaseline = "top";
    ctx.fillText(texteAffiche, x, y);
}

/*
 * Réutilise texte en plaçant son point d'ancrage au milieu de la largeur du jeu.
 */
export function texteCentre(texteAffiche, y, taille = 30, couleur = NOIR) {
    texte(texteAffiche, canvas.width / 2, y, taille, couleur, "center");
}

/*
 * Dessine un rectangle de dimensions largeur/hauteur, avec le rayon demandé.
 * remplissage et bordure sont indépendants : null permet d'omettre l'un des deux.
 */
export function rectangleArrondi(x, y, largeur, hauteur, rayon, remplissage, bordure = null, epaisseur = 1) {
    ctx.beginPath();
    ctx.roundRect(x, y, largeur, hauteur, rayon);

    if (remplissage) {
        ctx.fillStyle = remplissage;
        ctx.fill();
    }

    if (bordure) {
        ctx.lineWidth = epaisseur;
        ctx.strokeStyle = bordure;
        ctx.stroke();
    }
}

/*
 * Trace un segment entre deux points [x, y], avec la couleur et l'épaisseur demandées.
 */
export function ligne(depart, arrivee, couleur, epaisseur = 5) {
    ctx.beginPath();
    ctx.moveTo(depart[0], depart[1]);
    ctx.lineTo(arrivee[0], arrivee[1]);
    ctx.strokeStyle = couleur;
    ctx.lineWidth = epaisseur;
    ctx.stroke();
}
