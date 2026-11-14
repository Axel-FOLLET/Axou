/*
 * Entry point: links the modules then starts the interactions in the order given.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
import { waitForFont } from "../theme.js";
import { animation } from "./animation.js";
import { canvas } from "./canvas.js";
import { initControls } from "./controls.js";
import { backToMenu } from "./rules.js";
import { state } from "./state.js";
import { readBestScore } from "./storage.js";

state.bestScore = readBestScore();
backToMenu();
initControls();
/*
 * await suspends this module until Manrope has loaded (3 s at most): the first drawing uses the site font.
 */
await waitForFont();
requestAnimationFrame(animation);
/*
 * Inside the portfolio card (iframe), schedules the focus after the synchronous start-up work, once the canvas is added:
 * the keyboard goes straight to the game. Opened alone, the page leaves the first press of Tab to the skip link.
 */
if (window.self !== window.top) setTimeout(() => canvas.focus(), 0);
