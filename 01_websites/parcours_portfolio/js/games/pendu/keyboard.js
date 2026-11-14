/*
 * Keyboard drawn in the canvas: its clickable zones are stored separately.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
import { BACKGROUND_LIGHT, KEYBOARD_ROWS, TEXT, TEXT_MUTED, KEY_MISSED, KEY_FOUND, KEY_FOUND_TEXT } from "./constants.js";
import { roundedRect, drawText } from "./drawing.js";
import { state } from "./state.js";

/*
 * Returns the colour of the letter according to its state: not tried, present or absent.
 */
export function keyColor(letter) {
    const lower = letter.toLowerCase();

    if (!state.triedLetters.has(lower)) {
        return BACKGROUND_LIGHT;
    }

    return state.word.includes(lower) ? KEY_FOUND : KEY_MISSED;
}

/*
 * Returns the colour of the letter drawn on a key: --ink on the light key of a found letter, off-white otherwise.
 */
export function keyTextColor(letter) {
    const lower = letter.toLowerCase();
    return state.triedLetters.has(lower) && state.word.includes(lower) ? KEY_FOUND_TEXT : TEXT;
}

/*
 * Draws the rows of letters according to layout (KEYBOARD_LANDSCAPE or KEYBOARD_PORTRAIT of constants.js)
 * and stores their rectangles in keyZones.
 * The controls module reuses these rectangles to know which key was clicked.
 */
export function drawKeyboard(layout) {
    const { x: keyboardX, y: keyboardY, width: keyboardWidth, keyWidth, keyHeight, gap } = layout;
    state.keyZones = [];

    KEYBOARD_ROWS.forEach((keyboardRow, rowIndex) => {
        const rowWidth = keyboardRow.length * (keyWidth + gap) - gap;
        const startX = keyboardX + (keyboardWidth - rowWidth) / 2;
        const y = keyboardY + rowIndex * (keyHeight + gap);

        [...keyboardRow].forEach((letter, index) => {
            const x = startX + index * (keyWidth + gap);

            roundedRect(
                x,
                y,
                keyWidth,
                keyHeight,
                8,
                keyColor(letter),
                TEXT_MUTED,
                2
            );

            /* 30 px letter centred vertically: 10 px above in a 50 px key */
            drawText(letter, x + keyWidth / 2, y + (keyHeight - 30) / 2, 30, keyTextColor(letter), "center");

            state.keyZones.push({
                letter: letter.toLowerCase(),
                x: x,
                y: y,
                width: keyWidth,
                height: keyHeight
            });
        });
    });
}
