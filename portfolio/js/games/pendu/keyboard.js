/*
 * Clavier dessiné dans le canvas : ses zones cliquables sont mémorisées séparément.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
import { CLAVIER_LARGEUR, CLAVIER_X, CLAVIER_Y, FOND_CLAIR, GRIS, LIGNES_CLAVIER, NOIR, ROUGE_CLAIR, TOUCHE_ECART, TOUCHE_HAUTEUR, TOUCHE_LARGEUR, VERT_CLAIR } from "./constants.js";
import { rectangleArrondi, texte } from "./drawing.js";
import { state } from "./state.js";

/*
 * Renvoie la couleur de la lettre selon son état : non essayée, présente ou absente.
 */
export function couleurTouche(lettre) {
    const minuscule = lettre.toLowerCase();

    if (!state.lettresTentees.has(minuscule)) {
        return FOND_CLAIR;
    }

    return state.mot.includes(minuscule) ? VERT_CLAIR : ROUGE_CLAIR;
}

/*
 * Dessine les rangées de lettres et mémorise leurs rectangles dans zonesTouches.
 * Le module controls réutilise ces rectangles pour savoir quelle touche a été cliquée.
 */
export function dessinerClavier() {
    state.zonesTouches = [];

    LIGNES_CLAVIER.forEach((ligneClavier, numeroLigne) => {
        const largeurLigne = ligneClavier.length * (TOUCHE_LARGEUR + TOUCHE_ECART) - TOUCHE_ECART;
        const xDepart = CLAVIER_X + (CLAVIER_LARGEUR - largeurLigne) / 2;
        const y = CLAVIER_Y + numeroLigne * (TOUCHE_HAUTEUR + TOUCHE_ECART);

        [...ligneClavier].forEach((lettre, numero) => {
            const x = xDepart + numero * (TOUCHE_LARGEUR + TOUCHE_ECART);

            rectangleArrondi(
                x,
                y,
                TOUCHE_LARGEUR,
                TOUCHE_HAUTEUR,
                8,
                couleurTouche(lettre),
                GRIS,
                2
            );

            texte(lettre, x + TOUCHE_LARGEUR / 2, y + 10, 30, NOIR, "center");

            state.zonesTouches.push({
                lettre: lettre.toLowerCase(),
                x: x,
                y: y,
                largeur: TOUCHE_LARGEUR,
                hauteur: TOUCHE_HAUTEUR
            });
        });
    });
}
