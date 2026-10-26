/*
 * Conversion des coordonnées souris lorsque le canvas est redimensionné.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
import { canvas } from "./canvas.js";

/*
 * Convertit la position du clic dans la fenêtre en coordonnées internes du canvas.
 * Le rapport des dimensions corrige le redimensionnement visuel effectué par le CSS.
 */
export function coordonneesSouris(event) {
    const rect = canvas.getBoundingClientRect();

    return {
        x: (event.clientX - rect.left) * (canvas.width / rect.width),
        y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
}
