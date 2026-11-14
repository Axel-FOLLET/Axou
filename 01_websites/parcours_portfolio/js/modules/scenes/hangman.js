/*
 * Hangman card scene: the gallows is built stroke by stroke, then the hidden word is found letter by letter.
 * Contract (card-scenes.js): createScene(media, options) returns { play(), finish() }.
 * - Before the first play(), the scene already shows its final state (gallows built, word found).
 * - play() runs once from the start (about 2.4 s) and ends on that final state; a new call restarts it.
 * - finish() jumps to the final state without motion.
 * Everything is drawn in one decorative SVG (aria-hidden) that replaces the card pictogram,
 * which stays in the HTML as the fallback without JavaScript. Colors come from css/base/tokens.css.
 * The top of the drawing stays empty: the hover sprite of motion.css runs there.
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const VIEW_WIDTH = 290;
const VIEW_HEIGHT = 206;
const EASE_OUT = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const EASE_IN_OUT = "cubic-bezier(0.6, 0, 0.2, 1)";
const FONT = "Manrope, system-ui, sans-serif";

/* Word to find and the order of the guessed letters: a guess reveals every copy of its letter, as in the game */
const WORDS = {
    fr: { word: "PENDU", guesses: "ENUPD" },
    en: { word: "HANGMAN", guesses: "ANHGM" }
};

/* Gallows strokes, in drawing order: [path, start (ms), duration (ms)], as in js/games/pendu/artwork.js */
const GALLOWS = [
    ["M24 178H122", 0, 380],
    ["M48 178V22", 260, 460],
    ["M48 22H118", 640, 340],
    ["M48 50L76 22", 880, 260],
    ["M118 22V44", 1060, 220]
];

/* Noose: a small loop drawn after the rope */
const NOOSE = { cx: 118, cy: 54, rx: 6.5, ry: 10, start: 1220, duration: 300 };

/* Letters: area on the right of the gallows, and timing of the guesses */
const WORD_AREA = { left: 140, right: 280, baseline: 110, dashGap: 9 };
const GUESS_START = 1240;
const GUESS_STEP = 230;
const LETTER_DURATION = 320;

/* stroke-dasharray "1 2" with pathLength 1: an offset of 1.01 hides the whole stroke, 0 shows it */
const HIDDEN_OFFSET = 1.01;


function svg(name, attributes = {}, style = {}) {
    const element = document.createElementNS(SVG_NS, name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    Object.assign(element.style, style);
    return element;
}


/* A stroke that can be drawn from its start to its end by animating stroke-dashoffset */
function drawableStyle(width) {
    return {
        fill: "none",
        stroke: "var(--white)",
        strokeWidth: String(width),
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeDasharray: "1 2",
        strokeDashoffset: "0"
    };
}


export function createScene(media, options = {}) {
    const { word, guesses } = WORDS[options.language] ?? WORDS.fr;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const root = svg("svg", {
        class: "card-scene card-scene--hangman",
        viewBox: `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`,
        preserveAspectRatio: "xMidYMid meet",
        "aria-hidden": "true",
        focusable: "false"
    }, {
        display: "block",
        flex: "1 1 auto",
        width: "100%",
        height: "100%",
        minWidth: "0",
        overflow: "hidden",
        /* Decorative: drags and clicks go to the card, letters are not selectable */
        pointerEvents: "none",
        userSelect: "none"
    });

    /* Gallows: each stroke is drawn in turn */
    const strokes = GALLOWS.map(([path, start, duration]) => {
        const element = svg("path", { d: path, pathLength: "1" }, drawableStyle(2.4));
        root.append(element);
        return { element, start, duration };
    });

    const noose = svg("ellipse", {
        cx: NOOSE.cx, cy: NOOSE.cy, rx: NOOSE.rx, ry: NOOSE.ry, pathLength: "1"
    }, drawableStyle(1.8));
    root.append(noose);

    /* Word: one slot per letter, a dash under each one */
    const slot = Math.min(26, (WORD_AREA.right - WORD_AREA.left) / word.length);
    const fontSize = Math.round(slot * 0.82);
    const firstX = (WORD_AREA.left + WORD_AREA.right) / 2 - (slot * word.length) / 2;

    const letters = [...word].map((letter, index) => {
        const centerX = firstX + slot * index + slot / 2;
        const dashY = WORD_AREA.baseline + WORD_AREA.dashGap;

        const dash = svg("path", {
            d: `M${centerX - slot * 0.34} ${dashY}H${centerX + slot * 0.34}`,
            pathLength: "1"
        }, { ...drawableStyle(1.6), stroke: "var(--line-strong)" });

        const glyph = svg("text", {
            x: centerX,
            y: WORD_AREA.baseline,
            "text-anchor": "middle"
        }, {
            fill: "var(--white)",
            fontFamily: FONT,
            fontWeight: "700",
            fontSize: `${fontSize}px`
        });
        glyph.textContent = letter;

        root.append(dash, glyph);
        return { letter, index, dash, glyph };
    });

    /* The card pictogram stays in the HTML as the fallback; the scene takes its place */
    media.querySelector(".project-card__icon")?.style.setProperty("display", "none");
    media.append(root);

    let animations = [];

    function stop() {
        animations.forEach((animation) => animation.cancel());
        animations = [];
    }

    /* fill "backwards" keeps the first keyframe during the delay; once over, the static final state shows again */
    function animate(element, keyframes, delay, duration, easing = EASE_IN_OUT) {
        animations.push(element.animate(keyframes, { delay, duration, easing, fill: "backwards" }));
    }

    function play() {
        stop();

        if (reducedMotion.matches) {
            return;
        }

        strokes.forEach(({ element, start, duration }) => {
            animate(element, [{ strokeDashoffset: HIDDEN_OFFSET }, { strokeDashoffset: 0 }], start, duration);
        });
        animate(noose, [{ strokeDashoffset: HIDDEN_OFFSET }, { strokeDashoffset: 0 }], NOOSE.start, NOOSE.duration);

        letters.forEach(({ letter, index, dash, glyph }) => {
            animate(dash, [{ strokeDashoffset: HIDDEN_OFFSET }, { strokeDashoffset: 0 }], 120 + index * 60, 320, EASE_OUT);

            const guess = guesses.indexOf(letter);
            animate(glyph, [
                { opacity: 0, transform: "translateY(-10px)" },
                { opacity: 1, transform: "translateY(0)" }
            ], GUESS_START + guess * GUESS_STEP, LETTER_DURATION, EASE_OUT);
        });
    }

    /* The static drawing is the final state: cancelling every animation shows it at once */
    function finish() {
        stop();
    }

    return { play, finish };
}
