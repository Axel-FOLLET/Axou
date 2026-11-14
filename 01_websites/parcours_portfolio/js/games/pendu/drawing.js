/*
 * Reusable drawing primitives: texts and simple shapes.
 * The coordinates are those of the canvas, not those of the browser window.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
import { FONT_FAMILY } from "../theme.js";
import { canvas, ctx } from "./canvas.js";
import { TEXT } from "./constants.js";

/*
 * Sets the context font to the requested size; measureText then measures with this font.
 */
export function setFont(size) {
    ctx.font = `${size}px ${FONT_FAMILY}`;
}

/*
 * Draws displayedText at coordinates x and y, in canvas pixels.
 * The default parameters allow omitting size, colour and alignment.
 */
export function drawText(displayedText, x, y, size = 30, color = TEXT, alignment = "left") {
    setFont(size);
    ctx.fillStyle = color;
    ctx.textAlign = alignment;
    ctx.textBaseline = "top";
    ctx.fillText(displayedText, x, y);
}

/*
 * Reuses drawText, placing its anchor point in the middle of the game width.
 */
export function drawCenteredText(displayedText, y, size = 30, color = TEXT) {
    drawText(displayedText, canvas.width / 2, y, size, color, "center");
}

/*
 * Returns the largest size, at most size, at which displayedText fits on one line of maxWidth.
 */
export function fittedSize(displayedText, size, maxWidth) {
    setFont(size);
    const width = ctx.measureText(displayedText).width;
    return width <= maxWidth ? size : Math.floor(size * maxWidth / width);
}

/*
 * Splits displayedText into lines that fit in maxWidth, word by word, at the given size.
 */
export function wrapLines(displayedText, size, maxWidth) {
    setFont(size);
    const lines = [];
    let current = "";

    displayedText.split(" ").forEach((word) => {
        const attempt = current ? `${current} ${word}` : word;

        if (current && ctx.measureText(attempt).width > maxWidth) {
            lines.push(current);
            current = word;
        } else {
            current = attempt;
        }
    });

    lines.push(current);
    return lines;
}

/*
 * Writes displayedText centred from y, over as many lines as needed (30 px margin on each side).
 * Returns the y just below the last line: the portrait screen thus stacks its texts one under the other.
 */
export function drawWrappedText(displayedText, y, size = 30, color = TEXT) {
    const lineHeight = Math.round(size * 1.3);
    const lines = wrapLines(displayedText, size, canvas.width - 60);

    lines.forEach((lineText, index) => {
        drawCenteredText(lineText, y + index * lineHeight, size, color);
    });

    return y + lines.length * lineHeight;
}

/*
 * Draws a rectangle of the given width/height, with the requested radius.
 * fill and border are independent: null allows omitting either of them.
 */
export function roundedRect(x, y, width, height, radius, fill, border = null, thickness = 1) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);

    if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
    }

    if (border) {
        ctx.lineWidth = thickness;
        ctx.strokeStyle = border;
        ctx.stroke();
    }
}

/*
 * Draws a segment between two points [x, y], with the requested colour and thickness.
 */
export function drawLine(from, to, color, thickness = 5) {
    ctx.beginPath();
    ctx.moveTo(from[0], from[1]);
    ctx.lineTo(to[0], to[1]);
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.stroke();
}
