/*
 * Job Board card scene: a small job board window builds itself, three job offers slide in,
 * then a pointer applies to the second one (its button fills and shows a check mark).
 *
 * Scene contract (card-scenes.js): createScene(media, { language }) returns { play(), finish() }.
 * The SVG built here IS the final state; play() animates towards it with the Web Animations API
 * (fill: "backwards" holds the first keyframe during each delay), so the card is readable
 * before play(), after finish() and with reduced motion. No loop, nothing outside the media box.
 * The top 20 units of the drawing stay empty: the hover sprite of motion.css crosses the top of the media there.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/*
 * Every word comes from the Job Board itself: tab names from the card's demo buttons
 * ("Démo candidat", "Candidate demo"…), contract types from backend/data/ads.json
 * and their English labels from frontend/src/lang.js, "Postuler" / "Apply" from AddJobOffer.jsx.
 */
const TEXTS = {
    fr: { tabs: ["Candidat", "Recruteur", "Admin"], contracts: ["CDI", "Stage", "Alternance"], apply: "Postuler" },
    en: { tabs: ["Candidate", "Recruiter", "Admin"], contracts: ["Permanent", "Internship", "Work-study"], apply: "Apply" }
};

// Drawing units: 256 × 210 fits the media content box (330 × 230 or 296 × 230, minus the padding) at scale 1
const VIEW_BOX = "0 0 256 210";
const WINDOW = { x: 8, y: 24, width: 240, height: 172, radius: 10 };
const ROW_TOPS = [58, 102, 146];
const ROW_HEIGHT = 38;
const TITLE_WIDTHS = [84, 70, 92];
// Index of the offer the pointer applies to
const APPLIED_ROW = 1;
// Pointer arrow: same outline as the site's hover cursor (--sprite-cursor, tokens.css)
const CURSOR_PATH = "M1 1V15.5L4.6 12L7.2 17.8L9.6 16.8L7 11.2H11.8Z";
const CURSOR_START = { x: 230, y: 176 };
// Rests on the right end of the button, clear of the check mark
const CURSOR_END = { x: 218, y: 123 };


/*
 * Creates an SVG element with its attributes; style holds CSS properties, where var() works
 * (SVG presentation attributes do not accept var()).
 */
function svgElement(name, attributes = {}, style = {}) {
    const element = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
    Object.assign(element.style, style);
    return element;
}


/*
 * Reads a token of tokens.css (an easing curve) so the scene moves like the rest of the site.
 */
function cssToken(name, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}


/*
 * Rounded rectangle as a path: unlike <rect>, a path reliably accepts pathLength, used to draw the outline.
 */
function roundedRectPath({ x, y, width, height, radius }) {
    const right = x + width;
    const bottom = y + height;
    return `M${x + radius} ${y}H${right - radius}A${radius} ${radius} 0 0 1 ${right} ${y + radius}`
        + `V${bottom - radius}A${radius} ${radius} 0 0 1 ${right - radius} ${bottom}`
        + `H${x + radius}A${radius} ${radius} 0 0 1 ${x} ${bottom - radius}`
        + `V${y + radius}A${radius} ${radius} 0 0 1 ${x + radius} ${y}Z`;
}


function buildRow(index, texts, ground) {
    const top = ROW_TOPS[index];
    const row = svgElement("g", {}, { transformBox: "fill-box" });
    row.append(
        svgElement("rect", { x: 18, y: top, width: 220, height: ROW_HEIGHT, rx: 8 }, { fill: "var(--veil-strong)" }),
        // Company logo placeholder and offer title bar: shapes only, no invented title
        svgElement("rect", { x: 26, y: top + 9, width: 20, height: 20, rx: 6 }, { fill: "none", stroke: "var(--white)", strokeOpacity: "0.75", strokeWidth: "1.2" }),
        svgElement("rect", { x: 56, y: top + 10, width: TITLE_WIDTHS[index], height: 6, rx: 3 }, { fill: "var(--white)", opacity: "0.85" })
    );
    const contract = svgElement("text", { x: 56, y: top + 30 }, { fill: "var(--white)", opacity: "0.8", fontSize: "8.5px", fontWeight: "500" });
    contract.textContent = texts.contracts[index];
    row.append(contract);

    // Apply button: outline and label; the applied row also gets a white fill and a check mark
    const button = svgElement("g", {}, { transformBox: "fill-box", transformOrigin: "50% 50%" });
    const fill = svgElement("rect", { x: 182, y: top + 10, width: 48, height: 18, rx: 9 }, { fill: "var(--white)", opacity: "0" });
    const outline = svgElement("rect", { x: 182, y: top + 10, width: 48, height: 18, rx: 9 }, { fill: "none", stroke: "var(--white)", strokeWidth: "1.2" });
    const label = svgElement("text", { x: 206, y: top + 22, "text-anchor": "middle" }, { fill: "var(--white)", fontSize: "8.5px", fontWeight: "600" });
    label.textContent = texts.apply;
    button.append(fill, outline, label);
    row.append(button);

    const parts = { row, button, fill, label, check: null };
    if (index === APPLIED_ROW) {
        fill.style.opacity = "1";
        label.style.opacity = "0";
        parts.check = svgElement("path", { d: `M200 ${top + 19}L204 ${top + 23}L212 ${top + 15}`, pathLength: 1 }, {
            fill: "none", stroke: ground, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", strokeDasharray: "1"
        });
        button.append(parts.check);
    }
    return parts;
}


