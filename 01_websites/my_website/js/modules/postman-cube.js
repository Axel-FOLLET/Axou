/*
 * Postman cube of the Contact me page: a large cube next to the form, which carries the message.
 * - one face per filled field: the cube turns a quarter turn and lights the face it shows;
 *   an emptied field gives its face back, by the opposite quarter turn;
 * - while the message is being sent, the cube spins and waits;
 * - once the message is accepted, the cube closes, gathers momentum and flies off the page,
 *   then a new cube comes back for the next message;
 * - refused form (invalid field on submission, failed send): the cube shakes its head.
 * The cube only reads the form: it listens to the fields and to the events sent by contact.js
 * (contact:invalid, contact:sending, contact:sent, contact:error). The styles are in components/postman-cube.css.
 *
 * No animation loop: each movement is a transform animation started once (Web Animations),
 * the life at rest is a CSS animation. Nothing moves off screen, in a hidden tab or with reduced motion:
 * the faces then change state at once.
 */

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)");


// -------------------- SETTINGS --------------------

const TURN_DURATION = 560;      // ms of a quarter turn
const TURN_FAST = 300;          // ms of a quarter turn when several follow one another
const SPIN_DURATION = 2400;     // ms of a full turn while the message is being sent
const SHAKE_DURATION = 680;     // ms of the "no"
const CROUCH_DURATION = 380;    // ms during which the cube gathers momentum
const LAUNCH_DURATION = 720;    // ms of the flight off the page
const RETURN_DELAY = 450;       // ms of empty place before the new cube
const ARRIVE_DURATION = 850;    // ms of the arrival of the new cube
const SEALED_HOLD = 1600;       // ms during which the closed cube stays lit when nothing can move
const GLIDE_DURATION = 450;     // ms for the cube to land on its new place when a message of the form pushes it down
const GLIDE_MARGIN = 12;        // px kept free between the form and the cube during that landing
const GLIDE_HEADROOM = 0.15;    // share of its size the cube never reaches at the top of its box (measured: 0.15 to 0.26)
const GLIDE_MAX = 240;          // px beyond which the cube changes place at once (layout change, not a message)

/*
 * Order in which the faces are shown. Each face is a neighbour of the previous one,
 * so a single quarter turn always leads to the next. The first one is the face at rest (the envelope).
 */
const TURN_PATH = ["front", "right", "top", "left", "bottom", "back"];
/*
 * Without movement, the cube never turns: the faces light up from the most visible to the least visible,
 * and the back face is kept for the closing.
 */
const STILL_PATH = ["back", "front", "top", "right", "left", "bottom"];

// Direction each face looks at before any turn: x to the right, y downward, z toward the visitor
const NORMALS = {
    front: [0, 0, 1], back: [0, 0, -1],
    right: [1, 0, 0], left: [-1, 0, 0],
    top: [0, -1, 0], bottom: [0, 1, 0]
};

// Quarter turns as 3 x 3 matrices (rows), same conventions as the CSS functions rotateX and rotateY
const QUARTER_TURNS = {
    "X90": [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
    "X-90": [[1, 0, 0], [0, 0, 1], [0, -1, 0]],
    "Y90": [[0, 0, 1], [0, 1, 0], [-1, 0, 0]],
    "Y-90": [[0, 0, -1], [0, 1, 0], [1, 0, 0]]
};

const IDENTITY = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];


// -------------------- ORIENTATION --------------------

function multiply(a, b) {
    return a.map(row => b[0].map((_, column) => row[0] * b[0][column] + row[1] * b[1][column] + row[2] * b[2][column]));
}


function applyTo(matrix, [x, y, z]) {
    return matrix.map(row => row[0] * x + row[1] * y + row[2] * z);
}


/*
 * CSS writes its matrices column by column.
 */
function matrixToCss(m) {
    return "matrix3d(" + [
        m[0][0], m[1][0], m[2][0], 0,
        m[0][1], m[1][1], m[2][1], 0,
        m[0][2], m[1][2], m[2][2], 0,
        0, 0, 0, 1
    ].join(",") + ")";
}


/*
 * Quarter turn that brings a face in front of the visitor: the face is on one of the four sides,
 * so it comes around the vertical axis (left, right) or the horizontal one (top, bottom).
 * Returns null if the face is already in front.
 */
