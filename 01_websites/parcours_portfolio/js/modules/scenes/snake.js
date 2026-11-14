/*
 * Snake card scene: a green snake enters the black board and zigzags, cell by cell, to the apple and eats it.
 * Contract (card-scenes.js): createScene(media, options) returns { play(), finish() }.
 * - Before the first play(), the scene already shows its final state (apple eaten, snake one cell longer, new apple).
 * - play() runs once from the start (about 2.2 s) and ends on that final state; a new call restarts it.
 * - finish() jumps to the final state without motion.
 * Everything is drawn in one decorative SVG (aria-hidden) that replaces the card pictogram,
 * which stays in the HTML as the fallback without JavaScript.
 * Colors of a classic Snake (mission decision D10): board --ink, snake green, apple --red-accent.
 * The greens are those of the game (--snake-green, --snake-green-head, css/base/tokens.css, section "Games");
 * the same values are written as fallbacks, in case the variables are missing.
 * The top of the drawing stays empty: the hover snake of motion.css runs there.
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const VIEW_WIDTH = 290;
const VIEW_HEIGHT = 206;
const GREEN = "var(--snake-green, #3DD65F)";
const GREEN_HEAD = "var(--snake-green-head, #A6F7B8)";

/* Board: 16 x 10 cells of 16 units, centred horizontally; the media padding and BOARD_Y keep the top band free */
const CELL = 16;
const COLUMNS = 16;
const ROWS = 10;
const BOARD_X = (VIEW_WIDTH - COLUMNS * CELL) / 2;
const BOARD_Y = 20;

/* Timing: one cell every STEP ms, like the discrete moves of the game, then the apple pops back */
const STEP = 68;
const START_LENGTH = 7;

/*
 * Zigzag: the head starts just left of the board and repeats "right 3, up or down 3" (a snake cannot move diagonally).
 * [dx, dy, count] per stretch; the last stretch ends on the apple.
 */
const START = [-1, 6];
const STRETCHES = [
    [1, 0, 3], [0, -1, 3], [1, 0, 3], [0, 1, 3],
    [1, 0, 3], [0, -1, 3], [1, 0, 3], [0, 1, 3],
    [1, 0, 2]
];
const NEW_APPLE = [4, 8];
const APPLE_POP = 260;


