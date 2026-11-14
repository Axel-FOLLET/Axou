/*
 * Screen composition: each frame is redrawn from the current state.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
import { touchScreen } from "../theme.js";
import { drawApple, drawBanner, drawGrid, drawLogoSnake, drawSnake } from "./artwork.js";
import { ctx } from "./canvas.js";
import { ACCENT, BANNER_HEIGHT, BOARD, CANVAS_HEIGHT, CANVAS_WIDTH, DEFEAT, MUTED_TEXT, PAUSE_VEIL, WHITE } from "./constants.js";
import { drawCenteredText, drawRoundedRect } from "./drawing.js";
import { drawParticles } from "./effects.js";
import { state } from "./state.js";
import { t } from "./translations.js";

/*
 * Composes the welcome screen: background, illustration, rules and the command to start.
 */
export function drawWelcomeScreen() {
    ctx.fillStyle = BOARD;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    drawLogoSnake([CANVAS_WIDTH / 2 - 14, 40]);
    drawCenteredText(t.welcome, 85, 38, ACCENT);
    drawRoundedRect(50, 150, CANVAS_WIDTH - 100, 270, 14, null, ACCENT, 4);

    t.rules.forEach((ruleLine, index) => {
        drawCenteredText(ruleLine, 182 + index * 38, 21, WHITE);
    });

    /* Touch screen without keyboard: the snake is only steered with a keyboard, the hint says so instead of "ENTER" */
    if (touchScreen.matches) {
        drawCenteredText(t.keyboardOnly, 470, 30, ACCENT);
        return;
    }

    drawCenteredText(t.start, 470, 30, ACCENT);
    drawCenteredText(t.escapeMenu, 520, 24, MUTED_TEXT);
}

/*
 * Redraws the game from state; the game rules are handled in rules.js.
 */
export function drawGameScreen() {
    ctx.fillStyle = BOARD;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    drawGrid();

    if (state.apple !== null) {
        drawApple(state.apple);
    }

    drawSnake();
    drawBanner();

    if (state.paused) {
        ctx.fillStyle = PAUSE_VEIL;
        ctx.fillRect(0, BANNER_HEIGHT, CANVAS_WIDTH, CANVAS_WIDTH);
        /* Above the snake's starting line (y 360 to 390): the text does not cover it at the start of a game */
        drawCenteredText(t.pause, 250, 50, ACCENT);
        drawCenteredText(t.resume, 310, 24, WHITE);
    }
}

/*
 * Composes the victory or defeat screen with the result and the commands to play again.
 */
export function drawEndScreen() {
    ctx.fillStyle = BOARD;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (state.newRecord) {
        drawParticles();
    }

    drawLogoSnake([CANVAS_WIDTH / 2 - 14, 45]);

    if (state.won) {
        drawCenteredText(t.victory, 100, 50, ACCENT);
        drawCenteredText(t.fullGrid, 170, 30, WHITE);
    } else {
        drawCenteredText(t.lost, 100, 50, DEFEAT);
        drawCenteredText(t.crashed, 170, 30, WHITE);
    }

    drawCenteredText(t.applesEaten(state.score), 250, 30, WHITE);
    drawCenteredText(state.newRecord ? t.newBest : t.best(state.bestScore), 300, 30, ACCENT);
    drawCenteredText(t.replay, 420, 30, ACCENT);
    drawCenteredText(t.escapeMenu, 470, 24, MUTED_TEXT);
}

/*
 * Chooses the screen to draw according to state.phase: menu, playing or over.
 */
export function drawScreen() {
    if (state.phase === "menu") {
        drawWelcomeScreen();
    } else if (state.phase === "playing") {
        drawGameScreen();
    } else {
        drawEndScreen();
    }
}
