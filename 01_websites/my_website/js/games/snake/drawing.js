/*
 * Reusable drawing primitives: texts and simple shapes.
 * Coordinates are those of the canvas, not those of the browser window.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
import { FONT_FAMILY } from "../theme.js";
import { ctx } from "./canvas.js";
import { CANVAS_WIDTH, WHITE } from "./constants.js";

/*
 * Draws shownText at x and y coordinates, in canvas pixels.
 * Default parameters let callers omit size, colour and alignment.
 */
export function drawText(shownText, x, y, size = 30, color = WHITE, align = "left") {
    ctx.font = `${size}px ${FONT_FAMILY}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "top";
    ctx.fillText(shownText, x, y);
}

/*
 * Reuses drawText with its anchor point at the middle of the game width.
 */
export function drawCenteredText(shownText, y, size = 30, color = WHITE) {
    drawText(shownText, CANVAS_WIDTH / 2, y, size, color, "center");
}

/*
 * Draws a rectangle of the given width/height, with the requested radius.
 * fill and border are independent: null skips one of the two.
 */
export function drawRoundedRect(x, y, width, height, radius, fill, border = null, lineWidth = 1) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);

    if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
    }

    if (border) {
        ctx.strokeStyle = border;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }
}
