/*
 * Translates the player's actions into calls to the rules, without copying these rules.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
import { touchScreen } from "../theme.js";
import { canvas } from "./canvas.js";
import { INPUT_MAX } from "./constants.js";
import { pointerCoordinates } from "./pointer.js";
import { startGame, replay, backToHome, handleGuess } from "./rules.js";
import { state } from "./state.js";

/*
 * Installs the keyboard and mouse listeners of the game, only once.
 * Each event checks the current state before triggering an action.
 */
export function initControls() {
    canvas.addEventListener("click", function(event) {
        canvas.focus();

        if (state.screen === "end") {
            replay();
            return;
        }

        /*
         * Without a physical keyboard (touch screen), touching the home screen starts the game, like ENTER.
         */
        if (state.screen === "home") {
            if (touchScreen.matches) startGame();
            return;
        }

        const mouse = pointerCoordinates(event);
        /*
         * find returns the first zone containing the click, or undefined if none matches.
         */
        const key = state.keyZones.find((zone) =>
            mouse.x >= zone.x
            && mouse.x <= zone.x + zone.width
            && mouse.y >= zone.y
            && mouse.y <= zone.y + zone.height
        );

        if (key) {
            handleGuess(key.letter);
        }
    });

    // -------------------- KEYBOARD --------------------

    window.addEventListener("keydown", function(event) {
        /*
         * Lets the browser or system shortcuts use these modifier keys.
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
            backToHome();
            return;
        }

        if (state.screen === "home") {
            if (event.key === "Enter") {
                event.preventDefault();
                startGame();
            }
            return;
        }

        if (state.screen === "end") {
            if (event.key === "Enter") {
                event.preventDefault();
                replay();
            }
            return;
        }

        if (event.key === "Backspace") {
            event.preventDefault();
            /*
             * slice(0, -1) keeps all the characters except the last one.
             */
            state.input = state.input.slice(0, -1);
            return;
        }

        if (event.key === "Enter") {
            event.preventDefault();
            const guess = state.input;
            state.input = "";
            handleGuess(guess);
            return;
        }

        if (/^[A-Za-zÀ-ÖØ-öø-ÿ]$/u.test(event.key)) {
            event.preventDefault();
            if (state.input.length < INPUT_MAX) state.input += event.key;
        }
    });


}
