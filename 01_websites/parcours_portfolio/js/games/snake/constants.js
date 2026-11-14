/*
 * Fixed settings: dimensions, colours and limits. Drawing distances are in pixels.
 * Colours are named after their role in the game; their values are read from the site variables.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
// -------------------- CONSTANTS --------------------

import { siteColor } from "../theme.js";

export const CELL_SIZE = 30;
export const GRID_SIZE = 20;
export const BANNER_HEIGHT = 60;
export const CANVAS_WIDTH = 600;
export const CANVAS_HEIGHT = 660;

/*
 * Colours of css/base/tokens.css: --ink (board), --ink-raised (score banner), --white (off-white text),
 * --red-accent (apple, tongue, defeat), --line-strong (frame), --ink at 60% (pause veil).
 * The two greens are in css/base/tokens.css too, section "Games" (--snake-green, --snake-green-head).
 * The second number is the opacity: 0.6 gives a muted white, 0.04 a barely visible veil.
 */
export const WHITE = siteColor("--white");
export const BOARD = siteColor("--ink");
export const BANNER = siteColor("--ink-raised");
export const MUTED_TEXT = siteColor("--white", 0.6);
/* Checker cells: decoration only, the frame and the objects carry the information */
export const CELL_LIGHT = siteColor("--white", 0.06);
export const CELL_DARK = siteColor("--white", 0.02);
/* Frame of the playing field: shows where the walls are */
export const FIELD_FRAME = siteColor("--line-strong");
/* Titles, frames and the banner rule */
export const ACCENT = siteColor("--snake-green");
export const DEFEAT = siteColor("--red-accent");
export const SNAKE_BODY = siteColor("--snake-green");
export const SNAKE_HEAD = siteColor("--snake-green-head");
/* Outline of the segments and eyes: the board colour, so the segments are cut apart */
export const SNAKE_OUTLINE = siteColor("--ink");
export const EYE_WHITE = siteColor("--white");
export const EYE_PUPIL = siteColor("--ink");
export const APPLE_COLOR = siteColor("--red-accent");
export const APPLE_STEM = siteColor("--white", 0.7);
export const APPLE_LEAF = siteColor("--snake-green");
export const TONGUE_COLOR = siteColor("--red-accent");
export const STAR_COLOR = siteColor("--white");
/* Dark veil of the pause screen: the game stays readable under it, the text on top keeps its contrast */
export const PAUSE_VEIL = siteColor("--ink", 0.6);

export const FIREWORK_COLORS = [
    siteColor("--snake-green"),
    siteColor("--red-accent"),
    siteColor("--white")
];

export const PARTICLES_PER_EXPLOSION = 40;
export const PARTICLE_LIFETIME = 60;
export const PARTICLE_GRAVITY = 0.08;
export const EXPLOSION_CHANCE = 0.04;

export const UP = [0, -1];
export const DOWN = [0, 1];
export const LEFT = [-1, 0];
export const RIGHT = [1, 0];

export const START_SPEED = 6;
export const MAX_SPEED = 15;
export const APPLES_PER_LEVEL = 3;
/* Local storage key of the record: unchanged so that existing records are kept */
export const SCORE_KEY = "snake_meilleur_score";

export const KEY_DIRECTIONS = {
    ArrowUp: UP,
    ArrowDown: DOWN,
    ArrowLeft: LEFT,
    ArrowRight: RIGHT,
    z: UP,
    Z: UP,
    w: UP,
    W: UP,
    s: DOWN,
    S: DOWN,
    q: LEFT,
    Q: LEFT,
    a: LEFT,
    A: LEFT,
    d: RIGHT,
    D: RIGHT
};
