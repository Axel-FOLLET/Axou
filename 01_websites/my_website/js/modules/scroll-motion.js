/*
 * Movements tied to scrolling and to the mouse, shared by the portfolio and the CV site (styles in scroll.css):
 * introduction texts that light up word by word as the page scrolls, header cubes (.hero) that follow the mouse
 * on My background and My portfolio (the home page has no relief).
 * Each part checks that its elements exist: the file can be copied as is from one site to the other.
 * With reduced motion, nothing moves and the texts stay whole.
 */

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)");

/* Hovers reserved for the mouse and the touchpad, as in motion.js */
const FINE_HOVER = window.matchMedia("(hover: hover) and (pointer: fine)");

/* Texts that light up: the section introductions */
const LIT_TEXTS = ".section__intro";

/* Share of the remaining distance covered by the cubes on each frame: they follow the mouse with a slight lag */
const PARALLAX_EASE = 0.08;


/* -------------------- TEXT THAT LIGHTS UP -------------------- */

/*
 * Wraps each word in a span; --p (from 0 to 1) is its place in the text, scroll.css derives
 * the moment it lights up from it. Spaces stay text nodes: a non-breaking space still prevents the break.
 * The words of links and bold passages are wrapped too: TreeWalker goes through all the text nodes.
 */
function splitWords(text) {
    const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const words = [];
    nodes.forEach(node => {
        const parts = node.textContent.split(/(\s+)/);
        const fragment = document.createDocumentFragment();
        parts.forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) {
                fragment.append(part);
                return;
            }
            const word = document.createElement("span");
            word.className = "lit-word";
            word.textContent = part;
            fragment.append(word);
            words.push(word);
        });
        node.replaceWith(fragment);
    });
    words.forEach((word, index) => word.style.setProperty("--p", (index / Math.max(words.length - 1, 1)).toFixed(3)));
}


/*
 * Without animation-timeline (Firefox for example), the text stays whole: nothing is split.
 */
export function initScrollWords() {
    if (REDUCED_MOTION.matches || !CSS.supports("animation-timeline: view()")) return;
    document.querySelectorAll(LIT_TEXTS).forEach(text => {
        splitWords(text);
        text.classList.add("lit-text");
    });
}


/* -------------------- CUBES FOLLOWING THE MOUSE -------------------- */

/*
 * --mx and --my go from -1 to 1 according to the mouse position in the header; scroll.css moves
 * each cube by a different distance: the gap between the planes gives the depth.
 * The animation loop stops once the cubes have arrived, and restarts on the next movement.
 * The home page (data-theme="home") fits on one screen, without relief: nothing is followed there.
 */
export function initHeroParallax() {
    if (document.body.dataset.theme === "home") return;
    const hero = document.querySelector(".hero");
    const visual = hero?.querySelector(".hero__visual");
    if (!visual || REDUCED_MOTION.matches || !FINE_HOVER.matches) return;
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let frameId = null;

    function step() {
        current.x += (target.x - current.x) * PARALLAX_EASE;
        current.y += (target.y - current.y) * PARALLAX_EASE;
        visual.style.setProperty("--mx", current.x.toFixed(4));
        visual.style.setProperty("--my", current.y.toFixed(4));
        const settled = Math.abs(target.x - current.x) < 0.001 && Math.abs(target.y - current.y) < 0.001;
        frameId = settled ? null : requestAnimationFrame(step);
    }

    function follow(x, y) {
        target.x = x;
        target.y = y;
        if (frameId === null) frameId = requestAnimationFrame(step);
    }

    hero.addEventListener("pointermove", event => {
        if (event.pointerType !== "mouse") return;
        const box = hero.getBoundingClientRect();
        follow((event.clientX - box.left) / box.width * 2 - 1, (event.clientY - box.top) / box.height * 2 - 1);
    });
    /* The mouse leaves the header: the cubes go back to their place */
    hero.addEventListener("pointerleave", () => follow(0, 0));
}
