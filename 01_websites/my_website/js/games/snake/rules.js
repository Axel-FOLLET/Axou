/*
 * Rules and state changes of the game; drawing is left to the other modules.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
import { reducedMotion } from "../theme.js";
import { APPLES_PER_LEVEL, MAX_SPEED, RIGHT, START_SPEED } from "./constants.js";
import { createExplosion } from "./effects.js";
import { bitesItself, createSnake, isOutOfGrid, placeApple, sameCell } from "./geometry.js";
import { state } from "./state.js";
import { readBestScore, updateBestScore } from "./storage.js";

/*
 * Resets snake, direction, apple, score and animation, then starts the game.
 */
export function newGame() {
    state.snake = createSnake();
    state.direction = RIGHT;
    state.requestedDirection = RIGHT;
    state.nextDirection = null;
    state.apple = placeApple(state.snake);
    state.score = 0;
    state.newRecord = false;
    state.won = false;
    state.paused = false;
    state.particles = [];
    state.lastStepTime = performance.now();
    state.phase = "playing";
}

/*
 * Resets the round data and goes back to the welcome screen.
 */
export function backToMenu() {
    state.snake = createSnake();
    state.direction = RIGHT;
    state.requestedDirection = RIGHT;
    state.nextDirection = null;
    state.apple = placeApple(state.snake);
    state.score = 0;
    state.newRecord = false;
    state.won = false;
    state.paused = false;
    state.particles = [];
    state.phase = "menu";
}

/*
 * Returns the number of moves per second.
 * Each level of apples raises the speed, without going above MAX_SPEED.
 */
export function computeSpeed() {
    return Math.min(MAX_SPEED, START_SPEED + Math.floor(state.score / APPLES_PER_LEVEL));
}

/*
 * Adds the direction vector to the coordinates of the current head.
 */
export function computeNewHead() {
    return [
        state.snake[0][0] + state.direction[0],
        state.snake[0][1] + state.direction[1]
    ];
}

/*
 * Performs one move: new head, possible removal of the tail, collisions and apple.
 */
export function advanceGame() {
    state.direction = state.requestedDirection;
    if (state.nextDirection) {
        state.requestedDirection = state.nextDirection;
        state.nextDirection = null;
    }

    const newHead = computeNewHead();
    const ate = sameCell(newHead, state.apple);
    /*
     * The spread copies the cells into a new array, adding the head in front.
     */
    const newSnake = [newHead, ...state.snake];

    if (!ate) {
        /*
         * Without an apple, removing the tail keeps the length and frees its cell before the collision test.
         */
        newSnake.pop();
    }

    state.snake = newSnake;

    if (isOutOfGrid(state.snake[0]) || bitesItself(state.snake)) {
        endGame(false);
        return;
    }

    if (ate) {
        state.score += 1;
        state.apple = placeApple(state.snake);

        if (state.apple === null) {
            endGame(true);
        }
    }
}

/*
 * won tells whether the game is won.
 * Saves the result useful for the score then selects the end screen.
 */
export function endGame(won) {
    state.won = won;
    state.newRecord = updateBestScore(state.score);
    state.bestScore = readBestScore();
    state.phase = "over";
    state.paused = false;

    /* Record fireworks, except with the "reduce animations" setting: the record text is enough */
    if (state.newRecord && !reducedMotion.matches) {
        state.particles = createExplosion(300, 200);
    }
}

/*
 * Pauses only a game in progress, notably when the window loses focus.
 */
export function pauseIfPlaying() {
    if (state.phase === "playing") {
        state.paused = true;
    }
}
