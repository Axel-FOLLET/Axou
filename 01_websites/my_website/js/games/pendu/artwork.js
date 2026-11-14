/*
 * Drawings specific to the game, built with the canvas primitives.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
import { ctx } from "./canvas.js";
import { ACCENT, BAR_MEDIUM, INK, GALLOWS_COLOR, BACKGROUND_LIGHT, MAX_PENALTIES, TEXT } from "./constants.js";
import { drawLine, roundedRect } from "./drawing.js";
import { state } from "./state.js";

/*
 * Draws the segments whose penalty threshold has been reached.
 * Each entry contains [threshold, start point, end point].
 */
export function drawGallows() {
    const segments = [
        [1, [150, 500], [250, 500]],
        [2, [250, 500], [350, 500]],
        [3, [200, 500], [200, 100]],
        [4, [200, 100], [300, 100]],
        [5, [200, 130], [240, 100]],
        [6, [300, 100], [300, 150]]
    ];

    segments.forEach(([threshold, from, to]) => {
        if (state.penalty >= threshold) {
            drawLine(from, to, GALLOWS_COLOR, 5);
        }
    });
}

/*
 * Progressively adds the head then the limbs from seven penalties.
 */
export function drawFigure() {
    if (state.penalty >= 7) {
        ctx.beginPath();
        ctx.arc(300, 200, 50, 0, Math.PI * 2);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 5;
        ctx.stroke();
    }

    const segments = [
        [8, [300, 250], [300, 400]],
        [9, [300, 260], [250, 310]],
        [10, [300, 260], [350, 310]],
        [11, [300, 400], [250, 450]],
        [12, [300, 400], [350, 450]]
    ];

    segments.forEach(([threshold, from, to]) => {
        if (state.penalty >= threshold) {
            drawLine(from, to, INK, 5);
        }
    });
}

/*
 * Draws the small logo of the home screen from a horizontal centre and a top.
 */
export function drawHangmanLogo(centerX, top) {
    const left = centerX - 30;
    const bottom = top + 70;

    drawLine([left - 15, bottom], [left + 45, bottom], GALLOWS_COLOR, 5);
    drawLine([left, bottom], [left, top], GALLOWS_COLOR, 5);
    drawLine([left, top], [left + 50, top], GALLOWS_COLOR, 5);
    drawLine([left, top + 20], [left + 20, top], GALLOWS_COLOR, 4);
    drawLine([left + 50, top], [left + 50, top + 22], TEXT, 3);

    ctx.beginPath();
    ctx.arc(left + 50, top + 32, 10, 0, Math.PI * 2);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();
}

/*
 * Picks the colour according to the penalty ratio, between 0 and 1.
 */
export function barColor(ratio) {
    if (ratio < 1 / 3) {
        return ACCENT;
    }

    if (ratio < 2 / 3) {
        return BAR_MEDIUM;
    }

    return INK;
}

/*
 * Converts the proportion of penalties into a filled width.
 * Math.min keeps it from exceeding the total width of the bar.
 */
export function drawPenaltyBar(x, y, width, height) {
    const ratio = Math.min(state.penalty / MAX_PENALTIES, 1);

    roundedRect(x, y, width, height, 10, BACKGROUND_LIGHT);

    if (ratio > 0) {
        roundedRect(x, y, width * ratio, height, 10, barColor(ratio));
    }

    roundedRect(x, y, width, height, 10, null, TEXT, 2);
}
