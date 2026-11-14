/*
 * Page interactions: this module exposes its initialisation functions.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
import { createCube } from "./create-cube.js";
import { CLICK_DURATION, renderCube, updateCube } from "./update-cube.js";
import { enableCubeDrag } from "./drag-cube.js";
/*
 * Creates the cubes present and installs a shared animation loop.
 * A click restarts the cube acceleration; a drag turns it then throws it.
 * The loop runs only if a cube is visible and if the user accepts motion.
 */
export function initCubes() {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    /*
     * Map associates each HTML element with the state of its cube: the observer receives only the element.
     */
    const cubesByTrigger = new Map();
    document.querySelectorAll(".cube").forEach((trigger, index) => {
        const cube = createCube(trigger, index);
        cube.isVisible = false;
        cubesByTrigger.set(trigger, cube);
        /*
         * With reduced motion, the cube can still be turned with a finger, but without momentum.
         */
        enableCubeDrag(trigger, cube, renderCube, () => !reducedMotion.matches);
        /*
         * The cubes react only to the mouse and the finger.
         * After a drag, the click that follows the release does not restart the acceleration;
         * inside a home-page door (cube placed in a link), it does not open the page either.
         */
        trigger.addEventListener("click", event => {
            if (cube.wasDragged) {
                event.preventDefault();
                return;
            }
            cube.clickTimeRemaining = CLICK_DURATION;
        });
    });
    if (!cubesByTrigger.size) return;
    /*
     * Spread: converts the values of the Map into an array to use forEach and some.
     */
    const cubes = [...cubesByTrigger.values()];
    let frameId = null;
    let previousTime = 0;
    /*
     * currentTime is the timestamp provided by requestAnimationFrame, in milliseconds.
     * Computes the time since the previous frame before updating the visible cubes.
     */
    function animate(currentTime) {
        /*
         * Converts milliseconds into seconds and limits the jump to 0.05 s after an interruption.
         */
        const deltaTime = Math.min((currentTime - previousTime) / 1000, 0.05);
        previousTime = currentTime;
        cubes.forEach(cube => {
            if (cube.isVisible) updateCube(cube, deltaTime);
        });
        frameId = requestAnimationFrame(animate);
    }
    /*
     * Starts or stops the loop according to the visibility of the cubes and the motion preference.
     * frameId is null when the loop is stopped: this avoids starting two loops.
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
     * IntersectionObserver reports when an element enters or leaves the screen.
     */
    const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
            cubesByTrigger.get(entry.target).isVisible = entry.isIntersecting;
        }
        updateLoop();
    });
    cubesByTrigger.forEach((cube, trigger) => {
        /*
         * deltaTime at 0 draws the starting position, even if the loop never starts.
         */
        updateCube(cube, 0);
        observer.observe(trigger);
    });
    /*
     * The preference can change during the visit: the loop adapts without reloading the page.
     */
    reducedMotion.addEventListener("change", updateLoop);
}
