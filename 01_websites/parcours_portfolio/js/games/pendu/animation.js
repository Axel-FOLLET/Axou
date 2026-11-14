/*
 * Render loop: requestAnimationFrame calls the function back before the next frame.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
import { draw } from "./screens.js";

/*
 * Draws the current frame then schedules the next one with requestAnimationFrame.
 * The browser chooses the frame rate; this is not a blocking loop.
 */
export function animation() {
    draw();
    requestAnimationFrame(animation);
}
