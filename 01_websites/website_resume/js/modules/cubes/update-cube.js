/*
 * Interactions de la page : ce module expose ses fonctions d'initialisation.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
export const CLICK_DURATION = 4;
const CLICK_EXTRA_SPEED = 70;
/*
 * Après un lancer, la vitesse garde 99,8 % de sa valeur à chaque milliseconde :
 * c'est la décélération utilisée par Apple pour le défilement.
 */
const DECELERATION_RATE = 0.998;
/*
 * Applique les trois angles au cube en une seule transformation CSS.
 */
export function renderCube(cube) {
    cube.object.style.transform = "rotateX(" + cube.rotationX + "deg) rotateY("
        + cube.rotationY + "deg) rotateZ(" + cube.rotationZ + "deg)";
}
/*
 * cube contient les angles et la vitesse ; deltaTime est le temps écoulé en secondes.
 * Met à jour les trois angles puis dessine le cube.
 */
export function updateCube(cube, deltaTime) {
    /*
     * Pendant un glisser, seul le pointeur fait tourner le cube.
     */
    if (cube.isDragging) return;
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
     * velocityX et velocityY ajoutent l'élan d'un lancer.
     */
    cube.rotationX += (cube.baseSpeed * 0.28 + extraSpeed * 1.85 + cube.velocityX) * deltaTime;
    cube.rotationY += (cube.baseSpeed + extraSpeed + cube.velocityY) * deltaTime;
    cube.rotationZ += (cube.baseSpeed * 0.08 + extraSpeed * 1.55) * deltaTime;
    /*
     * Décroissance exponentielle : l'élan diminue vite puis de plus en plus doucement.
     */
    const decay = Math.pow(DECELERATION_RATE, deltaTime * 1000);
    cube.velocityX *= decay;
    cube.velocityY *= decay;
    renderCube(cube);
}
