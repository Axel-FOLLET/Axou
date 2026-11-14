/*
 * Shared game state: the other modules read and modify this same object.
 * const prevents replacing the object, but does not prevent changing its properties.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
import { RIGHT } from "./constants.js";

export const state = {
    /*
     * Array of cells [column, row]; index 0 = head.
     */
    snake: [],
    /*
     * Direction applied at the last move.
     */
    direction: RIGHT,
    /*
     * Direction received from the keyboard, applied at the next move.
     */
    requestedDirection: RIGHT,
    /*
     * Second key received before the next step, applied at the step after; null otherwise.
     */
    nextDirection: null,
    /*
     * Cell of the apple, or null when no room is left.
     */
    apple: null,
    /*
     * Number of apples eaten during this round.
     */
    score: 0,
    /*
     * Record read from local storage.
     */
    bestScore: 0,
    /*
     * Triggers the decorative effects if the record has just been beaten.
     */
    newRecord: false,
    /*
     * Result of the last game over.
     */
    won: false,
    /*
     * Timestamp of the snake's last move.
     */
    lastStepTime: 0,
    /*
     * Current screen: "menu", "playing" or "over".
     */
    phase: "menu",
    /*
     * Stops the moves without deleting the game.
     */
    paused: false,
    /*
     * Active particles of the fireworks.
     */
    particles: [],
    /*
     * Timestamp of the last frame, to compute the elapsed time.
     */
    previousTime: performance.now()
};
