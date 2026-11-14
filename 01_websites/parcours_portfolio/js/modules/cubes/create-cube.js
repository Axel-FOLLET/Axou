/*
 * Page interactions: this module exposes its initialisation functions.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
const FACES = ["front", "back", "right", "left", "top", "bottom"];


function appendFaces(parent) {
    for (const name of FACES) {
        const face = document.createElement("span");
        face.classList.add("cube__face", "cube__face--" + name);
        parent.append(face);
    }
}


/*
 * trigger is the HTML element carrying the cube; index tells its position in the list apart.
 * Creates its six faces and returns its initial state, used afterwards by the animation.
 */
export function createCube(trigger, index) {
    const object = document.createElement("span");
    object.className = "cube__object";
    appendFaces(object);
    trigger.append(object);
    /*
     * dataset holds text: Number converts it; || uses the fallback if the value is 0 or NaN.
     */
    const phase = Number(trigger.dataset.phase) || index * 30;
    return {
        object,
        rotationX: -18 + phase * 0.05, rotationY: phase, rotationZ: phase * 0.12,
        baseSpeed: Number(trigger.dataset.speed) || 16,
        clickTimeRemaining: 0,
        /*
         * Drag state and momentum after a throw, in degrees per second.
         */
        isDragging: false,
        wasDragged: false,
        velocityX: 0,
        velocityY: 0
    };
}
