/*
 * Fixed settings: dimensions, colours and limits. Drawing distances are in pixels.
 * Colours are named after their role in the game; their values are read from the site variables.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
// -------------------- CONSTANTS --------------------

import { siteColor } from "../theme.js";
import { language } from "./translations.js";

/*
 * Colours of css/base/tokens.css: --white (off-white of the text), --ink (near-black), --red-card (background of the game page).
 * The second number is the opacity: 0.95 gives a muted white, 0.10 a light veil.
 * Contrasts on --red-card: muted text 5.0, 4.67 on the light boxes (4.5 required for text),
 * --ink strokes 3.25 (3 required for drawings);
 * no blue on the red board (blue is the colour of the My background page).
 */
export const TEXT = siteColor("--white");
export const TEXT_MUTED = siteColor("--white", 0.95);
export const GALLOWS_COLOR = siteColor("--white", 0.85);
/* Hanged man, frame of the temporary message, last third of the penalty bar */
export const INK = siteColor("--ink");
export const ACCENT = siteColor("--white");
export const BAR_MEDIUM = siteColor("--white", 0.6);
/* Key of a letter found in the word: light key, letter in --ink (5.1 on the key) */
export const KEY_FOUND = siteColor("--white", 0.35);
export const KEY_FOUND_TEXT = siteColor("--ink");
/* Key of a letter missing from the word: dark key, letter in --white (14.7 on the key) */
export const KEY_MISSED = siteColor("--ink", 0.7);
export const MESSAGE_BACKGROUND = siteColor("--red-card");
export const BACKGROUND = siteColor("--red-card");
export const BACKGROUND_LIGHT = siteColor("--white", 0.10);
export const WIN_BACKGROUND = siteColor("--red-card");
export const LOSS_BACKGROUND = siteColor("--red-card");

export const MAX_PENALTIES = 12;
/* The drawn keyboard follows the language: AZERTY in French, QWERTY in English */
export const KEYBOARD_ROWS = language === "en" ? ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"] : ["AZERTYUIOP", "QSDFGHJKLM", "WXCVBN"];
/*
 * Layout of the drawn keyboard: top-left corner, total width, key size and gap between keys.
 * LANDSCAPE keeps the original values (canvas 1200 x 800); PORTRAIT is for narrow screens (canvas 600 x 900).
 */
export const KEYBOARD_LANDSCAPE = { x: 620, y: 250, width: 532, keyWidth: 46, keyHeight: 50, gap: 8 };
export const KEYBOARD_PORTRAIT = { x: 30, y: 545, width: 540, keyWidth: 48, keyHeight: 58, gap: 6 };
/*
 * The word lists differ: one record per language. Both storage keys are kept as they were
 * (visitors' records are stored under them; the "meilleur_score" part is French by history, not displayed).
 */
export const SCORE_KEY = language === "en" ? "pendu_meilleur_score_en" : "pendu_meilleur_score";
/* Longest word of the lists: 13 letters; beyond that, the typed text would leave its box */
export const INPUT_MAX = 16;
