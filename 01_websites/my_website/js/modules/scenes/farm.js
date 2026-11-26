/*
 * "2D game in Java" card scene, drawn without any scenery: the canvas is transparent and the red of the card is the background.
 * Contract (card-scenes.js): createScene(media) returns { prepare(), play(), finish() }.
 * - Before the first play(), the scene shows the day: a soft sun top left, Old Garry dozing on his rocking chair, the urn on his left.
 * - play() runs once from the start (about 3.9 s): Garry rocks once; night comes (the sun turns into a crescent moon, stars come out);
 *   Mr Chmunks comes up from below, behind the urn, and carries it away to the left; a bat flies in from the top right
 *   and the witch appears on the right. It ends on that night: the urn is gone and Garry faces his two enemies.
 * - finish() jumps to the final state without motion.
 * The sprites are those of the game at their own size (assets/images/2dgame-java): one sprite pixel is one unit of the
 * 144 by 100 view, and two CSS pixels on a full-size card (.farm-scene in portfolio.css). The canvas holds SCALE pixels
 * per unit, so the moves and the tilt of the chair stay smooth.
 */

const WIDTH = 144;
const HEIGHT = 100;
const SCALE = 4;
const GROUND = 96;
const DURATION = 4150;
/* The timeline below is played SPEED times faster than written */
const SPEED = 1.06;
const names = ["garry-chair-0", "garry-chair-1", "garry-chair-2", "garry-chair-3", "urn", "chmunks-0", "chmunks-1",
    "bat-0", "bat-1", "bat-2", "bat-3", "witch", "witch-attack", "puff-0", "puff-1", "shadow"];

/* Timeline, in ms */
const ROCK = [350, 1400];
const NIGHT = [1400, 2200];
const RISE = [2100, 2420];
const CARRY = [2230, 2930];
const BAT_FLIGHT = [2600, 3350];
const PUFF = [3100, 3540];
const WITCH_IN = [3200, 3520];
const CAST = [3700, 4000];

/* Places, in view units: x is the left of the sprite, the feet stand on GROUND */
const SUN = { x: 13, y: 14, radius: 6 };
const GARRY_X = 28;
const URN_X = 0;
const URN_Y = GROUND - 48;
const THIEF_X = URN_X + 6;
const BAT_X = 74;
const BAT_Y = -15;
const WITCH_X = 84;

const SUN_COLOR = [255, 214, 130];
const MOON_COLOR = [244, 236, 214];
/* Stars: x, y, big (a small cross) or not, delay after the start of the night */
const STARS = [[35, 8, 1, 0], [52, 19, 0, 130], [64, 5, 0, 250], [27, 31, 0, 360], [87, 12, 1, 470], [3, 38, 0, 560]];
/* Tilt of the chair along the rock, in degrees: back, forward, then it settles */
const ROCK_KEYS = [[0, 0], [0.34, -9], [0.7, 4], [0.9, -1.5], [1, 0]];
const BAT_FRAMES = [1, 2, 3, 2];

function progress(time, [from, to]) {
    return Math.max(0, Math.min(1, (time - from) / (to - from)));
}

function easeInOut(p) {
    return p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p);
}

function easeOut(p) {
    return 1 - (1 - p) ** 3;
}

function easeOutBack(p) {
    return 1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2;
}

function keyframes(p, keys) {
    for (let i = 1; i < keys.length; i++) {
        if (p <= keys[i][0]) {
            const [from, a] = keys[i - 1];
            const [to, b] = keys[i];
            return a + (b - a) * easeInOut((p - from) / (to - from));
        }
    }
    return keys[keys.length - 1][1];
}

