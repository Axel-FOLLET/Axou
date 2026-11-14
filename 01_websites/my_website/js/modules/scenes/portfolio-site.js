/*
 * Parcours & Portfolio card scene: the home page of this site in miniature.
 * On the black page, the two door cubes (blue towards Mon parcours, red towards Mon portfolio) spin in
 * from opposite directions and settle, their labels rise under them, and the FR / EN switch appears.
 *
 * Scene contract (card-scenes.js): createScene(media, { language }) returns { play(), finish() }.
 * The drawing at rest IS the final state: play() animates towards it (Web Animations API for the page,
 * requestAnimationFrame for the cube rotation, stopped at the end), finish() shows it at once.
 * No loop, nothing outside the media box; the top 20 units stay empty for the hover sprite of motion.css.
 * It replaces the white card cube: that cube spins forever (init-cubes.js), the scene must stop on its final state.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

// Door labels of the home page (door__label in index.html and pages/en/index.html); the switch shows FR and EN as in the header
const TEXTS = {
    fr: { doors: ["Mon parcours", "Mon portfolio"] },
    en: { doors: ["My background", "My portfolio"] }
};
const LANGUAGES = ["fr", "en"];

const VIEW_BOX = "0 0 256 210";
const PAGE = { x: 8, y: 24, width: 240, height: 176, radius: 12 };

/*
 * The two doors: same size, colours of tokens.css (blue and red cubes are only used on the home page,
 * the 404 page and here, where they stand for the home page). They spin in opposite directions, as on the home page.
 * Angles in degrees; spin = extra turn at the start, undone by the end.
 */
const CUBES = [
    { centerX: 80, centerY: 108, edge: "var(--blue-accent)", fill: "var(--cube-blue-fill)", glow: "var(--cube-blue-glow)", rest: { x: -22, y: 34 }, spin: { x: 30, y: -210 } },
    { centerX: 176, centerY: 108, edge: "var(--red-accent)", fill: "var(--cube-red-fill)", glow: "var(--cube-red-glow)", rest: { x: -22, y: -34 }, spin: { x: 30, y: 210 } }
];
const CUBE_SIZE = 52;
const PERSPECTIVE = 260;
const CUBE_DELAY = 220;
const CUBE_DURATION = 1600;
const CUBE_STAGGER = 120;

// Cube corners (±1) and the four corners of each face
const CORNERS = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
const FACES = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [3, 2, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5]];


function svgElement(name, attributes = {}, style = {}) {
    const element = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
    Object.assign(element.style, style);
    return element;
}


function cssToken(name, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}


// Strong deceleration, like a cube thrown and slowing down (init-cubes.js keeps some momentum after a drag)
function easeOutCubic(progress) {
    return 1 - (1 - progress) ** 3;
}


/*
 * Rotates the corners (around X, then Y), applies the perspective and writes the six faces.
 * scale (0 to 1) lets the cube grow while it arrives.
 */
function drawCube(cube, angleX, angleY, scale) {
    const radiansX = angleX * Math.PI / 180;
    const radiansY = angleY * Math.PI / 180;
    const half = CUBE_SIZE / 2 * scale;
    const points = CORNERS.map(([x, y, z]) => {
        const y1 = y * Math.cos(radiansX) - z * Math.sin(radiansX);
        const z1 = y * Math.sin(radiansX) + z * Math.cos(radiansX);
        const x2 = x * Math.cos(radiansY) + z1 * Math.sin(radiansY);
        const z2 = -x * Math.sin(radiansY) + z1 * Math.cos(radiansY);
        const depth = PERSPECTIVE / (PERSPECTIVE + z2 * half);
        return [cube.centerX + x2 * half * depth, cube.centerY + y1 * half * depth];
    });
    cube.faces.forEach((face, index) => {
        face.setAttribute("points", FACES[index].map(corner => points[corner].map(value => value.toFixed(2)).join(",")).join(" "));
    });
}


