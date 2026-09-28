/*
 * Interactions de la page : ce module expose ses fonctions d'initialisation.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
import { createCube } from "./create-cube.js";
import { CLICK_DURATION, renderCube, updateCube } from "./update-cube.js";
import { enableCubeDrag } from "./drag-cube.js";
/*
 * Crée les cubes présents et installe une boucle d'animation commune.
 * Un clic relance l'accélération du cube ; un glisser le fait tourner puis le lance.
 * La boucle ne tourne que si un cube est visible et si l'utilisateur accepte le mouvement.
 */
export function initCubes() {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    /*
     * Map associe chaque bouton HTML à l'état de son cube : l'observateur ne reçoit que l'élément.
     */
    const cubesByTrigger = new Map();
    document.querySelectorAll(".cube").forEach((trigger, index) => {
        const cube = createCube(trigger, index);
        cube.isVisible = false;
        cubesByTrigger.set(trigger, cube);
        /*
         * Un cube placé dans un lien (icône) garde le comportement du lien : pas de glisser.
         * En mouvement réduit, on peut toujours tourner le cube au doigt, mais sans élan.
         */
        if (!trigger.closest("a")) {
            enableCubeDrag(trigger, cube, renderCube, () => !reducedMotion.matches);
        }
        /*
         * click sert aussi pour Entrée et Espace au clavier.
         * Après un glisser, le clic qui suit le lâcher ne relance pas l'accélération.
         * detail vaut 0 pour un clic au clavier : il fonctionne toujours.
         */
        trigger.addEventListener("click", event => {
            if (event.detail > 0 && cube.wasDragged) return;
            cube.clickTimeRemaining = CLICK_DURATION;
        });
    });
    if (!cubesByTrigger.size) return;
    /*
     * Spread : convertit les valeurs de la Map en tableau pour utiliser forEach et some.
     */
    const cubes = [...cubesByTrigger.values()];
    let frameId = null;
    let previousTime = 0;
    /*
     * currentTime est l'horodatage fourni par requestAnimationFrame, en millisecondes.
     * Calcule le temps depuis l'image précédente avant d'actualiser les cubes visibles.
     */
    function animate(currentTime) {
        /*
         * Convertit les millisecondes en secondes et limite le saut à 0,05 s après une interruption.
         */
        const deltaTime = Math.min((currentTime - previousTime) / 1000, 0.05);
        previousTime = currentTime;
        cubes.forEach(cube => {
            if (cube.isVisible) updateCube(cube, deltaTime);
        });
        frameId = requestAnimationFrame(animate);
    }
    /*
     * Démarre ou arrête la boucle selon la visibilité des cubes et la préférence de mouvement.
     * frameId vaut null quand la boucle est arrêtée : on évite ainsi de lancer deux boucles.
     */
    function updateLoop() {
        const shouldRun = !reducedMotion.matches && cubes.some(cube => cube.isVisible);
        if (shouldRun && frameId === null) {
            previousTime = performance.now();
            frameId = requestAnimationFrame(animate);
        } else if (!shouldRun && frameId !== null) {
            cancelAnimationFrame(frameId);
            frameId = null;
        }
    }
    /*
     * IntersectionObserver prévient quand un élément entre ou sort de l'écran.
     */
    const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
            cubesByTrigger.get(entry.target).isVisible = entry.isIntersecting;
        }
        updateLoop();
    });
    cubesByTrigger.forEach((cube, trigger) => {
        /*
         * deltaTime à 0 dessine la position de départ, même si la boucle ne démarre jamais.
         */
        updateCube(cube, 0);
        observer.observe(trigger);
    });
    /*
     * La préférence peut changer pendant la visite : la boucle s'adapte sans recharger la page.
     */
    reducedMotion.addEventListener("change", updateLoop);
}