export function createScene(media) {
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH * SCALE;
    canvas.height = HEIGHT * SCALE;
    canvas.className = "farm-scene";
    canvas.setAttribute("aria-hidden", "true");
    const ctx = canvas.getContext("2d");
    const images = new Map();
    const ready = Promise.all(names.map(async name => {
        const image = new Image();
        image.src = new URL("../../../assets/images/2dgame-java/" + name + ".png", import.meta.url);
        await image.decode();
        images.set(name, image);
    })).then(() => {
        media.replaceChildren(canvas);
        draw(0);
    });
    // The controller handles image errors through prepare, play and finish.
    ready.catch(() => {});

    let frame = 0;
    let version = 0;

    /*
     * Draws a sprite with its left top corner at (x, y). Options: alpha, mirror (facing left instead of right),
     * and a turn (angle in radians) or a stretch (scaleX, scaleY) around the point (pivotX, pivotY) of the sprite.
     */
    function sprite(name, x, y, { alpha = 1, mirror = false, angle = 0, scaleX = 1, scaleY = 1, pivotX = 0, pivotY = 0 } = {}) {
        if (alpha <= 0) return;
        const image = images.get(name);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(x + pivotX, y + pivotY);
        if (angle) ctx.rotate(angle);
        ctx.scale(mirror ? -scaleX : scaleX, scaleY);
        ctx.drawImage(image, mirror ? pivotX - image.width : -pivotX, -pivotY);
        ctx.restore();
    }

    /* Soft shadow on the ground, centred on x */
    function shadow(x, width, alpha = 1) {
        if (alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.drawImage(images.get("shadow"), x - width / 2, GROUND - 5, width, 8);
        ctx.restore();
    }

    /*
     * Sun, then moon, in view pixels: at night a second disc slides over the first one and cuts the crescent.
     */
    function sky(time) {
        const night = easeInOut(progress(time, NIGHT));
        const { x, y, radius } = SUN;
        const color = SUN_COLOR.map((value, i) => Math.round(value + (MOON_COLOR[i] - value) * night));
        ctx.fillStyle = "rgb(" + color.join(",") + ")";
        const cutX = radius * (0.5 + 2.4 * (1 - night));
        const cutY = -radius * (0.4 + (1 - night));
        const cut = (radius - 0.4) ** 2;
        // A faint halo, then the disc itself.
        for (const [reach, alpha] of [[radius + 3, 0.16], [radius, 0.86]]) {
            ctx.globalAlpha = alpha;
            for (let dy = -reach; dy <= reach; dy++) {
                for (let dx = -reach; dx <= reach; dx++) {
                    if (dx * dx + dy * dy > reach * reach + reach * 0.6) continue;
                    if (reach === radius && (dx - cutX) ** 2 + (dy - cutY) ** 2 <= cut) continue;
                    ctx.fillRect(x + dx, y + dy, 1, 1);
                }
            }
        }
        // Rays of the day: they shorten as the night comes.
        ctx.globalAlpha = 0.9 * Math.max(0, 1 - night * 3);
        const far = radius + 3;
        const side = Math.round(far * 0.72);
        const long = Math.floor(time / 450) % 2;
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
            const length = long ? 3 : 2;
            ctx.fillRect(x + dx * far + (dx < 0 ? 1 - length : 0), y + dy * far + (dy < 0 ? 1 - length : 0), dx ? length : 1, dy ? length : 1);
        }
        for (const [dx, dy] of [[1, -1], [1, 1], [-1, 1], [-1, -1]]) {
            ctx.fillRect(x + dx * side, y + dy * side, 1, 1);
            if (!long) ctx.fillRect(x + dx * (side + 1), y + dy * (side + 1), 1, 1);
        }
        // Stars come out one after the other, with a small pop.
        ctx.fillStyle = "rgb(" + MOON_COLOR.join(",") + ")";
        STARS.forEach(([starX, starY, big, delay]) => {
            const from = NIGHT[0] + 280 + delay;
            const pop = progress(time, [from, from + 300]);
            if (pop <= 0) return;
            ctx.globalAlpha = Math.min(1, pop * 2) * (big ? 0.95 : 0.8);
            ctx.fillRect(starX, starY, 1, 1);
            const arm = big ? (pop < 0.7 ? 2 : 1) : (pop < 0.7 ? 1 : 0);
            for (let reach = 1; reach <= arm; reach++) {
                ctx.fillRect(starX - reach, starY, 1, 1);
                ctx.fillRect(starX + reach, starY, 1, 1);
                ctx.fillRect(starX, starY - reach, 1, 1);
                ctx.fillRect(starX, starY + reach, 1, 1);
            }
        });
        ctx.globalAlpha = 1;
    }

    /*
     * Mr Chmunks and the urn. He comes up from below the view, behind the urn, lifts it and runs off to the left
     * while he is still rising. He fades in at the bottom and out on the left, since the view has no visible edge.
     */
    function theft(time) {
        const rise = progress(time, RISE);
        const carry = progress(time, CARRY);
        const run = carry * carry * 46;
        const thiefX = THIEF_X - run;
        const step = time >= RISE[1] ? Math.floor((time - RISE[1]) / 105) % 2 : 0;
        const thiefY = GROUND - 60 + (1 - easeOutBack(rise)) * 62 - step;
        const leaving = 1 - progress(-8 - thiefX, [0, 22]) ** 2;

        // The urn stands on the ground, then follows the hands of the thief.
        const urnY = rise > 0 ? Math.min(URN_Y, thiefY + 2) : URN_Y;
        const lifted = Math.min(1, (URN_Y - urnY) / 8);
        shadow(URN_X + 32, 26, 1 - lifted);
        if (rise > 0 && carry < 1) sprite("chmunks-" + step, thiefX, thiefY, { alpha: Math.min(1, rise * 4) * leaving, mirror: true });
        if (carry < 1) sprite("urn", URN_X - run, urnY, { alpha: leaving, angle: -10 * lifted * Math.PI / 180, pivotX: 32, pivotY: 48 });
    }

    function garry(time) {
        const rock = progress(time, ROCK);
        const angle = keyframes(rock, ROCK_KEYS) * Math.PI / 180;
        const pose = rock > 0 && rock < 1 ? Math.min(3, Math.floor(rock * 4)) : 0;
        shadow(GARRY_X + 49, 46);
        // The chair rolls on its rockers: the point that touches the ground moves with the tilt.
        sprite("garry-chair-" + pose, GARRY_X + angle * 14, GROUND - 76, { angle, pivotX: 47, pivotY: 76 });
    }

    function witch(time) {
        const arrival = progress(time, WITCH_IN);
        if (arrival > 0) {
            const cast = progress(time, CAST);
            const lunge = Math.sin(cast * Math.PI) * 2;
            const size = 0.6 + 0.4 * easeOutBack(arrival);
            shadow(WITCH_X + 46, 26, arrival);
            sprite(time >= CAST[0] ? "witch-attack" : "witch", WITCH_X - lunge, GROUND - 76,
                { alpha: Math.min(1, arrival * 2), scaleX: size, scaleY: size, pivotX: 46, pivotY: 76 });
        }
        const puff = progress(time, PUFF);
        if (puff > 0 && puff < 1) {
            const size = 1 + puff * 0.7;
            sprite(puff < 0.25 ? "puff-0" : "puff-1", WITCH_X + 22, GROUND - 58,
                { alpha: 1 - puff * puff, scaleX: size, scaleY: size, pivotX: 24, pivotY: 24 });
        }
    }

    function bat(time) {
        const flight = progress(time, BAT_FLIGHT);
        if (flight <= 0) return;
        const left = 1 - easeOut(flight);
        const hover = flight >= 1 ? Math.sin((time - BAT_FLIGHT[1]) / 170) * 1.5 : 0;
        const x = BAT_X + left * 48;
        const y = BAT_Y - left * 40 + Math.sin(flight * Math.PI) * 5 + hover;
        sprite("bat-" + BAT_FRAMES[Math.floor(time / 85) % BAT_FRAMES.length], x, y, { alpha: Math.min(1, flight * 2.5) });
    }

    function draw(time) {
        ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
        ctx.clearRect(0, 0, WIDTH, HEIGHT);
        ctx.imageSmoothingEnabled = false;
        sky(time);
        theft(time);
        garry(time);
        witch(time);
        bat(time);
    }

    function stop() {
        cancelAnimationFrame(frame);
        return ++version;
    }

    return {
        prepare: () => ready,
        async play() {
            const run = stop();
            await ready;
            if (run !== version) return;
            const start = performance.now();
            function tick(now) {
                const time = Math.max(0, Math.min((now - start) * SPEED, DURATION));
                draw(time);
                if (time < DURATION) frame = requestAnimationFrame(tick);
            }
            tick(start);
        },
        async finish() {
            const run = stop();
            await ready;
            if (run === version) draw(DURATION);
        }
    };
}
