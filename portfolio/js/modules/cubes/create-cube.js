/*
 * Interactions de la page : ce module expose ses fonctions d'initialisation.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
const FACES = ["front", "back", "right", "left", "top", "bottom"];
/*
 * trigger est l'élément HTML porteur du cube ; index distingue sa position dans la liste.
 * Crée ses six faces et renvoie son état initial, utilisé ensuite par l'animation.
 */
export function createCube(trigger, index) {
    const object = document.createElement("span");
    object.className = "cube__object";
    for (const name of FACES) {
        const face = document.createElement("span");
        face.classList.add("cube__face", "cube__face--" + name);
        object.append(face);
    }
    trigger.append(object);
    /*
     * dataset contient du texte : Number le convertit ; || utilise le repli si la valeur vaut 0 ou NaN.
     */
    const phase = Number(trigger.dataset.phase) || index * 30;
    return {
        object,
        rotationX: -18 + phase * 0.05, rotationY: phase, rotationZ: phase * 0.12,
        baseSpeed: Number(trigger.dataset.speed) || 16,
        clickTimeRemaining: 0,
        /*
         * État du glisser et élan après un lancer, en degrés par seconde.
         */
        isDragging: false,
        wasDragged: false,
        velocityX: 0,
        velocityY: 0
    };
}
