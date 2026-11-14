/*
 * Turns the player's actions into calls to the rules, without copying those rules.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
import { canvas } from "./canvas.js";
import { KEY_DIRECTIONS } from "./constants.js";
import { chooseDirection } from "./geometry.js";
import { newGame, pauseIfPlaying, backToMenu } from "./rules.js";
import { state } from "./state.js";

/*
 * Installs the game's keyboard and mouse listeners once.
 * Each event checks the current state before triggering an action.
 */
export function initControls() {
    window.addEventListener("keydown", function(event) {
        /*
         * Lets browser or system shortcuts use these modifier keys.
         */
        if (event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }

        /*
         * Skip link focused: Enter follows the link to the game, without starting a game.
         */
        if (event.target.closest?.(".skip-link")) {
            return;
        }

        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) {
            /*
             * Prevents the native action tied to this key, for example scrolling the page.
             */
            event.preventDefault();
        }

        if (event.key === "Escape") {
            event.preventDefault();
            backToMenu();
            return;
        }

        if (state.phase === "menu" && event.key === "Enter") {
            event.preventDefault();
            newGame();
            return;
        }

        if (state.phase === "over" && event.key === "Enter") {
            event.preventDefault();
            newGame();
            return;
        }

        if (state.phase !== "playing") {
            return;
        }

        if (event.key === " ") {
            state.paused = !state.paused;
            state.lastStepTime = performance.now();
            return;
        }

        const newDirection = KEY_DIRECTIONS[event.key];

        if (newDirection && !state.paused) {
            /*
             * A turn is already waiting for the next step: the next key is kept for the step after,
             * otherwise a quick double turn (right, up, left) would lose the first key.
             */
            if (state.requestedDirection !== state.direction) {
                state.nextDirection = chooseDirection(state.requestedDirection, newDirection);
            } else {
                state.requestedDirection = chooseDirection(state.direction, newDirection);
            }
        }
    });

    canvas.addEventListener("click", function() {
        canvas.focus();
        if (state.phase === "playing" && state.paused) {
            state.paused = false;
            state.lastStepTime = performance.now();
        }
    });

    // -------------------- AUTOMATIC PAUSE --------------------

    window.addEventListener("blur", pauseIfPlaying);

    document.addEventListener("visibilitychange", function() {
        if (document.hidden) {
            pauseIfPlaying();
        }
    });
}
