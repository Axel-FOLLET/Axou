/*
 * Language detector card scene: the letter frequencies of a sample sentence rise as 26 bars (a to z),
 * then the profile of a reference language (one white mark per letter) is laid over them.
 * The marks try the third, then the second most likely language, and settle on the most likely one,
 * whose name and gap stay displayed: the comparison the detector makes, with its real values.
 *
 * Scene contract (card-scenes.js): createScene(media, { language }) returns { play(), finish() }.
 * The drawing at rest IS the final state; play() animates towards it with the Web Animations API
 * (fill: "backwards" holds the first keyframe during each delay), finish() shows it at once.
 * No loop, nothing outside the media box; the title word of this card is animated on hover (motion.js),
 * and the top 20 units of the drawing stay empty like on the other cards.
 */
import { rankLanguages } from "../../tools/language-detector.js";
import { LANGUAGE_FREQUENCIES, ALPHABET, letterFrequencies, normalize } from "../../tools/letter-frequencies.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/*
 * Sample sentences: the first two examples of the card demo (project-demos.js), French on the French page,
 * English on the English page. Language names and the word "écart" / "gap" are those of the demo.
 */
const TEXTS = {
    fr: {
        sample: "Le petit chat dort sur le canapé pendant que les enfants jouent dans le jardin. Demain, nous irons tous ensemble à la plage.",
        names: { fr: "Français", en: "Anglais", es: "Espagnol", pt: "Portugais", it: "Italien", de: "Allemand", nl: "Néerlandais", sv: "Suédois", pl: "Polonais", tr: "Turc" },
        gap: "écart",
        locale: "fr-FR"
    },
    en: {
        sample: "The little cat is sleeping on the sofa while the children are playing in the garden. Tomorrow we will all go to the beach together.",
        names: { fr: "French", en: "English", es: "Spanish", pt: "Portuguese", it: "Italian", de: "German", nl: "Dutch", sv: "Swedish", pl: "Polish", tr: "Turkish" },
        gap: "gap",
        locale: "en-GB"
    }
};

const VIEW_BOX = "0 0 256 210";
const CHART = { left: 12, right: 244, baseline: 176, height: 104 };
const BAR_WIDTH = 5;
// Order of display: third, second, then most likely language (the last one stays)
const TRIED = 3;


function svgElement(name, attributes = {}, style = {}) {
    const element = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
    Object.assign(element.style, style);
    return element;
}


function cssToken(name, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}


