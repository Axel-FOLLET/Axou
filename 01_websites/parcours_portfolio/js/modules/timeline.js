/*
 * Experience timeline, the thread of the My background page: a blue line draws itself as the page scrolls,
 * from the first job down to the career-change banner; each job lights up when the line reaches it and stays lit;
 * a small blue cube, the one of the home page door (cubes system), rides the head of the line and turns with the scroll.
 * The line and the cube only move through transform: nothing is laid out again while scrolling.
 * With reduced motion, the line is fully drawn, the jobs are lit and the cube rests at the end of the line.
 * Without JavaScript, the timeline keeps its plain full line (timeline.css) and everything stays displayed.
 */
import { createCube } from "./cubes/create-cube.js";
import { CLICK_DURATION, renderCube, updateCube } from "./cubes/update-cube.js";
import { enableCubeDrag } from "./cubes/drag-cube.js";


/*
 * Reading line placed at 72% of the screen height: the head of the line stays on it while the timeline scrolls,
 * and a job lights up when its dated node crosses it. career-shift.js starts its scene on the same line.
 */
export const READING_LINE = 0.72;

/* Share of the remaining way covered by the head at each frame (at 60 frames per second): it glides instead of jumping */
const HEAD_EASE = 0.28;

/*
 * Scrolling throws the cube like a finger would: each pixel scrolled adds SPIN_PER_PIXEL degrees per second
 * around the vertical axis (TUMBLE times less around the horizontal one), up to SPIN_MAX; the momentum then fades (update-cube.js).
 */
const SPIN_PER_PIXEL = 1.3;
const SPIN_MAX = 620;
const TUMBLE = 0.4;


/* Distance from the top of the page to the top of an element; transforms (reveals, entrances) do not change it */
export function pageTop(element) {
    let top = 0;
    for (let node = element; node; node = node.offsetParent) top += node.offsetTop;
    return top;
}


/*
 * Builds the thread: an extra list item, hidden from screen readers, that holds the line and the cube.
 * The cube takes the classes and the six faces of the cubes system; its rotation is driven here.
 */
function buildThread(timeline) {
    const thread = document.createElement("li");
    const line = document.createElement("span");
    const trigger = document.createElement("span");
    thread.className = "timeline__thread";
    thread.setAttribute("aria-hidden", "true");
    line.className = "timeline__thread-line";
    trigger.className = "cube cube--blue timeline__cube";
    trigger.dataset.speed = "14";
    trigger.dataset.phase = "40";
    thread.append(line, trigger);
    timeline.append(thread);
    return { thread, line, trigger, cube: createCube(trigger, 0) };
}