function svg(name, attributes = {}, style = {}) {
    const element = document.createElementNS(SVG_NS, name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    Object.assign(element.style, style);
    return element;
}


/*
 * Every cell the snake goes through, tail of the starting snake first.
 * At step k the head is trail[START_LENGTH - 1 + k].
 */
function buildTrail() {
    const trail = [];
    for (let back = START_LENGTH - 1; back >= 0; back--) {
        trail.push([START[0] - back, START[1]]);
    }
    STRETCHES.forEach(([dx, dy, count]) => {
        for (let move = 0; move < count; move++) {
            const [x, y] = trail[trail.length - 1];
            trail.push([x + dx, y + dy]);
        }
    });
    return trail;
}


const TRAIL = buildTrail();
const STEPS = TRAIL.length - START_LENGTH;
const APPLE = TRAIL[TRAIL.length - 1];
const TOTAL = STEPS * STEP + APPLE_POP;


function cellX(column) {
    return BOARD_X + column * CELL;
}


function cellY(row) {
    return BOARD_Y + row * CELL;
}


function easeOut(t) {
    return 1 - (1 - t) ** 3;
}


/* Apple: round fruit and short stem, like the apple of js/games/snake/artwork.js, centred on its cell */
function createApple([column, row]) {
    const group = svg("g", {}, { transformBox: "fill-box", transformOrigin: "center" });
    const cx = cellX(column) + CELL / 2;
    const cy = cellY(row) + CELL / 2 + 1;

    group.append(
        svg("circle", { cx, cy, r: 5.6 }, { fill: "var(--red-accent)" }),
        svg("path", { d: `M${cx} ${cy - 5}q0.5 -2.5 2 -3.5` }, {
            fill: "none", stroke: "var(--white)", strokeWidth: "1.2", strokeLinecap: "round", opacity: "0.8"
        })
    );
    return group;
}


export function createScene(media, options = {}) {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sceneId = `card-scene-snake-${Math.random().toString(36).slice(2, 8)}`;

    const root = svg("svg", {
        class: "card-scene card-scene--snake",
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
        /* Decorative: drags and clicks go to the card */
        pointerEvents: "none",
        userSelect: "none"
    });

    const width = COLUMNS * CELL;
    const height = ROWS * CELL;

    /* Checkerboard of the game, very faint, and a clip so the snake enters from under the board edge */
    const defs = svg("defs");
    const pattern = svg("pattern", {
        id: `${sceneId}-grid`, x: BOARD_X, y: BOARD_Y, width: CELL * 2, height: CELL * 2, patternUnits: "userSpaceOnUse"
    });
    pattern.append(
        svg("rect", { x: 0, y: 0, width: CELL, height: CELL }, { fill: "var(--white)", opacity: "0.035" }),
        svg("rect", { x: CELL, y: CELL, width: CELL, height: CELL }, { fill: "var(--white)", opacity: "0.035" })
    );
    const clip = svg("clipPath", { id: `${sceneId}-clip` });
    clip.append(svg("rect", { x: BOARD_X, y: BOARD_Y, width, height, rx: 10 }));
    defs.append(pattern, clip);

    const board = svg("g", { "clip-path": `url(#${sceneId}-clip)` });
    board.append(
        svg("rect", { x: BOARD_X, y: BOARD_Y, width, height }, { fill: "var(--ink)" }),
        svg("rect", { x: BOARD_X, y: BOARD_Y, width, height }, { fill: `url(#${sceneId}-grid)` })
    );

    const apple = createApple(APPLE);
    const newApple = createApple(NEW_APPLE);

    /* Snake cells: one rectangle per cell, enough for the grown snake; the head (first cell) is lighter and has two eyes */
    const body = Array.from({ length: START_LENGTH + 1 }, (_, offset) => {
        const cell = svg("rect", { width: CELL - 2, height: CELL - 2, rx: 3.5 }, { fill: offset === 0 ? GREEN_HEAD : GREEN });
        board.append(cell);
        return cell;
    });
    const eyes = [0, 1].map(() => {
        const eye = svg("circle", { r: 1.6 }, { fill: "var(--ink)" });
        board.append(eye);
        return eye;
    });
    board.insertBefore(apple, body[0]);
    board.insertBefore(newApple, body[0]);

    const frame = svg("rect", { x: BOARD_X, y: BOARD_Y, width, height, rx: 10 }, {
        fill: "none", stroke: "var(--line)", strokeWidth: "1"
    });

    root.append(defs, board, frame);

    /* The card pictogram stays in the HTML as the fallback; the scene takes its place */
    media.querySelector(".project-card__icon")?.style.setProperty("display", "none");
    media.append(root);

    /*
     * Draws the snake after `step` moves. The last move lands on the apple: the snake grows by one cell
     * (its tail stays) and the apple is gone. `pop` (0 to 1) grows the new apple.
     */
    function render(step, pop) {
        const ate = step >= STEPS;
        const length = START_LENGTH + (ate ? 1 : 0);
        const headIndex = START_LENGTH - 1 + step;

        body.forEach((cell, offset) => {
            const position = TRAIL[headIndex - offset];
            if (offset >= length || !position) {
                cell.style.display = "none";
                return;
            }
            cell.style.display = "";
            cell.setAttribute("x", cellX(position[0]) + 1);
            cell.setAttribute("y", cellY(position[1]) + 1);
        });

        /* Eyes look the way the head moves */
        const [hx, hy] = TRAIL[headIndex];
        const [px, py] = TRAIL[headIndex - 1];
        const [dx, dy] = [hx - px, hy - py];
        const centerX = cellX(hx) + CELL / 2;
        const centerY = cellY(hy) + CELL / 2;
        eyes.forEach((eye, side) => {
            const sign = side === 0 ? -1 : 1;
            eye.setAttribute("cx", centerX + dx * 2.5 + dy * 3.2 * sign);
            eye.setAttribute("cy", centerY + dy * 2.5 + dx * 3.2 * sign);
        });

        apple.style.display = ate ? "none" : "";
        newApple.style.display = ate ? "" : "none";
        newApple.style.transform = `scale(${pop})`;
    }

    let frameRequest = 0;

    function stop() {
        cancelAnimationFrame(frameRequest);
        frameRequest = 0;
    }

    function finish() {
        stop();
        render(STEPS, 1);
    }

    function play() {
        stop();

        if (reducedMotion.matches) {
            finish();
            return;
        }

        const startTime = performance.now();
        render(0, 0);

        function tick(now) {
            const elapsed = now - startTime;
            if (elapsed >= TOTAL) {
                finish();
                return;
            }
            const step = Math.min(STEPS, Math.floor(elapsed / STEP));
            const pop = step < STEPS ? 0 : easeOut(Math.min(1, (elapsed - STEPS * STEP) / APPLE_POP));
            render(step, pop);
            frameRequest = requestAnimationFrame(tick);
        }

        frameRequest = requestAnimationFrame(tick);
    }

    finish();

    return { play, finish };
}
