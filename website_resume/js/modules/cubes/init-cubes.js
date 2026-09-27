/*
 * Interactions de la page : ce module expose ses fonctions d'initialisation.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
import { createCube } from "./create-cube.js";
import { CLICK_DURATION, updateCube } from "./update-cube.js";
/*
 * Crée les cubes présents et installe une boucle d'animation commune.
 * Chaque clic relance l'accélération du seul cube concerné.
 */
export function initCubes() {
    /*
     * Le spread convertit la NodeList en tableau ; map renvoie l'état créé pour chaque cube.
     */
    const cubes = [...document.querySelectorAll(".cube")].map((trigger, index) => {
        const cube = createCube(trigger, index);
        trigger.addEventListener("click", () => { cube.clickTimeRemaining = CLICK_DURATION; });
        return cube;
    });
    if (!cubes.length) return;
    let previousTime = performance.now();
    /*
     * currentTime est l'horodatage fourni par requestAnimationFrame, en millisecondes.
     * Calcule le temps depuis l'image précédente avant d'actualiser tous les cubes.
     */
    function animate(currentTime) {
        /*
         * Convertit les millisecondes en secondes et limite le saut à 0,05 s après une interruption.
         */
        const deltaTime = Math.min((currentTime - previousTime) / 1000, 0.05);
        previousTime = currentTime;
        cubes.forEach(cube => updateCube(cube, deltaTime));
        requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
}
