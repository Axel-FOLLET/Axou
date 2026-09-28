/*
 * Dessins propres au jeu, construits avec les primitives du canvas.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
import { ctx } from "./canvas.js";
import { FOND_CLAIR, MARRON, MAX_PENALITES, NOIR, ORANGE, ROUGE, VERT } from "./constants.js";
import { ligne, rectangleArrondi } from "./drawing.js";
import { state } from "./state.js";

/*
 * Dessine les segments dont le seuil de pénalité est atteint.
 * Chaque entrée contient [seuil, point de départ, point d'arrivée].
 */
export function dessinerPotence() {
    const segments = [
        [1, [150, 500], [250, 500]],
        [2, [250, 500], [350, 500]],
        [3, [200, 500], [200, 100]],
        [4, [200, 100], [300, 100]],
        [5, [200, 130], [240, 100]],
        [6, [300, 100], [300, 150]]
    ];

    segments.forEach(([seuil, depart, arrivee]) => {
        if (state.penalite >= seuil) {
            ligne(depart, arrivee, MARRON, 5);
        }
    });
}

/*
 * Ajoute progressivement la tête puis les membres à partir de sept pénalités.
 */
export function dessinerHomme() {
    if (state.penalite >= 7) {
        ctx.beginPath();
        ctx.arc(300, 200, 50, 0, Math.PI * 2);
        ctx.strokeStyle = ROUGE;
        ctx.lineWidth = 5;
        ctx.stroke();
    }

    const segments = [
        [8, [300, 250], [300, 400]],
        [9, [300, 260], [250, 310]],
        [10, [300, 260], [350, 310]],
        [11, [300, 400], [250, 450]],
        [12, [300, 400], [350, 450]]
    ];

    segments.forEach(([seuil, depart, arrivee]) => {
        if (state.penalite >= seuil) {
            ligne(depart, arrivee, ROUGE, 5);
        }
    });
}

/*
 * Dessine le petit logo de l'accueil à partir d'un centre horizontal et d'une hauteur.
 */
export function dessinerLogoPendu(centreX, haut) {
    const gauche = centreX - 30;
    const bas = haut + 70;

    ligne([gauche - 15, bas], [gauche + 45, bas], MARRON, 5);
    ligne([gauche, bas], [gauche, haut], MARRON, 5);
    ligne([gauche, haut], [gauche + 50, haut], MARRON, 5);
    ligne([gauche, haut + 20], [gauche + 20, haut], MARRON, 4);
    ligne([gauche + 50, haut], [gauche + 50, haut + 22], NOIR, 3);

    ctx.beginPath();
    ctx.arc(gauche + 50, haut + 32, 10, 0, Math.PI * 2);
    ctx.strokeStyle = ROUGE;
    ctx.lineWidth = 3;
    ctx.stroke();
}

/*
 * Choisit la couleur selon le rapport de pénalités, entre 0 et 1.
 */
export function couleurBarre(rapport) {
    if (rapport < 1 / 3) {
        return VERT;
    }

    if (rapport < 2 / 3) {
        return ORANGE;
    }

    return ROUGE;
}

/*
 * Convertit la proportion de pénalités en largeur remplie.
 * Math.min empêche de dépasser la largeur totale de la barre.
 */
export function dessinerBarrePenalites(x, y, largeur, hauteur) {
    const rapport = Math.min(state.penalite / MAX_PENALITES, 1);

    rectangleArrondi(x, y, largeur, hauteur, 10, FOND_CLAIR);

    if (rapport > 0) {
        rectangleArrondi(x, y, largeur * rapport, hauteur, 10, couleurBarre(rapport));
    }

    rectangleArrondi(x, y, largeur, hauteur, 10, null, NOIR, 2);
}