function turnToward(orientation, faceName) {
    const [x, y] = applyTo(orientation, NORMALS[faceName]);
    if (x) return { axis: "Y", angle: -90 * x };
    if (y) return { axis: "X", angle: 90 * y };
    return null;
}


// -------------------- CUBE --------------------

/*
 * Form or cube missing from the page: the function stops.
 */
export function initPostmanCube() {
    const figure = document.querySelector(".postman");
    const form = document.getElementById("contact-form");
    if (!figure || !form) return;

    const flight = figure.querySelector(".postman__flight");
    const turntable = figure.querySelector(".postman__turntable");
    const cube = figure.querySelector(".postman__cube");
    const ground = figure.querySelector(".postman__ground");
    if (!flight || !turntable || !cube || !ground) return;

    const faces = new Map(Object.keys(NORMALS).map(name => [name, cube.querySelector(".postman__face--" + name)]));
    const fields = [...form.querySelectorAll(".form__input")];

    let orientation = IDENTITY;
    // Number of loaded faces shown by the cube, and number asked by the form
    let shown = 0;
    let wanted = 0;
    // "idle", or "busy" from the start of a send to the return of the cube: the fields are read again afterwards
    let state = "idle";
    let spinning = [];
    let refusing = false;
    // onScreen: at least one pixel of the cube is on screen; inView: at least half of it, the visitor can watch a turn
    let onScreen = false;
    let inView = false;
    // The movements follow one another: each one waits for the end of the previous
    let queue = Promise.resolve();


    function enqueue(task) {
        queue = queue.then(task).catch(() => {});
        return queue;
    }


    function canMove() {
        return !REDUCED_MOTION.matches && onScreen && !document.hidden;
    }


    /*
     * The faces only change in front of the visitor. Under the form (phone), the cube is off screen while the fields
     * are filled: it keeps its turns for the moment it comes on screen, and makes them one after the other.
     * Without movement there is nothing to watch: the faces change at once.
     */
    function canWatch() {
        return REDUCED_MOTION.matches || (inView && !document.hidden);
    }


    // -------------------- FACES --------------------

    /*
     * A field counts when it is filled and valid, like the tick of contact.js.
     */
    function countFilled() {
        return fields.filter(field => field.value.trim() !== "" && field.validity.valid).length;
    }


    function path() {
        return REDUCED_MOTION.matches ? STILL_PATH : TURN_PATH;
    }


    /*
     * Lights the first faces of the path (all six once the cube is closed); delays, in ms, postpones the light of some faces.
     */
    function showLights(count, sealed = false, delays = {}) {
        const lit = sealed ? [...faces.keys()] : path().slice(1, count + 1);
        for (const [name, face] of faces) {
            face.style.setProperty("--postman-light-delay", (delays[name] ?? 0) + "ms");
            face.classList.toggle("postman__face--lit", lit.includes(name));
        }
        figure.classList.toggle("postman--sealed", sealed);
        figure.style.setProperty("--postman-charge", (lit.length / faces.size).toFixed(2));
    }


    /*
     * Turns the cube to show a face. The final orientation is written first, the animation plays over it:
     * at its end the cube is already in place, with whole numbers only (no drift after many turns).
     */
    function turnTo(faceName, duration) {
        const turn = turnToward(orientation, faceName);
        if (!turn) return Promise.resolve();
        const from = matrixToCss(orientation);
        orientation = multiply(QUARTER_TURNS[turn.axis + turn.angle], orientation);
        cube.style.transform = matrixToCss(orientation);
        if (!canMove()) return Promise.resolve();
        const rotate = angle => "rotate" + turn.axis + "(" + angle + "deg) " + from;
        // A clean quarter turn: lively start, slight overshoot, then the face locks in place
        return cube.animate([
            { transform: rotate(0), easing: "cubic-bezier(0.5, 0, 0.2, 1)" },
            { transform: rotate(turn.angle * 1.07), offset: 0.72, easing: "ease-in-out" },
            { transform: rotate(turn.angle) }
        ], { duration }).finished;
    }


    /*
     * Brings the cube to the number of faces asked by the form, one quarter turn at a time.
     * Forward: the next face comes in front and lights up when it arrives. Backward: the face goes dark and the cube turns back.
     */
    async function settle() {
        while (state === "idle" && shown !== wanted && canWatch()) {
            const duration = Math.abs(wanted - shown) > 1 ? TURN_FAST : TURN_DURATION;
            if (wanted > shown) {
                shown++;
                const name = path()[shown];
                showLights(shown, false, canMove() ? { [name]: duration * 0.45 } : {});
            } else {
                shown--;
                showLights(shown);
            }
            if (!REDUCED_MOTION.matches) await turnTo(path()[shown], duration);
        }
    }


    function sync() {
        wanted = countFilled();
        enqueue(settle);
    }


    /*
     * Puts the cube back in the state asked by the form, with no movement
     * (new cube after a send, motion preference changed during the visit).
     */
    function redraw() {
        cube.getAnimations().forEach(animation => animation.cancel());
        orientation = IDENTITY;
        shown = wanted = countFilled();
        if (!REDUCED_MOTION.matches) {
            for (const name of TURN_PATH.slice(1, shown + 1)) {
                const turn = turnToward(orientation, name);
                if (turn) orientation = multiply(QUARTER_TURNS[turn.axis + turn.angle], orientation);
            }
        }
        cube.style.transform = matrixToCss(orientation);
        showLights(shown);
    }


    // -------------------- SENDING --------------------

    /*
     * Angle of the turntable at this instant, from 0 to 360: read in the matrix computed by the browser.
     */
    function turntableAngle() {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(turntable).transform);
        return (Math.atan2(-matrix.m13, matrix.m11) * 180 / Math.PI + 360) % 360;
    }


    /*
     * Waiting: the cube spins around the vertical axis. A first turn takes speed,
     * then the following ones keep it (the curve of the first turn ends at that same speed).
     */
    function startWaiting() {
        state = "busy";
        figure.classList.add("postman--waiting");
        if (!canMove()) return;
        const frames = [{ transform: "rotateY(0deg)" }, { transform: "rotateY(360deg)" }];
        spinning = [
            turntable.animate(frames, { duration: SPIN_DURATION, easing: "cubic-bezier(0.3, 0, 0.7, 0.7)" }),
            turntable.animate(frames, { duration: SPIN_DURATION, delay: SPIN_DURATION, iterations: Infinity })
        ];
    }


    /*
     * End of the waiting: returns the angle where the spin stops, for the movement that follows.
     */
    function stopWaiting() {
        const angle = turntableAngle();
        spinning.forEach(animation => animation.cancel());
        spinning = [];
        figure.classList.remove("postman--waiting");
        return angle;
    }


    /*
     * Where the cube flies to, in px from its place. Wide screens (--postman-exit: up, contact.css):
     * above the top of the screen, drifting right as far as the screen allows. Under the form (side): past the right edge.
     */
    function exitVector() {
        const box = flight.getBoundingClientRect();
        const screenWidth = document.documentElement.clientWidth;
        if (getComputedStyle(figure).getPropertyValue("--postman-exit").trim() === "side") {
            return { x: screenWidth - box.left + box.width, y: -box.height * 0.2 };
        }
        const drift = Math.max(0, Math.min(box.width * 0.7, screenWidth - box.right - box.width * 0.5));
        return { x: drift, y: -(box.bottom + box.height) };
    }


    /*
     * The message is accepted: the cube closes (every face lights up), gathers momentum while it spins faster,
     * flies off the page, then a new cube, all faces dark, rises in its place.
     * Without movement: the closed cube stays lit for a moment, then gives way to the new one.
     */
    async function leave() {
        const angle = stopWaiting();
        const order = [...faces.keys()].filter(name => !faces.get(name).classList.contains("postman__face--lit"));
        const move = canMove();
        showLights(shown, true, move ? Object.fromEntries(order.map((name, index) => [name, index * 50])) : {});

        if (!move) {
            await new Promise(resolve => setTimeout(resolve, SEALED_HOLD));
            state = "idle";
            redraw();
            return;
        }

        const exit = exitVector();
        const place = (x, y, scale) => "translate3d(" + x.toFixed(1) + "px, " + y.toFixed(1) + "px, 0) scale(" + scale + ")";
        const crouched = place(0, 14, 0.88);

        try {
            // The spin speeds up from the first instant to the end of the flight
            turntable.animate(
                [{ transform: "rotateY(" + angle + "deg)" }, { transform: "rotateY(1080deg)" }],
                { duration: CROUCH_DURATION + LAUNCH_DURATION, easing: "cubic-bezier(0.3, 0.1, 0.8, 0.5)", fill: "forwards" }
            );
            await flight.animate(
                [{ transform: place(0, 0, 1) }, { transform: crouched }],
                { duration: CROUCH_DURATION, easing: "cubic-bezier(0.3, 0, 0.3, 1)", fill: "forwards" }
            ).finished;

            // Under the cube, the light bursts and goes out
            ground.animate(
                [{ opacity: 1, transform: "translate(-50%, -50%) scale(1)" }, { opacity: 0, transform: "translate(-50%, -50%) scale(1.35)" }],
                { duration: LAUNCH_DURATION * 0.7, easing: "ease-out" }
            );
            figure.classList.add("postman--away");
            await flight.animate([
                { transform: crouched, opacity: 1 },
                { transform: place(exit.x * 0.12, exit.y * 0.22, 0.8), opacity: 1, offset: 0.3 },
                { transform: place(exit.x * 0.5, exit.y * 0.62, 0.5), opacity: 1, offset: 0.66 },
                { transform: place(exit.x, exit.y, 0.3), opacity: 0 }
            ], { duration: LAUNCH_DURATION, easing: "cubic-bezier(0.6, 0, 0.9, 0.5)", fill: "forwards" }).finished;

            // New cube: prepared out of sight (its animations hold their first image during the delay), then shown
            const gone = [...flight.getAnimations(), ...turntable.getAnimations()];
            redraw();
            const arrive = flight.animate([
                { transform: place(0, 46, 0.55), opacity: 0 },
                { transform: place(0, -7, 1.03), opacity: 1, offset: 0.7, easing: "ease-in-out" },
                { transform: place(0, 0, 1), opacity: 1 }
            ], { duration: ARRIVE_DURATION, delay: RETURN_DELAY, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", fill: "backwards" });
            const settleSpin = turntable.animate(
                [{ transform: "rotateY(-270deg)" }, { transform: "rotateY(0deg)" }],
                { duration: ARRIVE_DURATION, delay: RETURN_DELAY, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", fill: "backwards" }
            );
            gone.forEach(animation => animation.cancel());
            // The lights around the cube come back when the new cube appears
            await ground.animate([{ opacity: 0 }, { opacity: 0 }], { duration: RETURN_DELAY }).finished;
            figure.classList.remove("postman--away");
            await Promise.all([arrive.finished, settleSpin.finished]);
        } catch {
            // A movement was interrupted: the new cube is put in place at once
            [...flight.getAnimations(), ...turntable.getAnimations()].forEach(animation => animation.cancel());
            redraw();
        } finally {
            figure.classList.remove("postman--away");
            state = "idle";
        }
        // Fields typed during the flight: the new cube takes them into account
        wanted = countFilled();
        await settle();
    }


    /*
     * "No": the cube turns its head left and right around the vertical axis, less and less.
     * start is the angle the turntable had (the spin of a failed send stops there).
     */
    function shake(start) {
        if (!canMove()) return Promise.resolve();
        const head = (angle, shift) => "translate3d(" + shift + "px, 0, 0) rotateY(" + angle + "deg)";
        const from = start > 180 ? start - 360 : start;
        return turntable.animate([
            { transform: head(from, 0), easing: "ease-in-out" },
            { transform: head(-28, -9), offset: 0.16, easing: "ease-in-out" },
            { transform: head(24, 8), offset: 0.36, easing: "ease-in-out" },
            { transform: head(-16, -5), offset: 0.54, easing: "ease-in-out" },
            { transform: head(10, 3), offset: 0.7, easing: "ease-in-out" },
            { transform: head(-4, -1), offset: 0.85, easing: "ease-in-out" },
            { transform: head(0, 0) }
        ], { duration: SHAKE_DURATION }).finished;
    }


    /*
     * Refused form (invalid submission or failed send). A refusal that comes during a "no" does not add a second one.
     */
    function refuse() {
        if (refusing) return;
        refusing = true;
        enqueue(async () => {
            const angle = stopWaiting();
            state = "idle";
            wanted = countFilled();
            await settle();
            await shake(angle);
        }).then(() => {
            refusing = false;
        });
    }


    // -------------------- LISTENING --------------------

    // A field is left or changed (typing finished, autofill): its face is loaded or given back
    form.addEventListener("focusout", sync);
    form.addEventListener("change", sync);
    // Enter in a field submits without leaving it: the fields are read again
    form.addEventListener("submit", sync);
    // The values are emptied just after the "reset" event
    form.addEventListener("reset", () => setTimeout(sync));

    // The cube listens while a field of the form has the focus
    form.addEventListener("focusin", () => figure.classList.add("postman--listening"));
    form.addEventListener("focusout", event => {
        if (!form.contains(event.relatedTarget)) figure.classList.remove("postman--listening");
    });

    form.addEventListener("contact:invalid", refuse);
    form.addEventListener("contact:sending", () => enqueue(startWaiting));
    form.addEventListener("contact:sent", () => enqueue(leave));
    form.addEventListener("contact:error", refuse);

    /*
     * Off screen or hidden tab: the life at rest and the spin stop (class read by postman-cube.css).
     * Only a running animation is paused and only a paused one resumes: play() would restart a finished one.
     */
    function updatePause() {
        const paused = !onScreen || document.hidden;
        figure.classList.toggle("postman--paused", paused);
        for (const animation of spinning) {
            if (paused && animation.playState === "running") animation.pause();
            else if (!paused && animation.playState === "paused") animation.play();
        }
        // Back in front of the visitor: the turns kept while the cube was out of sight are made now
        if (canWatch()) enqueue(settle);
    }
    // Two thresholds: the first pixel on screen (pause) and half of the cube on screen (turns)
    new IntersectionObserver(entries => {
        const entry = entries[entries.length - 1];
        onScreen = entry.isIntersecting;
        inView = entry.intersectionRatio >= 0.5;
        updatePause();
    }, { threshold: [0, 0.5] }).observe(figure.querySelector(".postman__stage"));
    document.addEventListener("visibilitychange", updatePause);

    /*
     * Under the form (narrow screens), a message that appears in the form pushes the cube down in one go.
     * The cube lands softly instead: it starts a little above its new place and comes down to it (transform only).
     * It never starts from inside the form: the start is limited to the free space between the form and the cube,
     * so the cube does not pass behind the message that has just appeared. That space is computed from the layout alone
     * (offsetTop, offsetHeight: no running movement changes them): the margin above the cube (contact.css) plus the band
     * the cube never reaches at the top of its own box. A message that disappears lets the cube glide all the way up.
     * Two messages can follow each other closely ("sending", then the result): the new landing starts from where
     * the previous one had brought the cube. On wide screens the cube is out of the flow, offsetTop never changes: nothing happens.
     */
    const stage = figure.querySelector(".postman__stage");
    let lastTop = figure.offsetTop;
    let landing = null;
    new ResizeObserver(() => {
        const pushed = lastTop - figure.offsetTop;
        lastTop = figure.offsetTop;
        if (!pushed) return;
        // Offset left by the landing still in progress
        const pending = landing?.playState === "running" ? new DOMMatrixReadOnly(getComputedStyle(stage).transform).m42 : 0;
        landing?.cancel();
        landing = null;
        if (Math.abs(pushed) > GLIDE_MAX || !canMove()) return;
        let start = pending + pushed;
        if (start < 0) {
            const gap = figure.offsetTop - (form.offsetTop + form.offsetHeight);
            const room = gap + cube.offsetWidth * GLIDE_HEADROOM - GLIDE_MARGIN;
            start = -Math.min(-start, Math.max(0, room));
        }
        if (!start) return;
        landing = stage.animate(
            [{ transform: "translate3d(0, " + start.toFixed(1) + "px, 0)" }, { transform: "translate3d(0, 0, 0)" }],
            { duration: GLIDE_DURATION, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
        );
    }).observe(form);

    // The preference can change during the visit: the cube is redrawn in the other mode, with no movement
    REDUCED_MOTION.addEventListener("change", () => enqueue(() => {
        if (state === "idle") redraw();
    }));

    // Fields already filled when the page opens (values restored by the browser, also when coming back to the page)
    showLights(0);
    cube.style.transform = matrixToCss(orientation);
    sync();
    window.addEventListener("pageshow", event => {
        if (event.persisted) sync();
    });
}
