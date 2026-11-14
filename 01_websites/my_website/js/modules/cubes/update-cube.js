/*
 * Page interactions: this module exposes its initialisation functions.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
export const CLICK_DURATION = 4;
const CLICK_EXTRA_SPEED = 70;
/*
 * After a throw, the speed keeps 99.8% of its value every millisecond:
 * this is the deceleration used by Apple for scrolling.
 */
const DECELERATION_RATE = 0.998;
/*
 * Applies the three angles to the cube in a single CSS transformation.
 */
export function renderCube(cube) {
    cube.object.style.transform = "rotateX(" + cube.rotationX + "deg) rotateY("
        + cube.rotationY + "deg) rotateZ(" + cube.rotationZ + "deg)";
}
/*
 * cube holds the angles and the speed; deltaTime is the elapsed time in seconds.
 * Updates the three angles then draws the cube.
 */
export function updateCube(cube, deltaTime) {
    /*
     * During a drag, only the pointer turns the cube.
     */
    if (cube.isDragging) return;
    let intensity = 0;
    if (cube.clickTimeRemaining > 0) {
        cube.clickTimeRemaining -= deltaTime;
        /*
         * Clamps the remaining time to zero to avoid a negative acceleration.
         */
        const ratio = Math.max(cube.clickTimeRemaining / CLICK_DURATION, 0);
        /*
         * The sine curve makes the acceleration decrease gradually after the click.
         */
        intensity = Math.sin(ratio * Math.PI / 2);
    }
    const extraSpeed = CLICK_EXTRA_SPEED * intensity;
    /*
     * Speed x duration gives an angle; the coefficients differentiate the three axes.
     * velocityX and velocityY add the momentum of a throw.
     */
    cube.rotationX += (cube.baseSpeed * 0.28 + extraSpeed * 1.85 + cube.velocityX) * deltaTime;
    cube.rotationY += (cube.baseSpeed + extraSpeed + cube.velocityY) * deltaTime;
    cube.rotationZ += (cube.baseSpeed * 0.08 + extraSpeed * 1.55) * deltaTime;
    /*
     * Exponential decay: the momentum drops quickly then more and more gently.
     */
    const decay = Math.pow(DECELERATION_RATE, deltaTime * 1000);
    cube.velocityX *= decay;
    cube.velocityY *= decay;
    renderCube(cube);
}
