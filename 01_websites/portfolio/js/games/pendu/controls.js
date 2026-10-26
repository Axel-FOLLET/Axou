/*
 * Traduit les actions du joueur en appels aux règles, sans recopier ces règles.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
import { canvas } from "./canvas.js";
import { coordonneesSouris } from "./pointer.js";
import { demarrerPartie, rejouer, retourAccueil, traiterTentative } from "./rules.js";
import { state } from "./state.js";

/*
 * Installe une seule fois les écouteurs clavier et souris du jeu.
 * Chaque événement consulte l'état courant avant de déclencher une action.
 */
export function initControls() {
    canvas.addEventListener("click", function(event) {
        canvas.focus();

        if (state.etat === "fin") {
            rejouer();
            return;
        }

        if (state.etat !== "jeu") {
            return;
        }

        const souris = coordonneesSouris(event);
        /*
         * find renvoie la première zone contenant le clic, ou undefined si aucune ne correspond.
         */
        const touche = state.zonesTouches.find((zone) =>
            souris.x >= zone.x
            && souris.x <= zone.x + zone.largeur
            && souris.y >= zone.y
            && souris.y <= zone.y + zone.hauteur
        );

        if (touche) {
            traiterTentative(touche.lettre);
        }
    });

    // -------------------- CLAVIER --------------------

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
            retourAccueil();
            return;
        }

        if (state.etat === "accueil") {
            if (event.key === "Enter") {
                event.preventDefault();
                demarrerPartie();
            }
            return;
        }

        if (state.etat === "fin") {
            if (event.key === "Enter") {
                event.preventDefault();
                rejouer();
            }
            return;
        }

        if (event.key === "Backspace") {
            event.preventDefault();
            /*
             * slice(0, -1) conserve tous les caractères sauf le dernier.
             */
            state.saisie = state.saisie.slice(0, -1);
            return;
        }

        if (event.key === "Enter") {
            event.preventDefault();
            const tentative = state.saisie;
            state.saisie = "";
            traiterTentative(tentative);
            return;
        }

        if (/^[A-Za-zÀ-ÖØ-öø-ÿ]$/u.test(event.key)) {
            event.preventDefault();
            state.saisie += event.key;
        }
    });


}
