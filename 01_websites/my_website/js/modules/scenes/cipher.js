/*
 * Caesar and Vigenère card scene: a cipher wheel rolls in, then encrypts a word with Vigenère, letter by letter.
 * For each letter, the inner ring turns until the key letter sits under "A" (the window at the top),
 * and the encrypted letter appears under the plain one. The result comes from js/tools/ciphers.js (real cipher).
 * Contract (card-scenes.js): createScene(media, options) returns { play(), finish() }.
 * - Before the first play(), the scene already shows its final state (word encrypted).
 * - play() runs once from the start (about 2.4 s) and ends on that final state; a new call restarts it.
 * - finish() jumps to the final state without motion.
 * Everything is drawn in one decorative SVG (aria-hidden) that replaces the card pictogram,
 * which stays in the HTML as the fallback without JavaScript. Colors come from css/base/tokens.css.
 * Every letter is plain --white (5.5:1 on --red-card): no opacity, so the text keeps the WCAG AA contrast.
 * The top of the drawing stays empty, like the other scenes (this card's hover effect is on the title words).
 */
import { vigenere } from "../../tools/ciphers.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const VIEW_WIDTH = 290;
const VIEW_HEIGHT = 206;
const EASE_OUT = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const EASE_IN_OUT = "cubic-bezier(0.6, 0, 0.2, 1)";
const FONT = "Manrope, system-ui, sans-serif";
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LETTER_ANGLE = 360 / 26;

/* The same plain word in both languages; the key is the word "key" of the page language */
const PLAIN = "SECRET";
const KEYS = { fr: "CLE", en: "KEY" };

/* Wheel: outer ring = plain alphabet, inner ring = cipher alphabet */
const WHEEL = { cx: 88, cy: 100, outer: 78, outerLetters: 66.5, split: 57, innerLetters: 47.5, inner: 38 };

/* Word columns, right of the wheel */
const COLUMN = { left: 176, width: 18 };
const ROWS = { label: 50, key: 79, plain: 108, rule: 120, cipher: 146 };

/* Timeline (ms): the wheel rolls in, then one letter every LETTER_STEP */
const ARRIVAL = 700;
const FIRST_LETTER = 760;
const LETTER_STEP = 230;
const TURN = 170;
const REVEAL_DELAY = 120;
const REVEAL = 260;


