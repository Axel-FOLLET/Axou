/*
 * Traduit les actions du joueur en appels aux règles, sans recopier ces règles.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
import { canvas } from "./canvas.js";
import { DIRECTIONS_TOUCHES } from "./constants.js";
import { choisirDirection } from "./geometry.js";
import { mettreEnPauseSiNecessaire, nouvellePartie, retourMenu } from "./rules.js";
import { state } from "./state.js";

/*
 * Installe une seule fois les écouteurs clavier et souris du jeu.
 * Chaque événement consulte l'état courant avant de déclencher une action.
 */
export function initControls() {
    window.addEventListener("keydown", function(event) {
        /*
         * Laisse les raccourcis du navigateur ou du système utiliser ces touches modificatrices.
         */
        if (event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }

        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) {
            /*
             * Empêche l'action native liée à cette touche, par exemple le défilement de la page.
             */
            event.preventDefault();
        }

        if (event.key === "Escape") {
            event.preventDefault();
            retourMenu();
            return;
        }

        if (state.etat === "accueil" && event.key === "Enter") {
            event.preventDefault();
            nouvellePartie();
            return;
        }

        if (state.etat === "fin" && event.key === "Enter") {
            event.preventDefault();
            nouvellePartie();
            return;
        }

        if (state.etat !== "jeu") {
            return;
        }

        if (event.key === " ") {
            state.pause = !state.pause;
            state.dernierPas = performance.now();
            return;
        }

        const nouvelleDirection = DIRECTIONS_TOUCHES[event.key];

        if (nouvelleDirection && !state.pause) {
            state.directionDemandee = choisirDirection(state.direction, nouvelleDirection);
        }
    });

    canvas.addEventListener("click", function() {
        canvas.focus();
    });

    // -------------------- PAUSE AUTOMATIQUE --------------------



    window.addEventListener("blur", mettreEnPauseSiNecessaire);

    document.addEventListener("visibilitychange", function() {
        if (document.hidden) {
            mettreEnPauseSiNecessaire();
        }
    });


}