export function createScene(media, options = {}) {
    const language = LANGUAGES.includes(options.language) ? options.language : "fr";
    const texts = TEXTS[language];
    const easeOut = cssToken("--ease-out", "cubic-bezier(0.2, 0.8, 0.2, 1)");

    const svg = svgElement("svg", { viewBox: VIEW_BOX, "aria-hidden": "true", focusable: "false", class: "card-scene card-scene--portfolio-site" }, {
        display: "block", width: "100%", height: "100%", overflow: "hidden", fontFamily: "inherit"
    });

    // Black home page, with a faint white border so it detaches from the red card
    const page = svgElement("rect", { x: PAGE.x, y: PAGE.y, width: PAGE.width, height: PAGE.height, rx: PAGE.radius }, {
        fill: "var(--ink)", stroke: "var(--line)", strokeWidth: "1", transformBox: "fill-box", transformOrigin: "50% 50%"
    });
    svg.append(page);

    // FR / EN switch, top right as in the site header; the current language is bright and underlined
    const switchGroup = svgElement("g");
    LANGUAGES.forEach((code, index) => {
        const isCurrent = code === language;
        const label = svgElement("text", { x: 208 + index * 22, y: 42, "text-anchor": "middle" }, {
            fill: "var(--white)", opacity: isCurrent ? "1" : "0.55", fontSize: "8.5px", fontWeight: isCurrent ? "700" : "500"
        });
        label.textContent = code.toUpperCase();
        switchGroup.append(label);
        if (isCurrent) switchGroup.append(svgElement("rect", { x: 208 + index * 22 - 6, y: 46, width: 12, height: 1.5, rx: 0.75 }, { fill: "var(--white)" }));
    });
    svg.append(switchGroup);

    const cubes = CUBES.map(settings => {
        const group = svgElement("g", {}, { filter: `drop-shadow(0 0 5px ${settings.glow})` });
        const faces = FACES.map(() => svgElement("polygon", {}, {
            fill: settings.fill, stroke: settings.edge, strokeWidth: "1.5", strokeLinejoin: "round"
        }));
        group.append(...faces);
        svg.append(group);
        return { ...settings, group, faces };
    });

    const labels = texts.doors.map((name, index) => {
        const label = svgElement("text", { x: CUBES[index].centerX, y: 176, "text-anchor": "middle" }, {
            fill: "var(--white)", fontSize: "10px", fontWeight: "600"
        });
        label.textContent = name;
        svg.append(label);
        return label;
    });

    // The original markup stays in the page as the no-JavaScript fallback, hidden behind the scene
    for (const child of media.children) child.style.display = "none";
    media.append(svg);

    let animations = [];
    let frameId = null;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function drawRestingCubes() {
        for (const cube of cubes) {
            drawCube(cube, cube.rest.x, cube.rest.y, 1);
            cube.group.style.opacity = "";
        }
    }

    /*
     * One frame of the cube arrival: each cube fades in, grows and spins back to its resting angle.
     * The loop stops by itself once both cubes are at rest.
     */
    function drawFrame(startTime, now) {
        let running = false;
        cubes.forEach((cube, index) => {
            const elapsed = now - startTime - CUBE_DELAY - index * CUBE_STAGGER;
            const progress = Math.min(Math.max(elapsed / CUBE_DURATION, 0), 1);
            if (progress < 1) running = true;
            const eased = easeOutCubic(progress);
            const left = 1 - eased;
            drawCube(cube, cube.rest.x + cube.spin.x * left, cube.rest.y + cube.spin.y * left, 0.55 + 0.45 * easeOutCubic(Math.min(progress * 1.6, 1)));
            cube.group.style.opacity = String(Math.min(progress * 4, 1));
        });
        frameId = running ? requestAnimationFrame(time => drawFrame(startTime, time)) : null;
    }

    function finish() {
        for (const animation of animations) animation.cancel();
        animations = [];
        if (frameId !== null) cancelAnimationFrame(frameId);
        frameId = null;
        drawRestingCubes();
    }

    function animate(element, keyframes, timing) {
        animations.push(element.animate(keyframes, { fill: "backwards", easing: easeOut, ...timing }));
    }

    function play() {
        finish();
        if (reducedMotion.matches) return;

        animate(page, [{ opacity: 0, transform: "scale(0.94)" }, { opacity: 1, transform: "scale(1)" }], { duration: 500 });
        animate(switchGroup, [{ opacity: 0 }, { opacity: 1 }], { delay: 950, duration: 400 });
        labels.forEach((label, index) => {
            animate(label, [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }], {
                delay: 1150 + index * CUBE_STAGGER, duration: 500
            });
        });

        const startTime = performance.now();
        drawFrame(startTime, startTime);
    }

    drawRestingCubes();
    return { play, finish };
}