export function initTimeline() {
    const timeline = document.querySelector(".timeline");
    if (!timeline) return;
    const steps = Array.from(timeline.querySelectorAll(".timeline__step"));
    const nodes = steps.map(step => step.querySelector(".timeline__date"));
    if (!steps.length || nodes.includes(null)) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    /* The thread ends on the top edge of the career-change banner; without a banner, at the bottom of the timeline */
    const banner = document.querySelector("#career-change .career__banner");
    const { thread, line, trigger, cube } = buildThread(timeline);
    timeline.classList.add("timeline--threaded");

    /*
     * Measured once, then on every change of layout, never while scrolling:
     * top: start of the thread in the page (centre of the first node); length: down to the banner;
     * rest: last position of the cube, laid on the banner; marks: centre of each node along the thread.
     */
    const geometry = { top: 0, length: 1, rest: 1, marks: [] };
    let head = 0;
    let drawnHead = null;
    let litCount = 0;
    let frameId = null;
    let previousTime = 0;
    let previousScroll = window.scrollY;
    let cubeVisible = false;

    function measure() {
        const start = pageTop(nodes[0]) + nodes[0].offsetHeight / 2;
        const end = banner ? pageTop(banner) : pageTop(timeline) + timeline.offsetHeight;
        geometry.top = start;
        geometry.length = Math.max(end - start, 1);
        geometry.rest = Math.max(geometry.length - trigger.offsetHeight / 2, 0);
        geometry.marks = nodes.map(node => pageTop(node) + node.offsetHeight / 2 - start);
        thread.style.height = `${geometry.length}px`;
        drawnHead = null;
    }

    /* Position of the reading line along the thread: negative before the first node, beyond length after the banner */
    function reach() {
        return window.scrollY + window.innerHeight * READING_LINE - geometry.top;
    }

    function clampHead(value) {
        return Math.min(Math.max(value, 0), geometry.length);
    }

    /*
     * The line is scaled from its top, the cube slides down to the head; it stops when it lies on the banner.
     * Nothing is written while the head stands still: the loop then only turns the cube.
     */
    function draw() {
        if (head === drawnHead) return;
        drawnHead = head;
        line.style.transform = `scaleY(${(head / geometry.length).toFixed(5)})`;
        trigger.style.transform = `translate3d(0, ${Math.min(head, geometry.rest).toFixed(1)}px, 0)`;
    }

    /* A job lights up when the line reaches its node, in order, and stays lit when scrolling back up */
    function lightSteps(position) {
        while (litCount < steps.length && position >= geometry.marks[litCount]) {
            steps[litCount].classList.add("timeline__step--visible");
            litCount += 1;
        }
    }

    /* Reduced motion: final state, kept right when the layout changes */
    if (reducedMotion) {
        const settle = () => {
            measure();
            head = geometry.length;
            draw();
        };
        enableCubeDrag(trigger, cube, renderCube, () => false);
        renderCube(cube);
        settle();
        window.addEventListener("resize", settle);
        document.fonts?.ready.then(settle);
        return;
    }

    /*
     * One frame: the head covers a share of the way to the reading line, the jobs it passed light up,
     * the cube turns (own slow rotation, plus the momentum given by the scroll or by a throw).
     * The loop only runs while the cube is on screen or the head is still on its way.
     */
    function frame(time) {
        frameId = null;
        const deltaTime = Math.min((time - previousTime) / 1000, 0.05);
        previousTime = time;
        const position = reach();
        const target = clampHead(position);
        const gap = target - head;
        head = Math.abs(gap) < 0.5 ? target : head + gap * (1 - Math.pow(1 - HEAD_EASE, deltaTime * 60));
        draw();
        lightSteps(Math.min(position, head));
        if (cubeVisible) updateCube(cube, deltaTime);
        if (cubeVisible || head !== target) requestFrame();
    }

    function requestFrame() {
        if (frameId !== null) return;
        if (!cubeVisible && head === clampHead(reach())) return;
        previousTime = performance.now();
        frameId = requestAnimationFrame(frame);
    }

    /* Momentum given to the cube by the scroll: forwards when going down, backwards when going back up */
    function spin(distance) {
        const limit = value => Math.max(-SPIN_MAX, Math.min(SPIN_MAX, value));
        cube.velocityY = limit(cube.velocityY + distance * SPIN_PER_PIXEL);
        cube.velocityX = limit(cube.velocityX + distance * SPIN_PER_PIXEL * TUMBLE);
    }

    function onScroll() {
        const scroll = window.scrollY;
        if (cubeVisible) spin(scroll - previousScroll);
        previousScroll = scroll;
        requestFrame();
    }

    /* New layout (window resized, fonts loaded, content that changes height): the head is placed at once, without gliding */
    function relayout() {
        measure();
        head = clampHead(reach());
        draw();
        lightSteps(reach());
        requestFrame();
    }

    timeline.classList.add("timeline--animated");
    enableCubeDrag(trigger, cube, renderCube, () => true);
    /* A click speeds the cube up for a moment, like the other cubes; not after a drag */
    trigger.addEventListener("click", () => {
        if (!cube.wasDragged) cube.clickTimeRemaining = CLICK_DURATION;
    });
    renderCube(cube);
    relayout();

    /* The cube only turns while it is on screen */
    new IntersectionObserver(entries => {
        cubeVisible = entries[entries.length - 1].isIntersecting;
        requestFrame();
    }).observe(trigger);

    /*
     * passive: true promises the browser that the listener does not block scrolling.
     */
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", relayout);
    if ("ResizeObserver" in window) new ResizeObserver(relayout).observe(document.querySelector("main") ?? timeline);
    document.fonts?.ready.then(relayout);
}
