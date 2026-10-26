/*
 * Interactions de la page : ce module expose ses fonctions d'initialisation.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
/*
 * Un pixel de glissement fait tourner le cube d'un demi-degré.
 */
const DEGREES_PER_PIXEL = 0.5;
/*
 * En dessous de 10 px, le geste reste un simple appui (clic) et non un glissement.
 */
const DRAG_THRESHOLD = 10;
/*
 * La vitesse de lancer est mesurée sur les 100 dernières millisecondes du geste.
 */
const VELOCITY_WINDOW = 100;
/*
 * Limite la vitesse (degrés par seconde) : trop rapide, la rotation deviendrait illisible.
 */
const MAX_SPEED = 1080;
/*
 * Borne une valeur entre -MAX_SPEED et MAX_SPEED.
 */
function limitSpeed(speed) {
    return Math.max(-MAX_SPEED, Math.min(MAX_SPEED, speed));
}
/*
 * Calcule la vitesse du pointeur (pixels par seconde) à partir des positions récentes.
 * Renvoie { x: 0, y: 0 } si le pointeur était immobile au moment du lâcher.
 */
function getReleaseVelocity(samples, releaseTime) {
    const recent = samples.filter(sample => releaseTime - sample.time <= VELOCITY_WINDOW);
    if (recent.length < 2) return { x: 0, y: 0 };
    const first = recent[0];
    const last = recent[recent.length - 1];
    const seconds = (last.time - first.time) / 1000;
    if (seconds <= 0) return { x: 0, y: 0 };
    return { x: (last.x - first.x) / seconds, y: (last.y - first.y) / seconds };
}
/*
 * Permet d'attraper le cube et de le faire tourner au doigt ou à la souris, puis de le lancer.
 * render dessine le cube tout de suite ; canThrow indique si l'élan est autorisé (mouvement réduit).
 */
export function enableCubeDrag(trigger, cube, render, canThrow) {
    let start = null;
    let samples = [];
    trigger.addEventListener("pointerdown", event => {
        /*
         * button vaut 0 pour le clic gauche et pour le doigt.
         */
        if (event.button !== 0) return;
        /*
         * La capture garde le suivi même si le pointeur sort du cube pendant le geste.
         */
        trigger.setPointerCapture(event.pointerId);
        start = { x: event.clientX, y: event.clientY };
        samples = [{ x: event.clientX, y: event.clientY, time: event.timeStamp }];
        cube.wasDragged = false;
        /*
         * Attraper un cube lancé l'arrête là où il est, sans saut.
         */
        cube.velocityX = 0;
        cube.velocityY = 0;
        cube.isDragging = true;
    });
    trigger.addEventListener("pointermove", event => {
        if (!start) return;
        /*
         * Math.hypot donne la distance parcourue depuis l'appui (théorème de Pythagore).
         */
        const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
        if (!cube.wasDragged && distance < DRAG_THRESHOLD) return;
        cube.wasDragged = true;
        const previous = samples[samples.length - 1];
        /*
         * Glisser horizontalement tourne autour de l'axe vertical (Y), et inversement.
         */
        cube.rotationY += (event.clientX - previous.x) * DEGREES_PER_PIXEL;
        cube.rotationX -= (event.clientY - previous.y) * DEGREES_PER_PIXEL;
        render(cube);
        samples.push({ x: event.clientX, y: event.clientY, time: event.timeStamp });
    });
    /*
     * Au lâcher, le cube garde la vitesse du geste : pas de coupure entre glisser et animer.
     */
    function endDrag(event) {
        if (!start) return;
        start = null;
        cube.isDragging = false;
        if (!cube.wasDragged || !canThrow()) return;
        const velocity = getReleaseVelocity(samples, event.timeStamp);
        cube.velocityY = limitSpeed(velocity.x * DEGREES_PER_PIXEL);
        cube.velocityX = limitSpeed(-velocity.y * DEGREES_PER_PIXEL);
    }
    trigger.addEventListener("pointerup", endDrag);
    /*
     * pointercancel : le navigateur reprend le geste, par exemple pour faire défiler la page.
     */
    trigger.addEventListener("pointercancel", endDrag);
}