export function createScene(media, options = {}) {
    const texts = TEXTS[options.language] ?? TEXTS.fr;
    const easeOut = cssToken("--ease-out", "cubic-bezier(0.2, 0.8, 0.2, 1)");
    const easeInOut = cssToken("--ease-in-out", "cubic-bezier(0.6, 0, 0.2, 1)");
    // The check mark takes the card colour: it reads as a cut-out of the white button
    const ground = "var(--card-ground, var(--accent-card))";

    const svg = svgElement("svg", { viewBox: VIEW_BOX, "aria-hidden": "true", focusable: "false", class: "card-scene card-scene--job-board" }, {
        display: "block", width: "100%", height: "100%", overflow: "hidden", fontFamily: "inherit"
    });

    // Window: body, outline drawn on play, header with the three areas of the site
    const windowBody = svgElement("path", { d: roundedRectPath(WINDOW) }, { fill: "var(--shadow)" });
    const windowLine = svgElement("path", { d: roundedRectPath(WINDOW), pathLength: 1 }, {
        fill: "none", stroke: "var(--white)", strokeOpacity: "0.9", strokeWidth: "1.4", strokeDasharray: "1"
    });
    const headerLine = svgElement("path", { d: `M${WINDOW.x} 48.5H${WINDOW.x + WINDOW.width}` }, { stroke: "var(--white)", strokeOpacity: "0.25", strokeWidth: "1" });
    const tabs = texts.tabs.map((name, index) => {
        const tab = svgElement("text", { x: WINDOW.x + 40 + index * 80, y: 40, "text-anchor": "middle" }, {
            // Other tabs at 75 %: contrast 5.8 on the window (60 % gave 4.1, under the WCAG AA 4.5)
            fill: "var(--white)", opacity: index === 0 ? "1" : "0.75", fontSize: "9px", fontWeight: "600"
        });
        tab.textContent = name;
        return tab;
    });
    const underline = svgElement("rect", { x: WINDOW.x + 20, y: 46, width: 40, height: 2, rx: 1 }, {
        fill: "var(--white)", transformBox: "fill-box", transformOrigin: "0 50%"
    });
    svg.append(windowBody, windowLine, headerLine, ...tabs, underline);

    const rows = ROW_TOPS.map((_, index) => buildRow(index, texts, ground));
    svg.append(...rows.map(parts => parts.row));

    const cursor = svgElement("path", { d: CURSOR_PATH }, {
        fill: "var(--white)", stroke: "var(--ink)", strokeOpacity: "0.8", strokeWidth: "1.2", strokeLinejoin: "round",
        transform: `translate(${CURSOR_END.x}px, ${CURSOR_END.y}px)`,
        // The click squeezes the arrow towards its tip (top left of its own box)
        transformBox: "fill-box", transformOrigin: "0 0"
    });
    svg.append(cursor);

    // The original markup (pictogram) stays in the page as the no-JavaScript fallback, hidden behind the scene
    for (const child of media.children) child.style.display = "none";
    media.append(svg);

    let animations = [];
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function animate(element, keyframes, timing) {
        animations.push(element.animate(keyframes, { fill: "backwards", easing: easeOut, ...timing }));
    }

    // Cancelling the animations reveals the static drawing, which is the final state
    function finish() {
        for (const animation of animations) animation.cancel();
        animations = [];
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

        rows.forEach(({ row }, index) => {
            animate(row, [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "translateY(0)" }], {
                delay: 480 + index * 130, duration: 520
            });
        });

        // Pointer: comes in from the bottom right, stops on the button, clicks
        animate(cursor, [
            { opacity: 0, transform: `translate(${CURSOR_START.x}px, ${CURSOR_START.y}px)` },
            { opacity: 1, offset: 0.3 },
            { opacity: 1, transform: `translate(${CURSOR_END.x}px, ${CURSOR_END.y}px)` }
        ], { delay: 1150, duration: 520, easing: easeInOut });
        animate(cursor, [{ scale: 1 }, { scale: 0.85 }, { scale: 1 }], { delay: 1680, duration: 180, fill: "none" });

        const applied = rows[APPLIED_ROW];
        animate(applied.button, [{ transform: "scale(1)" }, { transform: "scale(0.92)" }, { transform: "scale(1)" }], { delay: 1680, duration: 200, fill: "none" });
        animate(applied.fill, [{ opacity: 0 }, { opacity: 1 }], { delay: 1720, duration: 220 });
        animate(applied.label, [{ opacity: 1 }, { opacity: 0 }], { delay: 1720, duration: 160 });
        animate(applied.check, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { delay: 1880, duration: 300, easing: easeInOut });
    }

    return { play, finish };
}
