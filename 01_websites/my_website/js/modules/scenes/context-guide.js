/*
 * Context engineering guide card scene: the guide given to an AI builds its own system.
 * An AI window opens (outline drawn, veiled body, as in the Job Board scene), its three ways in appear
 * as tabs (extension, terminal, web), the guide.md file slides in and points to a stack: the five bricks
 * of the system (rules, skills, hooks, MCP, subagents) drop one by one from the bottom up;
 * then the row of the 14 chapters fills from left to right.
 *
 * Scene contract (card-scenes.js): createScene(media, { language }) returns { play(), finish() }.
 * The drawing at rest IS the final state: play() animates towards it (Web Animations API, fill "backwards"),
 * finish() shows it at once. No loop, nothing outside the media box; the top 20 units stay empty
 * for the hover word of motion.css.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

// Bricks from the bottom up; the names of the tools stay the same in both languages
const TEXTS = {
    fr: { tools: ["Extension", "Terminal", "Web"], bricks: ["Règles", "Skills", "Hooks", "MCP", "Sous-agents"], chapters: "14 chapitres" },
    en: { tools: ["Extension", "Terminal", "Web"], bricks: ["Rules", "Skills", "Hooks", "MCP", "Subagents"], chapters: "14 chapters" }
};
const LANGUAGES = ["fr", "en"];

// Same window and header as the Job Board scene (job-board.js)
const VIEW_BOX = "0 0 256 210";
const WINDOW = { x: 8, y: 24, width: 240, height: 176, radius: 10 };
const HEADER_Y = 48.5;

// guide.md file on the left, with a folded corner
const FILE = { x: 26, y: 70, width: 44, height: 54, fold: 10 };

// Stack of the five bricks on the right, drawn from the bottom (BRICK.bottom) up
const BRICK = { x: 104, width: 128, height: 17, gap: 4, bottom: 166 };

// Row of the 14 chapters at the bottom of the window
const CHAPTER = { count: 14, x: 26, y: 178, size: 8, gap: 2.5 };

const BRICK_DELAY = 1050;
const BRICK_STAGGER = 150;
const CHAPTER_DELAY = 1950;
const CHAPTER_STAGGER = 55;


function svgElement(name, attributes = {}, style = {}) {
    const element = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
    Object.assign(element.style, style);
    return element;
}


function cssToken(name, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}


// Rounded rectangle as a path: unlike <rect>, a path reliably accepts pathLength, used to draw the outline
function roundedRectPath({ x, y, width, height, radius }) {
    const right = x + width;
    const bottom = y + height;
    return `M${x + radius} ${y}H${right - radius}A${radius} ${radius} 0 0 1 ${right} ${y + radius}`
        + `V${bottom - radius}A${radius} ${radius} 0 0 1 ${right - radius} ${bottom}`
        + `H${x + radius}A${radius} ${radius} 0 0 1 ${x} ${bottom - radius}`
        + `V${y + radius}A${radius} ${radius} 0 0 1 ${x + radius} ${y}Z`;
}


function label(text, x, y, size, weight = "600", anchor = "middle", opacity = "1") {
    const element = svgElement("text", { x, y, "text-anchor": anchor }, { fill: "var(--white)", opacity, fontSize: size, fontWeight: weight });
    element.textContent = text;
    return element;
}


export function createScene(media, options = {}) {
    const language = LANGUAGES.includes(options.language) ? options.language : "fr";
    const texts = TEXTS[language];
    const easeOut = cssToken("--ease-out", "cubic-bezier(0.2, 0.8, 0.2, 1)");
    const easeInOut = cssToken("--ease-in-out", "cubic-bezier(0.6, 0, 0.2, 1)");

    const svg = svgElement("svg", { viewBox: VIEW_BOX, "aria-hidden": "true", focusable: "false", class: "card-scene card-scene--context-guide" }, {
        display: "block", width: "100%", height: "100%", overflow: "hidden", fontFamily: "inherit"
    });

    // Window: veiled body, white outline drawn on play, header with the three ways in (first one underlined)
    const windowBody = svgElement("path", { d: roundedRectPath(WINDOW) }, { fill: "var(--shadow)" });
    const windowLine = svgElement("path", { d: roundedRectPath(WINDOW), pathLength: 1 }, {
        fill: "none", stroke: "var(--white)", strokeOpacity: "0.9", strokeWidth: "1.4", strokeDasharray: "1"
    });
    const headerLine = svgElement("path", { d: `M${WINDOW.x} ${HEADER_Y}H${WINDOW.x + WINDOW.width}` }, { stroke: "var(--white)", strokeOpacity: "0.25", strokeWidth: "1" });
    // Other tabs at 75 %, as in the Job Board scene (contrast 5.8 on the window)
    const tabs = texts.tools.map((name, index) => label(name, WINDOW.x + 40 + index * 80, 40, "9px", "600", "middle", index === 0 ? "1" : "0.75"));
    const underline = svgElement("rect", { x: WINDOW.x + 20, y: 46, width: 40, height: 2, rx: 1 }, {
        fill: "var(--white)", transformBox: "fill-box", transformOrigin: "0 50%"
    });
    svg.append(windowBody, windowLine, headerLine, ...tabs, underline);

    // guide.md: a page with a folded corner, four lines of text and its name under it
    const file = svgElement("g", {}, { transformBox: "fill-box" });
    const { x, y, width, height, fold } = FILE;
    file.append(
        svgElement("path", { d: `M${x} ${y}h${width - fold}l${fold} ${fold}v${height - fold}h${-width}z` }, {
            fill: "var(--veil)", stroke: "var(--white)", strokeOpacity: "0.9", strokeWidth: "1.2", strokeLinejoin: "round"
        }),
        svgElement("path", { d: `M${x + width - fold} ${y}v${fold}h${fold}` }, {
            fill: "none", stroke: "var(--white)", strokeOpacity: "0.9", strokeWidth: "1.2", strokeLinejoin: "round"
        })
    );
    [30, 30, 30, 18].forEach((length, index) => {
        file.append(svgElement("rect", { x: x + 7, y: y + 19 + index * 8, width: length, height: 2.2, rx: 1.1 }, { fill: "var(--white)", opacity: "0.8" }));
    });
    file.append(label("guide.md", x + width / 2, y + height + 14, "8.5px", "700"));
    svg.append(file);

    // Dashed arrow from the file to the stack
    const arrow = svgElement("g");
    arrow.append(
        svgElement("path", { d: "M78 106h18" }, { fill: "none", stroke: "var(--white)", strokeWidth: "1.4", strokeDasharray: "3 3", strokeLinecap: "round" }),
        svgElement("path", { d: "M93 102l4 4-4 4" }, { fill: "none", stroke: "var(--white)", strokeWidth: "1.4", strokeLinecap: "round", strokeLinejoin: "round" })
    );
    svg.append(arrow);

    // The five bricks of the system, from the bottom up, on the light veil of the Job Board offers
    const bricks = texts.bricks.map((name, index) => {
        const top = BRICK.bottom - (index + 1) * BRICK.height - index * BRICK.gap;
        const group = svgElement("g");
        group.append(
            svgElement("rect", { x: BRICK.x, y: top, width: BRICK.width, height: BRICK.height, rx: 6 }, { fill: "var(--veil-strong)" }),
            label(name, BRICK.x + BRICK.width / 2, top + 12, "8.5px", "600")
        );
        svg.append(group);
        return group;
    });

    // The 14 chapters, filled squares at rest; their name on the right
    const chapters = Array.from({ length: CHAPTER.count }, (_, index) => {
        const square = svgElement("rect", {
            x: CHAPTER.x + index * (CHAPTER.size + CHAPTER.gap), y: CHAPTER.y, width: CHAPTER.size, height: CHAPTER.size, rx: 2
        }, { fill: "var(--white)", opacity: "0.85" });
        svg.append(square);
        return square;
    });
    const chaptersLabel = label(texts.chapters, 232, CHAPTER.y + 7.5, "8px", "600", "end", "0.85");
    svg.append(chaptersLabel);

    // The original markup stays in the page as the no-JavaScript fallback, hidden behind the scene
    for (const child of media.children) child.style.display = "none";
    media.append(svg);

    let animations = [];
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    // Cancelling the animations reveals the static drawing, which is the final state
    function finish() {
        for (const animation of animations) animation.cancel();
        animations = [];
    }

    function animate(element, keyframes, timing) {
        animations.push(element.animate(keyframes, { fill: "backwards", easing: easeOut, ...timing }));
    }

    function play() {
        finish();
        if (reducedMotion.matches) return;

        animate(windowLine, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 650, easing: easeInOut });
        animate(windowBody, [{ opacity: 0 }, { opacity: 1 }], { delay: 200, duration: 450 });
        animate(headerLine, [{ opacity: 0 }, { opacity: 1 }], { delay: 300, duration: 300 });
        tabs.forEach((tab, index) => {
            animate(tab, [{ opacity: 0 }, { opacity: tab.style.opacity }], { delay: 300 + index * 70, duration: 350 });
        });
        animate(underline, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { delay: 520, duration: 400 });
        animate(file, [{ opacity: 0, transform: "translateX(-14px)" }, { opacity: 1, transform: "translateX(0)" }], { delay: 600, duration: 550 });
        animate(arrow, [{ opacity: 0, transform: "translateX(-6px)" }, { opacity: 1, transform: "translateX(0)" }], { delay: 900, duration: 350 });
        bricks.forEach((brick, index) => {
            animate(brick, [{ opacity: 0, transform: "translateY(-24px)" }, { opacity: 1, transform: "translateY(0)" }], {
                delay: BRICK_DELAY + index * BRICK_STAGGER, duration: 450
            });
        });
        chapters.forEach((square, index) => {
            animate(square, [{ opacity: 0.15 }, { opacity: square.style.opacity }], { delay: CHAPTER_DELAY + index * CHAPTER_STAGGER, duration: 250 });
        });
        animate(chaptersLabel, [{ opacity: 0 }, { opacity: chaptersLabel.style.opacity }], { delay: CHAPTER_DELAY, duration: 400 });
    }

    return { play, finish };
}
