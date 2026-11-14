/*
 * Composition of the screens: each frame is redrawn from the current state.
 * Two layouts: landscape (canvas 1200 x 800, original values) and portrait (600 x 900, narrow screens).
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
import { touchScreen, reducedMotion } from "../theme.js";
import { drawPenaltyBar, drawFigure, drawHangmanLogo, drawGallows } from "./artwork.js";
import { canvas, ctx, portrait } from "./canvas.js";
import { ACCENT, INK, KEYBOARD_LANDSCAPE, KEYBOARD_PORTRAIT, GALLOWS_COLOR, BACKGROUND, BACKGROUND_LIGHT, LOSS_BACKGROUND, MESSAGE_BACKGROUND, WIN_BACKGROUND, MAX_PENALTIES, TEXT, TEXT_MUTED } from "./constants.js";
import { drawLine, setFont, roundedRect, fittedSize, drawText, drawCenteredText, drawWrappedText } from "./drawing.js";
import { drawKeyboard } from "./keyboard.js";
import { maskedWord } from "./rules.js";
import { state } from "./state.js";
import { t } from "./translations.js";

/*
 * Draws the gallows and the hanged man (traced in the landscape frame: x 150 to 350, y 100 to 500)
 * reduced by a factor scale, the point (250, 100) of the drawing placed at (centerX, top).
 */
function drawScaledHangman(centerX, top, scale) {
    /*
     * Stores the context settings before a local transformation; restore then brings them back.
     */
    ctx.save();
    ctx.translate(centerX - 250 * scale, top - 100 * scale);
    ctx.scale(scale, scale);
    drawGallows();
    drawFigure();
    ctx.restore();
}

/*
 * Input area: the label, then the box over the rest of the line (400 px at most) with the cursor.
 * y is the top of the box; left and right are the margins of the canvas.
 */
function drawInput(left, y, right) {
    setFont(30);
    const boxX = Math.max(portrait.matches ? 0 : 260, left + ctx.measureText(t.proposal).width + 20);
    const boxWidth = Math.min(400, canvas.width - right - boxX);

    drawText(t.proposal, left, y + 13, 30, TEXT);

    roundedRect(boxX, y, boxWidth, 42, 8, BACKGROUND_LIGHT, GALLOWS_COLOR, 3);
    drawText(state.input.toUpperCase(), boxX + 12, y + 9, 30, TEXT);

    /*
     * Alternates every 500 ms to make the input cursor blink;
     * with the "reduce animations" setting, the cursor stays displayed.
     */
    if (reducedMotion.matches || Math.floor(performance.now() / 500) % 2 === 0) {
        setFont(30);
        const inputWidth = ctx.measureText(state.input.toUpperCase()).width;
        const cursorX = boxX + 14 + inputWidth;
        drawLine([cursorX, y + 8], [cursorX, y + 34], TEXT, 2);
    }
}

/*
 * Centred temporary message (letter already tried, invalid entry); it disappears at state.messageEnd.
 * On a narrow canvas, the text shrinks to fit its frame.
 */
function drawMessage(y) {
    if (state.message && performance.now() <= state.messageEnd) {
        const size = fittedSize(state.message, 30, canvas.width - 80);
        setFont(size);
        const width = ctx.measureText(state.message).width;
        const frameWidth = width + 40;
        const frameX = (canvas.width - frameWidth) / 2;

        roundedRect(frameX, y, frameWidth, 50, 10, MESSAGE_BACKGROUND, INK, 2);
        drawCenteredText(state.message, y + 10 + (30 - size) / 2, size, TEXT);
    } else if (state.message) {
        state.message = "";
    }
}

/*
 * Composes the home screen: background, illustration, rules and the command to start.
 * On a touch screen, the instruction talks about touching the screen, and the line about Escape disappears.
 */
