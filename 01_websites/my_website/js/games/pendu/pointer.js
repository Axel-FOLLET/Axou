/*
 * Conversion of the mouse coordinates when the canvas is resized.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
import { canvas } from "./canvas.js";

/*
 * Converts the position of the click in the window into internal canvas coordinates.
 * The ratio of the dimensions corrects the visual resizing done by the CSS.
 */
export function pointerCoordinates(event) {
    const rect = canvas.getBoundingClientRect();

    return {
        x: (event.clientX - rect.left) * (canvas.width / rect.width),
        y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
}
