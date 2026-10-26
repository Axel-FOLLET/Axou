/*
 * Boucle de rendu : requestAnimationFrame rappelle la fonction avant une prochaine image.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
import { dessiner } from "./screens.js";

/*
 * Dessine l'image courante puis programme la suivante avec requestAnimationFrame.
 * Le navigateur choisit le rythme des images ; ce n'est pas une boucle bloquante.
 */
export function animation() {
    dessiner();
    requestAnimationFrame(animation);
}
