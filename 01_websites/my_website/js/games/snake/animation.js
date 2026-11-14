/*
 * Render loop: requestAnimationFrame calls the function again before a next frame.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
import { reducedMotion } from "../theme.js";
import { updateFireworks } from "./effects.js";
import { advanceGame, computeSpeed } from "./rules.js";
import { drawScreen } from "./screens.js";
import { state } from "./state.js";

/*
 * Draws the current frame then schedules the next one with requestAnimationFrame.
 * The browser chooses the frame rhythm; this is not a blocking loop.
 */
export function animation(now) {
    /*
     * Limits the gap between frames to 100 ms for the effects after an interruption.
     */
    const deltaMs = Math.min(now - state.previousTime, 100);
    /*
     * 1000 / 60 is the duration of a frame at 60 Hz; the ratio adjusts the particles to the elapsed time.
     */
    const deltaFrames = deltaMs / (1000 / 60);
    state.previousTime = now;

    if (state.phase === "playing" && !state.paused) {
        /*
         * Converts moves per second into milliseconds between two moves.
         */
        const delay = 1000 / computeSpeed();

        if (now - state.lastStepTime >= delay) {
            state.lastStepTime = now;
            advanceGame();
        }
    } else if (state.phase === "over" && state.newRecord && !reducedMotion.matches) {
        updateFireworks(deltaFrames);
    }

    drawScreen();
    requestAnimationFrame(animation);
}