export function showHome() {
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawHangmanLogo(canvas.width / 2, 25);
    const instruction = touchScreen.matches ? t.startTouch : t.start;

    if (portrait.matches) {
        let y = drawWrappedText(t.title, 120, 44, TEXT);
        y = drawWrappedText(t.subtitle, y + 16, 30, TEXT);

        /* Rules in a frame: each rule can take two lines, the frame follows their height */
        const top = y + 30;
        y = top + 24;
        [t.penaltiesAllowed, t.badLetter, t.badWord, t.wordLength(state.word.length)].forEach((rule) => {
            y = drawWrappedText(rule, y, 28, TEXT) + 10;
        });
        roundedRect(30, top, canvas.width - 60, y + 14 - top, 14, null, GALLOWS_COLOR, 4);

        y = drawWrappedText(instruction, y + 60, 30, ACCENT);
        if (!touchScreen.matches) drawWrappedText(t.escapeWelcome, y + 14, 24, TEXT_MUTED);
        return;
    }

    drawCenteredText(t.title, 120, 50, TEXT);
    drawCenteredText(t.subtitle, 190, 30, TEXT);

    roundedRect(300, 245, 600, 205, 14, null, GALLOWS_COLOR, 4);
    drawCenteredText(t.penaltiesAllowed, 270, 30, TEXT);
    drawCenteredText(t.badLetter, 320, 30, TEXT);
    drawCenteredText(t.badWord, 360, 30, TEXT);
    drawCenteredText(t.wordLength(state.word.length), 410, 30, TEXT);
    drawCenteredText(instruction, 520, 30, ACCENT);
    if (!touchScreen.matches) drawCenteredText(t.escapeWelcome, 570, 24, TEXT_MUTED);
}

/*
 * Redraws the game from state; the rules of the game are handled in rules.js.
 */
export function showGame() {
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const chances = t.chances(Math.max(MAX_PENALTIES - state.penalty, 0));

    if (portrait.matches) {
        /* From top to bottom: gauge and counters, reduced hanged man, word, keyboard, input, message */
        drawPenaltyBar(30, 30, canvas.width - 60, 26);
        drawText(chances, 30, 72, 30, TEXT);
        drawText(t.attempts(state.attemptCount), 30, 110, 30, TEXT_MUTED);

        drawScaledHangman(canvas.width / 2, 160, 0.7);

        const word = t.word(maskedWord());
        drawCenteredText(word, 470, fittedSize(word, 46, canvas.width - 60), TEXT);

        drawKeyboard(KEYBOARD_PORTRAIT);
        drawInput(30, 750, 30);
        drawMessage(820);
        return;
    }

    drawGallows();
    drawFigure();
    drawKeyboard(KEYBOARD_LANDSCAPE);

    drawPenaltyBar(KEYBOARD_LANDSCAPE.x, 85, KEYBOARD_LANDSCAPE.width, 26);
    drawText(chances, 620, 130, 30, TEXT);
    drawText(t.attempts(state.attemptCount), 620, 165, 30, TEXT_MUTED);

    drawText(t.word(maskedWord()), 50, 612, 46, TEXT);
    drawInput(50, 695, 0);
    drawMessage(540);
}

/*
 * Composes the win or loss screen with the result and the commands to play again.
 */
