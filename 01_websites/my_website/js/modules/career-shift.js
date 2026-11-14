/*
 * Career-change scene of the My background page: on the board at the top of the banner (.shift, styles in parcours.css),
 * the HR words give way to the IT words. The tiles flip one after the other while the banner rises on the screen,
 * and flip back when scrolling back up: the scene follows the scroll in both directions.
 * It starts when the thread of the timeline touches the banner: both use the same reading line (timeline.js).
 * This module only sets classes; the words are in the attributes of the tiles, the flips are CSS transitions.
 * With reduced motion or without JavaScript, the board keeps its final state: the IT side.
 */
import { READING_LINE, pageTop } from "./timeline.js";


/*
 * Distance scrolled between the moment the reading line touches the top of the banner and the last flip:
 * 42% of the screen height, at least 240 px on low screens.
 */
const RANGE = 0.42;
const RANGE_MIN = 240;

/* Share of that distance at which the first and the last tile flip; the others are spread evenly in between */
const FIRST_FLIP = 0.06;
const LAST_FLIP = 0.94;

/* Tiles that flip in the same frame (fast scroll) start this many milliseconds apart: a wave, not a block */
const WAVE_STEP = 70;


export function initCareerShift() {
    const banner = document.querySelector("#career-change .career__banner");
    const stage = banner?.querySelector(".shift");
    if (!stage) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const allTiles = Array.from(stage.querySelectorAll(".shift__tile"));
    /* Tiles shown at this width of the screen (the phone hides the last ones), top of the banner in the page, tiles already flipped */
    let tiles = allTiles;
    let top = 0;
    let flipped = -1;
    let frameId = null;

    /* Measured on every change of layout, never while scrolling */
    function measure() {
        top = pageTop(banner);
        tiles = allTiles.filter(tile => tile.offsetParent !== null);
        flipped = -1;
    }

    /* 0 when the reading line touches the top of the banner, 1 once the whole scene is played */
    function progress() {
        const range = Math.max(window.innerHeight * RANGE, RANGE_MIN);
        return (window.scrollY + window.innerHeight * READING_LINE - top) / range;
    }

    /* Number of tiles that must show their IT side at this progress; the classes only change when it changes */
    function update() {
        frameId = null;
        const position = progress();
        const step = (LAST_FLIP - FIRST_FLIP) / Math.max(tiles.length - 1, 1);
        const count = position < FIRST_FLIP ? 0 : Math.min(tiles.length, Math.floor((position - FIRST_FLIP) / step) + 1);
        banner.classList.toggle("career__banner--docked", position >= 0);
        if (count === flipped) return;
        /* Rank of each tile among those that change now: the first to go is the nearest to the previous state */
        const from = Math.max(flipped, 0);
        tiles.forEach((tile, index) => {
            const rank = count > from ? index - from : from - 1 - index;
            tile.style.setProperty("--flip-delay", `${Math.max(rank, 0) * WAVE_STEP}ms`);
            tile.classList.toggle("shift__tile--on", index < count);
        });
        flipped = count;
    }

    function requestUpdate() {
        if (frameId === null) frameId = requestAnimationFrame(update);
    }

    function relayout() {
        measure();
        requestUpdate();
    }

    /*
     * First state set at once, before the transitions exist: arriving in the middle of the page shows the right side of each tile.
     * The transitions are allowed two frames later (career__banner--ready), once that state is drawn.
     */
    banner.classList.add("career__banner--live");
    measure();
    update();
    requestAnimationFrame(() => requestAnimationFrame(() => banner.classList.add("career__banner--ready")));

    /*
     * passive: true promises the browser that the listener does not block scrolling.
     */
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", relayout);
    if ("ResizeObserver" in window) new ResizeObserver(relayout).observe(document.querySelector("main") ?? banner);
    document.fonts?.ready.then(relayout);
}
