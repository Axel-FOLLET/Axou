/*
 * Interactions de la page : ce module expose ses fonctions d'initialisation.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
export const CLICK_DURATION = 4;
const CLICK_EXTRA_SPEED = 70;
/*
 * cube contient les angles et la vitesse ; deltaTime est le temps écoulé en secondes.
 * Met à jour les trois angles puis applique une seule transformation CSS.
 */
export function updateCube(cube, deltaTime) {
    let intensity = 0;
    if (cube.clickTimeRemaining > 0) {
        cube.clickTimeRemaining -= deltaTime;
        /*
         * Borne le temps restant à zéro pour éviter une accélération négative.
         */
        const ratio = Math.max(cube.clickTimeRemaining / CLICK_DURATION, 0);
        /*
         * La sinusoïde fait décroître progressivement l'accélération après le clic.
         */
        intensity = Math.sin(ratio * Math.PI / 2);
    }
    const extraSpeed = CLICK_EXTRA_SPEED * intensity;
    /*
     * Vitesse × durée donne un angle ; les coefficients différencient les trois axes.
     */
    cube.rotationX += (cube.baseSpeed * 0.28 + extraSpeed * 1.85) * deltaTime;
    cube.rotationY += (cube.baseSpeed + extraSpeed) * deltaTime;
    cube.rotationZ += (cube.baseSpeed * 0.08 + extraSpeed * 1.55) * deltaTime;
    cube.object.style.transform = "rotateX(" + cube.rotationX + "deg) rotateY("
        + cube.rotationY + "deg) rotateZ(" + cube.rotationZ + "deg)";
}