export function showEnd() {
    ctx.fillStyle = state.won ? WIN_BACKGROUND : LOSS_BACKGROUND;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const replayPrompt = touchScreen.matches ? t.replayTouch : t.replay;

    if (portrait.matches) {
        drawScaledHangman(canvas.width / 2, 30, 0.55);

        let y;
        if (state.won) {
            y = drawWrappedText(t.victory, 290, 44, ACCENT);
            y = drawWrappedText(t.survive, y + 16, 30, TEXT);
        } else {
            y = drawWrappedText(t.defeat, 290, 44, TEXT);
            y = drawWrappedText(t.badLuck, y + 16, 30, TEXT);
            y = drawWrappedText(t.hanged, y + 6, 30, TEXT);
        }

        y = drawWrappedText(state.scoreText, y + 30, 30, TEXT);
        y = drawWrappedText(t.wordWas(state.originalWord.toUpperCase()), y + 30, 30, TEXT);
        y = drawWrappedText(replayPrompt, y + 50, 30, ACCENT);
        if (!touchScreen.matches) drawWrappedText(t.escapeEnd, y + 14, 24, TEXT_MUTED);
        return;
    }

    /* The hanged man at full size, shifted 100 px to the left and 130 px down */
    drawScaledHangman(150, 230, 1);

    if (state.won) {
        drawCenteredText(t.victory, 150, 50, ACCENT);
        drawCenteredText(t.survive, 230, 30, TEXT);
        drawCenteredText(state.scoreText, 310, 30, TEXT);
    } else {
        drawCenteredText(t.defeat, 150, 50, TEXT);
        drawCenteredText(t.badLuck, 230, 30, TEXT);
        drawCenteredText(t.hanged, 280, 30, TEXT);
        drawCenteredText(state.scoreText, 350, 30, TEXT);
    }

    drawCenteredText(t.wordWas(state.originalWord.toUpperCase()), 450, 30, TEXT);
    drawCenteredText(replayPrompt, 535, 30, ACCENT);
    if (!touchScreen.matches) drawCenteredText(t.escapeEnd, 585, 24, TEXT_MUTED);
}

// -------------------- SPOKEN VERSION --------------------

/*
 * Live region of the page (pages/games/pendu.html): screen readers read each new text written into it.
 */
const liveRegion = document.getElementById("hangman-status");
let lastSpokenKey = "";

/*
 * Masked word for the ear: each found letter, and t.hidden ("tiret", "blank") for each hidden one.
 */
function spokenWord() {
    return [...state.word]
        .map((letter) => state.guessedLetters.has(letter) ? letter.toUpperCase() : t.hidden)
        .join(", ");
}

/*
 * Adds the final full stop that the texts drawn on the canvas do not always have.
 */
function asSentence(text) {
    return /[.!?]$/.test(text) ? text : `${text}.`;
}

/*
 * Text of the current screen: rules on the home screen; on the game screen, the latest feedback
 * (result of the last guess or temporary message, rules.js) or how to play, then the word, the chances
 * and the attempts; the result on the end screen.
 */
function spokenText() {
    if (state.screen === "home") {
        const instruction = touchScreen.matches ? t.startTouch : t.start;
        return [t.title, t.subtitle, t.penaltiesAllowed, t.badLetter, t.badWord, t.wordLength(state.word.length), instruction];
    }

    if (state.screen === "playing") {
        return [
            state.lastGuess || t.typeGuess,
            t.word(spokenWord()),
            t.chances(Math.max(MAX_PENALTIES - state.penalty, 0)),
            t.attempts(state.attemptCount)
        ];
    }

    const result = state.won ? [t.victory, t.survive] : [t.defeat, t.badLuck, t.hanged];
    const replayPrompt = touchScreen.matches ? t.replayTouch : t.replay;
    return [...result, state.scoreText, t.wordWas(state.originalWord.toUpperCase()), replayPrompt];
}

/*
 * Writes the text of the screen into the live region only when the game state changes
 * (screen, word, attempt, penalty, new message): drawn 60 times per second, the canvas would otherwise repeat it.
 */
function announce() {
    if (!liveRegion) return;
    const key = [state.screen, state.originalWord, state.attemptCount, state.penalty, state.messageEnd, touchScreen.matches].join("|");
    if (key === lastSpokenKey) return;
    lastSpokenKey = key;
    liveRegion.textContent = spokenText().map(asSentence).join(" ");
}

/*
 * Chooses the screen to draw according to state.screen: home, playing or end, then updates the spoken version.
 */
export function draw() {
    if (state.screen === "home") {
        showHome();
    } else if (state.screen === "playing") {
        showGame();
    } else {
        showEnd();
    }
    announce();
}
