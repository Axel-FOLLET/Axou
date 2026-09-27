/*
 * Règles et changements d'état de la partie ; le dessin est confié aux autres modules.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
import { DROITE, POMMES_PAR_PALIER, VITESSE_DEPART, VITESSE_MAX } from "./constants.js";
import { creerExplosion } from "./effects.js";
import { casesEgales, creerSerpent, estHorsGrille, placerPomme, seMord } from "./geometry.js";
import { state } from "./state.js";
import { lireMeilleurScore, mettreAJourMeilleurScore } from "./storage.js";

/*
 * Réinitialise serpent, direction, pomme, score et animation, puis démarre la partie.
 */
export function nouvellePartie() {
    state.serpent = creerSerpent();
    state.direction = DROITE;
    state.directionDemandee = DROITE;
    state.pomme = placerPomme(state.serpent);
    state.score = 0;
    state.recordBattu = false;
    state.victoire = false;
    state.pause = false;
    state.particules = [];
    state.dernierPas = performance.now();
    state.etat = "jeu";
}

/*
 * Réinitialise les données de la manche et revient à l'accueil.
 */
export function retourMenu() {
    state.serpent = creerSerpent();
    state.direction = DROITE;
    state.directionDemandee = DROITE;
    state.pomme = placerPomme(state.serpent);
    state.score = 0;
    state.recordBattu = false;
    state.victoire = false;
    state.pause = false;
    state.particules = [];
    state.etat = "accueil";
}

/*
 * Renvoie le nombre de déplacements par seconde.
 * Chaque palier de pommes augmente la vitesse, sans dépasser VITESSE_MAX.
 */
export function calculerVitesse() {
    return Math.min(VITESSE_MAX, VITESSE_DEPART + Math.floor(state.score / POMMES_PAR_PALIER));
}

/*
 * Ajoute le vecteur direction aux coordonnées de la tête actuelle.
 */
export function calculerNouvelleTete() {
    return [
        state.serpent[0][0] + state.direction[0],
        state.serpent[0][1] + state.direction[1]
    ];
}

/*
 * Effectue un déplacement : nouvelle tête, éventuel retrait de la queue, collisions et pomme.
 */
export function faireAvancerPartie() {
    state.direction = state.directionDemandee;

    const nouvelleTete = calculerNouvelleTete();
    const mange = casesEgales(nouvelleTete, state.pomme);
    /*
     * Le spread copie les cases dans un nouveau tableau en ajoutant la tête devant.
     */
    const nouveauSerpent = [nouvelleTete, ...state.serpent];

    if (!mange) {
        /*
         * Sans pomme, retirer la queue conserve la longueur et libère sa case avant le test de collision.
         */
        nouveauSerpent.pop();
    }

    state.serpent = nouveauSerpent;

    if (estHorsGrille(state.serpent[0]) || seMord(state.serpent)) {
        terminerPartie(false);
        return;
    }

    if (mange) {
        state.score += 1;
        state.pomme = placerPomme(state.serpent);

        if (state.pomme === null) {
            terminerPartie(true);
        }
    }
}

/*
 * gagne indique si la partie est gagnée.
 * Enregistre le résultat utile au score puis sélectionne l'écran de fin.
 */
export function terminerPartie(gagne) {
    state.victoire = gagne;
    state.recordBattu = mettreAJourMeilleurScore(state.score);
    state.meilleurScore = lireMeilleurScore();
    state.etat = "fin";
    state.pause = false;

    if (state.recordBattu) {
        state.particules = creerExplosion(300, 200);
    }
}

/*
 * Met uniquement une partie en cours en pause, notamment quand la fenêtre perd le focus.
 */
export function mettreEnPauseSiNecessaire() {
    if (state.etat === "jeu") {
        state.pause = true;
    }
}
