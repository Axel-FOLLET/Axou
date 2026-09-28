/*
 * Boucle de rendu : requestAnimationFrame rappelle la fonction avant une prochaine image.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
import { animerFeuxArtifice } from "./effects.js";
import { calculerVitesse, faireAvancerPartie } from "./rules.js";
import { dessiner } from "./screens.js";
import { state } from "./state.js";

/*
 * Dessine l'image courante puis programme la suivante avec requestAnimationFrame.
 * Le navigateur choisit le rythme des images ; ce n'est pas une boucle bloquante.
 */
export function animation(maintenant) {
    /*
     * Limite l'écart entre images à 100 ms pour les effets après une interruption.
     */
    const deltaMs = Math.min(maintenant - state.tempsPrecedent, 100);
    /*
     * 1000 / 60 est la durée d'une image à 60 Hz ; le rapport ajuste les particules au temps écoulé.
     */
    const deltaFrames = deltaMs / (1000 / 60);
    state.tempsPrecedent = maintenant;

    if (state.etat === "jeu" && !state.pause) {
        /*
         * Convertit les déplacements par seconde en millisecondes entre deux déplacements.
         */
        const delai = 1000 / calculerVitesse();

        if (maintenant - state.dernierPas >= delai) {
            state.dernierPas = maintenant;
            faireAvancerPartie();
        }
    } else if (state.etat === "fin" && state.recordBattu) {
        animerFeuxArtifice(deltaFrames);
    }

    dessiner();
    requestAnimationFrame(animation);
}
