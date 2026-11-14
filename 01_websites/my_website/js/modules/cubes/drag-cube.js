/*
 * Page interactions: this module exposes its initialisation functions.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
/*
 * One pixel of dragging turns the cube by half a degree.
 */
const DEGREES_PER_PIXEL = 0.5;
/*
 * Under 10 px, the gesture stays a simple press (click) and not a drag.
 */
const DRAG_THRESHOLD = 10;
/*
 * The throw speed is measured over the last 100 milliseconds of the gesture.
 */
const VELOCITY_WINDOW = 100;
/*
 * Limits the speed (degrees per second): too fast, the rotation would become unreadable.
 */
const MAX_SPEED = 1080;
/*
 * Clamps a value between -MAX_SPEED and MAX_SPEED.
 */
function limitSpeed(speed) {
    return Math.max(-MAX_SPEED, Math.min(MAX_SPEED, speed));
}
/*
 * Computes the pointer speed (pixels per second) from the recent positions.
 * Returns { x: 0, y: 0 } if the pointer was still at the moment of release.
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
 * Lets the user grab the cube and turn it with a finger or the mouse, then throw it.
 * render draws the cube at once; canThrow says whether momentum is allowed (reduced motion).
 */
export function enableCubeDrag(trigger, cube, render, canThrow) {
    let start = null;
    let samples = [];
    trigger.addEventListener("pointerdown", event => {
        /*
         * button is 0 for the left click and for the finger.
         */
        if (event.button !== 0) return;
        /*
         * The capture keeps the tracking even if the pointer leaves the cube during the gesture.
         */
        trigger.setPointerCapture(event.pointerId);
        start = { x: event.clientX, y: event.clientY };
        samples = [{ x: event.clientX, y: event.clientY, time: event.timeStamp }];
        cube.wasDragged = false;
        /*
         * Grabbing a thrown cube stops it where it is, without a jump.
         */
        cube.velocityX = 0;
        cube.velocityY = 0;
        cube.isDragging = true;
    });
    trigger.addEventListener("pointermove", event => {
        if (!start) return;
        /*
         * Math.hypot gives the distance travelled since the press (Pythagorean theorem).
         */
        const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
        if (!cube.wasDragged && distance < DRAG_THRESHOLD) return;
        cube.wasDragged = true;
        const previous = samples[samples.length - 1];
        /*
         * Dragging horizontally turns around the vertical axis (Y), and conversely.
         */
        cube.rotationY += (event.clientX - previous.x) * DEGREES_PER_PIXEL;
        cube.rotationX -= (event.clientY - previous.y) * DEGREES_PER_PIXEL;
        render(cube);
        samples.push({ x: event.clientX, y: event.clientY, time: event.timeStamp });
    });
    /*
     * On release, the cube keeps the speed of the gesture: no break between dragging and animating.
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
     * pointercancel: the browser takes the gesture over, for example to scroll the page.
     */
    trigger.addEventListener("pointercancel", endDrag);
}
