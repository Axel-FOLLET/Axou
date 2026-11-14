/*
 * Entry point: connects the modules then starts the interactions in the stated order.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
import { waitForFont } from "../theme.js";
import { animation } from "./animation.js";
import { canvas } from "./canvas.js";
import { initControls } from "./controls.js";
import { prepareNewWord } from "./rules.js";

prepareNewWord();
initControls();
/*
 * await suspends this module until Manrope has loaded (3 s at most): the first drawing uses the site font.
 */
await waitForFont();
requestAnimationFrame(animation);
/*
 * Inside the portfolio card (iframe), schedules the focus after the synchronous start-up work, once the canvas has been added:
 * the keyboard goes straight to the game. Opened alone, the page leaves the first press of Tab to the skip link.
 */
if (window.self !== window.top) setTimeout(() => canvas.focus(), 0);
