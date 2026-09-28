/*
 * Composition des écrans : chaque image est redessinée à partir de l'état courant.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
import { dessinerBandeau, dessinerGrille, dessinerLogoSerpent, dessinerPomme, dessinerSerpent } from "./artwork.js";
import { ctx } from "./canvas.js";
import { BLANC, FOND, GRIS, HAUTEUR_BANDEAU, HAUTEUR_FENETRE, LARGEUR_FENETRE, VERT_FORET } from "./constants.js";
import { rectangleArrondi, texteCentre } from "./drawing.js";
import { dessinerParticules } from "./effects.js";
import { state } from "./state.js";
import { t } from "./translations.js";

/*
 * Compose l'écran d'accueil : fond, illustration, règles et commande pour démarrer.
 */
export function afficherAccueil() {
    ctx.fillStyle = FOND;
    ctx.fillRect(0, 0, LARGEUR_FENETRE, HAUTEUR_FENETRE);

    dessinerLogoSerpent([LARGEUR_FENETRE / 2 - 14, 40]);
    texteCentre(t.welcome, 85, 38, VERT_FORET);
    rectangleArrondi(50, 150, LARGEUR_FENETRE - 100, 270, 14, null, VERT_FORET, 4);

    t.rules.forEach((ligneRegle, index) => {
        texteCentre(ligneRegle, 182 + index * 38, 21, BLANC);
    });

    texteCentre(t.start, 470, 30, VERT_FORET);
    texteCentre(t.escapeMenu, 520, 24, GRIS);
}

/*
 * Redessine la partie à partir de state ; les règles du jeu sont gérées dans rules.js.
 */
export function afficherJeu() {
    ctx.fillStyle = FOND;
    ctx.fillRect(0, 0, LARGEUR_FENETRE, HAUTEUR_FENETRE);

    dessinerGrille();

    if (state.pomme !== null) {
        dessinerPomme(state.pomme);
    }

    dessinerSerpent();
    dessinerBandeau();

    if (state.pause) {
        ctx.fillStyle = "rgba(13,10,155,0.75)";
        ctx.fillRect(0, HAUTEUR_BANDEAU, LARGEUR_FENETRE, LARGEUR_FENETRE);
        texteCentre(t.pause, 290, 50, VERT_FORET);
    }
}

/*
 * Compose l'écran de victoire ou de défaite avec le résultat et les commandes de reprise.
 */
export function afficherFin() {
    ctx.fillStyle = FOND;
    ctx.fillRect(0, 0, LARGEUR_FENETRE, HAUTEUR_FENETRE);

    if (state.recordBattu) {
        dessinerParticules();
    }

    dessinerLogoSerpent([LARGEUR_FENETRE / 2 - 14, 45]);

    if (state.victoire) {
        texteCentre(t.victory, 100, 50, VERT_FORET);
        texteCentre(t.fullGrid, 170, 30, BLANC);
    } else {
        texteCentre(t.lost, 100, 50, BLANC);
        texteCentre(t.crashed, 170, 30, BLANC);
    }

    texteCentre(t.applesEaten(state.score), 250, 30, BLANC);
    texteCentre(state.recordBattu ? t.newBest : t.best(state.meilleurScore), 300, 30, VERT_FORET);
    texteCentre(t.replay, 420, 30, VERT_FORET);
    texteCentre(t.escapeMenu, 470, 24, GRIS);
}

/*
 * Choisit l'écran à dessiner selon state.etat : accueil, jeu ou fin.
 */
export function dessiner() {
    if (state.etat === "accueil") {
        afficherAccueil();
    } else if (state.etat === "jeu") {
        afficherJeu();
    } else {
        afficherFin();
    }
}