function svg(name, attributes = {}, style = {}) {
    const element = document.createElementNS(SVG_NS, name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    Object.assign(element.style, style);
    return element;
}


function text(content, attributes, style) {
    const element = svg("text", attributes, { fontFamily: FONT, fill: "var(--white)", ...style });
    element.textContent = content;
    return element;
}


/* Letters placed around the wheel centre, upright towards the outside */
function ringOfLetters(radius, fontSize, opacity) {
    const group = svg("g");
    [...ALPHABET].forEach((letter, index) => {
        group.append(text(letter, {
            x: WHEEL.cx,
            y: WHEEL.cy - radius,
            "text-anchor": "middle",
            "dominant-baseline": "central",
            transform: `rotate(${index * LETTER_ANGLE} ${WHEEL.cx} ${WHEEL.cy})`
        }, { fontSize: `${fontSize}px`, fontWeight: "600", opacity: String(opacity) }));
    });
    return group;
}


/*
 * Angle of the inner ring for each letter: the key letter comes under "A".
 * Each turn takes the shortest way from the previous angle (at most half a turn).
 */
function ringAngles(shifts) {
    let angle = 0;
    return shifts.map((shift) => {
        const target = -shift * LETTER_ANGLE;
        const delta = ((target - angle) % 360 + 540) % 360 - 180;
        angle += delta;
        return angle;
    });
}


export function createScene(media, options = {}) {
    const key = KEYS[options.language] ?? KEYS.fr;
    const keyRow = [...PLAIN].map((_, index) => key[index % key.length]);
    const encrypted = vigenere(PLAIN, key, 1);
    const angles = ringAngles(keyRow.map((letter) => ALPHABET.indexOf(letter)));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const root = svg("svg", {
        class: "card-scene card-scene--cipher",
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

    const pivot = { transformBox: "view-box", transformOrigin: `${WHEEL.cx}px ${WHEEL.cy}px` };

    /* Wheel: disc, plain ring, turning inner ring, window that pairs "A" with the key letter */
    const wheel = svg("g", {}, pivot);
    const innerRing = svg("g", {}, { ...pivot, transform: `rotate(${angles[angles.length - 1]}deg)` });
    innerRing.append(
        ringOfLetters(WHEEL.innerLetters, 9.5, 1),
        svg("circle", { cx: WHEEL.cx, cy: WHEEL.cy, r: WHEEL.inner }, { fill: "none", stroke: "var(--line-strong)", strokeWidth: "1" }),
        svg("path", {
            d: `M${WHEEL.cx} ${WHEEL.cy - WHEEL.inner + 6}V${WHEEL.cy - 8}`
        }, { fill: "none", stroke: "var(--line-strong)", strokeWidth: "1", strokeLinecap: "round" }),
        svg("circle", { cx: WHEEL.cx, cy: WHEEL.cy, r: 3 }, { fill: "var(--white)" })
    );
    wheel.append(
        svg("circle", { cx: WHEEL.cx, cy: WHEEL.cy, r: WHEEL.outer }, { fill: "var(--veil)", stroke: "var(--white)", strokeWidth: "1.4" }),
        ringOfLetters(WHEEL.outerLetters, 11, 1),
        svg("circle", { cx: WHEEL.cx, cy: WHEEL.cy, r: WHEEL.split }, { fill: "none", stroke: "var(--line-strong)", strokeWidth: "1" }),
        innerRing,
        svg("rect", {
            x: WHEEL.cx - 9, y: WHEEL.cy - WHEEL.outer + 3, width: 18, height: WHEEL.outer - WHEEL.inner - 2, rx: 5
        }, { fill: "var(--veil-strong)", stroke: "var(--white)", strokeWidth: "1.4" })
    );

    /* Word columns: method label, key letters, plain word, rule, encrypted word */
    const words = svg("g");
    const columnX = (index) => COLUMN.left + COLUMN.width * index + COLUMN.width / 2;

    const highlight = svg("rect", {
        x: COLUMN.left + 1, y: ROWS.key - 15, width: COLUMN.width - 2, height: ROWS.cipher - ROWS.key + 22, rx: 5
    }, { fill: "var(--veil-strong)", opacity: "0" });

    const label = text("VIGENÈRE", { x: COLUMN.left + 2, y: ROWS.label }, {
        fontSize: "8.5px", fontWeight: "700", letterSpacing: "0.18em"
    });

    const keyLetters = keyRow.map((letter, index) => text(letter, { x: columnX(index), y: ROWS.key, "text-anchor": "middle" }, {
        fontSize: "12px", fontWeight: "600"
    }));
    const plainLetters = [...PLAIN].map((letter, index) => text(letter, { x: columnX(index), y: ROWS.plain, "text-anchor": "middle" }, {
        fontSize: "21px", fontWeight: "500"
    }));
    const rule = svg("path", {
        d: `M${COLUMN.left + 2} ${ROWS.rule}H${COLUMN.left + COLUMN.width * PLAIN.length - 2}`
    }, { stroke: "var(--line-strong)", strokeWidth: "1" });
    const cipherLetters = [...encrypted].map((letter, index) => text(letter, { x: columnX(index), y: ROWS.cipher, "text-anchor": "middle" }, {
        fontSize: "21px", fontWeight: "800"
    }));

    words.append(highlight, label, ...keyLetters, ...plainLetters, rule, ...cipherLetters);
    root.append(wheel, words);

    /* The card pictogram stays in the HTML as the fallback; the scene takes its place */
    media.querySelector(".project-card__icon")?.style.setProperty("display", "none");
    media.append(root);

    let animations = [];

    function stop() {
        animations.forEach((animation) => animation.cancel());
        animations = [];
    }

    /* fill "backwards" keeps the first keyframe during the delay; once over, the static final state shows again */
    function animate(element, keyframes, timing) {
        animations.push(element.animate(keyframes, { fill: "backwards", ...timing }));
    }

    function letterStart(index) {
        return FIRST_LETTER + index * LETTER_STEP;
    }

    function play() {
        stop();

        if (reducedMotion.matches) {
            return;
        }

        /* The wheel rolls in from the right: 110 units to the left turn it by 110 / 78 rad (81 degrees) */
        animate(wheel, [
            { transform: "translateX(110px) rotate(81deg)", opacity: 0 },
            { opacity: 1, offset: 0.45 },
            { transform: "translateX(0) rotate(0deg)", opacity: 1 }
        ], { duration: ARRIVAL, easing: EASE_OUT });

        /* Inner ring: still while the wheel arrives, then one turn per letter, in a single timeline */
        const ringEnd = letterStart(PLAIN.length - 1) + TURN;
        const ringFrames = [{ transform: "rotate(0deg)", offset: 0 }];
        angles.forEach((angle, index) => {
            const start = letterStart(index);
            const previous = index === 0 ? 0 : angles[index - 1];
            ringFrames.push({ transform: `rotate(${previous}deg)`, offset: start / ringEnd, easing: EASE_IN_OUT });
            ringFrames.push({ transform: `rotate(${angle}deg)`, offset: (start + TURN) / ringEnd });
        });
        animate(innerRing, ringFrames, { duration: ringEnd });

        /* Label, key and plain word slide in while the wheel arrives */
        [label, ...keyLetters, ...plainLetters, rule].forEach((element, order) => {
            animate(element, [
                { opacity: 0, transform: "translateX(8px)" },
                { opacity: element.style.opacity || 1, transform: "translateX(0)" }
            ], { delay: 260 + Math.min(order, 6) * 30, duration: 420, easing: EASE_OUT });
        });

        /* Highlight on the column being encrypted, then gone */
        const highlightEnd = letterStart(PLAIN.length - 1) + REVEAL_DELAY + REVEAL + 120;
        const highlightFrames = [{ opacity: 0, transform: "translateX(0)", offset: 0 }];
        highlightFrames.push({ opacity: 0, transform: "translateX(0)", offset: (FIRST_LETTER - 60) / highlightEnd });
        [...PLAIN].forEach((_, index) => {
            const x = `translateX(${index * COLUMN.width}px)`;
            highlightFrames.push({ opacity: 1, transform: x, offset: letterStart(index) / highlightEnd, easing: EASE_IN_OUT });
            if (index < PLAIN.length - 1) {
                highlightFrames.push({ opacity: 1, transform: x, offset: (letterStart(index + 1) - 80) / highlightEnd, easing: EASE_IN_OUT });
            }
        });
        highlightFrames.push({ opacity: 1, transform: `translateX(${(PLAIN.length - 1) * COLUMN.width}px)`, offset: (highlightEnd - 160) / highlightEnd });
        highlightFrames.push({ opacity: 0, transform: `translateX(${(PLAIN.length - 1) * COLUMN.width}px)`, offset: 1 });
        animate(highlight, highlightFrames, { duration: highlightEnd });

        /* Each encrypted letter drops in once the ring has turned */
        cipherLetters.forEach((element, index) => {
            animate(element, [
                { opacity: 0, transform: "translateY(-8px)" },
                { opacity: 1, transform: "translateY(0)" }
            ], { delay: letterStart(index) + REVEAL_DELAY, duration: REVEAL, easing: EASE_OUT });
        });
    }

    /* The static drawing is the final state: cancelling every animation shows it at once */
    function finish() {
        stop();
    }

    return { play, finish };
}