export function createScene(media, options = {}) {
    const texts = TEXTS[options.language] ?? TEXTS.fr;
    const easeOut = cssToken("--ease-out", "cubic-bezier(0.2, 0.8, 0.2, 1)");
    const easeInOut = cssToken("--ease-in-out", "cubic-bezier(0.6, 0, 0.2, 1)");

    const sampleFrequencies = letterFrequencies(normalize(texts.sample));
    // Most likely last: the marks end on the detector's answer
    const candidates = rankLanguages(texts.sample).ranking.slice(0, TRIED).reverse();
    const letters = [...ALPHABET];
    const slot = (CHART.right - CHART.left) / letters.length;
    const highest = Math.max(
        ...letters.map(letter => sampleFrequencies[letter]),
        ...candidates.flatMap(({ code }) => letters.map(letter => LANGUAGE_FREQUENCIES[code][letter]))
    );
    const heightOf = value => value / highest * CHART.height;

    const svg = svgElement("svg", { viewBox: VIEW_BOX, "aria-hidden": "true", focusable: "false", class: "card-scene card-scene--language" }, {
        display: "block", width: "100%", height: "100%", overflow: "hidden", fontFamily: "inherit"
    });

    const baseline = svgElement("path", { d: `M${CHART.left} ${CHART.baseline + 0.5}H${CHART.right}` }, {
        stroke: "var(--white)", strokeOpacity: "0.4", strokeWidth: "1", transformBox: "fill-box", transformOrigin: "0 50%"
    });
    svg.append(baseline);

    const bars = [];
    const marks = [];
    letters.forEach((letter, index) => {
        const center = CHART.left + slot * (index + 0.5);
        const height = heightOf(sampleFrequencies[letter]);
        const bar = svgElement("rect", { x: center - BAR_WIDTH / 2, y: CHART.baseline - height, width: BAR_WIDTH, height, rx: 1 }, {
            fill: "var(--white)", opacity: "0.4", transformBox: "fill-box", transformOrigin: "50% 100%"
        });
        // Full white: contrast 5.5 on the card red (75 % gave 3.4, under the WCAG AA 4.5)
        const label = svgElement("text", { x: center, y: CHART.baseline + 15, "text-anchor": "middle" }, {
            fill: "var(--white)", fontSize: "7.5px", fontWeight: "500"
        });
        label.textContent = letter;
        // Reference mark of the most likely language; the others are offsets of it
        const levels = candidates.map(({ code }) => CHART.baseline - heightOf(LANGUAGE_FREQUENCIES[code][letter]));
        const finalLevel = levels[levels.length - 1];
        const mark = svgElement("rect", { x: center - 4, y: finalLevel - 1, width: 8, height: 2, rx: 1 }, { fill: "var(--white)" });
        svg.append(bar, label, mark);
        bars.push(bar);
        marks.push({ mark, offsets: levels.map(level => level - finalLevel) });
    });

    // Name and gap of each tried language, top of the chart; only the last one shows at rest
    const readouts = candidates.map(({ code, gap }, index) => {
        const isLast = index === candidates.length - 1;
        const group = svgElement("g", {}, { opacity: isLast ? "1" : "0" });
        const name = svgElement("text", { x: CHART.left, y: 52 }, {
            fill: "var(--white)", fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "21px"
        });
        name.textContent = texts.names[code];
        const value = svgElement("text", { x: CHART.right, y: 51, "text-anchor": "end" }, {
            fill: "var(--white)", fontSize: "9px", fontWeight: "500"
        });
        value.textContent = `${texts.gap} ${gap.toLocaleString(texts.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
        group.append(name, value);
        svg.append(group);
        return group;
    });

    // The original markup (pictogram) stays in the page as the no-JavaScript fallback, hidden behind the scene
    for (const child of media.children) child.style.display = "none";
    media.append(svg);

    let animations = [];
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function animate(element, keyframes, timing) {
        animations.push(element.animate(keyframes, { fill: "backwards", easing: easeOut, ...timing }));
    }

    function finish() {
        for (const animation of animations) animation.cancel();
        animations = [];
    }

    /*
     * Timeline (ms): bars rise 100 to 1 100; marks appear on the third language at 800,
     * move to the second at 1 250, to the first at 1 700, and stop about 2 200. Each name shows while its marks hold.
     */
    const MARKS_START = 800;
    const STEP = 450;

    function play() {
        finish();
        if (reducedMotion.matches) return;

        animate(baseline, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: 450, easing: easeInOut });
        bars.forEach((bar, index) => {
            animate(bar, [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], { delay: 100 + index * 22, duration: 450 });
        });

        // Marks: fade in on the first language tried, then glide from one profile to the next
        const total = 200 + STEP * (candidates.length - 1) + 250;
        marks.forEach(({ mark, offsets }, index) => {
            const keyframes = [{ opacity: 0, transform: `translateY(${offsets[0]}px)`, offset: 0 }];
            keyframes.push({ opacity: 1, transform: `translateY(${offsets[0]}px)`, offset: 200 / total });
            for (let step = 1; step < offsets.length; step++) {
                const start = (200 + STEP * (step - 1) + 200) / total;
                const end = Math.min((200 + STEP * step + 50) / total, 1);
                keyframes.push({ transform: `translateY(${offsets[step - 1]}px)`, offset: start, easing: easeInOut });
                keyframes.push({ transform: `translateY(${offsets[step]}px)`, offset: end });
            }
            if (keyframes[keyframes.length - 1].offset < 1) keyframes.push({ opacity: 1, transform: "translateY(0px)", offset: 1 });
            animate(mark, keyframes, { delay: MARKS_START + index * 8, duration: total, easing: "linear" });
        });

        // Readouts: each name fades in with its profile and out when the marks leave it; the last one stays
        readouts.forEach((group, index) => {
            const isLast = index === readouts.length - 1;
            const start = MARKS_START + 50 + STEP * index;
            const keyframes = isLast
                ? [{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "translateY(0)" }]
                : [{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }];
            animate(group, keyframes, { delay: start, duration: isLast ? 400 : STEP + 50, fill: isLast ? "backwards" : "none" });
        });
    }

    return { play, finish };
}
