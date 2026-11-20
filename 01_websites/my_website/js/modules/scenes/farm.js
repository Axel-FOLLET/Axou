const WIDTH = 192;
const HEIGHT = 120;
const DURATION = 3200;
const names = ["tree", "pine", "farm", "crop", "urn", "chmunks", "witch", "witch-attack", "bat", "bat-down",
    "garry-0", "garry-1", "garry-2", "garry-attack"];

export function createScene(media) {
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    canvas.className = "farm-scene";
    canvas.setAttribute("aria-hidden", "true");
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
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

    function rect(color, x, y, w, h) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
    }

    function sprite(name, x, ground, size) {
        ctx.drawImage(images.get(name), Math.round(x), Math.round(ground - size), size, size);
    }

    function progress(time, from, to) {
        return Math.max(0, Math.min(1, (time - from) / (to - from)));
    }

    function draw(time) {
        const dusk = progress(time, 720, 1650);
        const approach = progress(time, 1270, 2220);
        const strike = time >= 2220 && time < 2510;
        const recoil = progress(time, 2400, 2570);
        rect("#efc988", 0, 0, WIDTH, HEIGHT);
        const sunY = 8 + Math.round(dusk * 44);
        rect("#ffe9aa", 139, sunY, 10, 14);
        rect("#ffe9aa", 137, sunY + 2, 14, 10);
        for (let x = 0; x < WIDTH; x += 4) {
            const hill = 42 + Math.round(5 * Math.sin(x / 21) + 3 * Math.sin(x / 9));
            rect("#889473", x, hill, 4, HEIGHT - hill);
        }
        rect("#819253", 0, 54, WIDTH, 66);
        rect("#798348", 0, 80, WIDTH, 40);
        for (let i = 0; i < 52; i++) {
            rect(i % 2 ? "#989855" : "#596e44", i * 43 % WIDTH, 57 + i * 17 % 62, 2, 1);
        }
        // The cottage separates Chmunks and the urn from the two planted rows.
        sprite("farm", 32, 85, 60);
        sprite("chmunks", 0, 94, 34);
        sprite("urn", 22, 95, 21);
        for (const ground of [86, 117]) {
            rect("#81513b", 85, ground - 4, 59, 6);
            rect("#a16b46", 86, ground, 57, 1);
            for (let col = 0; col < 5; col++) sprite("crop", 85 + col * 12, ground, 13);
        }
        sprite("tree", 154, 73, 49);
        sprite("pine", 165, 75, 68);

        // Cool the distant landscape at dusk. Keep foreground characters readable.
        ctx.globalAlpha = dusk * 0.57;
        rect("#172347", 0, 0, WIDTH, HEIGHT);
        ctx.globalAlpha = dusk;
        for (const [x, y] of [[18, 12], [66, 8], [112, 20], [151, 9], [182, 23]]) {
            rect("#e0d9ba", x, y, 1, 1);
        }
        ctx.globalAlpha = 1;

        // The lower trail and the gap above the canopy are separate entrances.
        // Reveal each sprite from behind the near trees as it crosses the forest edge.
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, 171, HEIGHT);
        ctx.clip();
        const witchX = 174 - approach * 55 + recoil * 8;
        sprite(time >= 2030 && time < 2360 ? "witch-attack" : "witch", witchX, 103, 49);
        const flight = progress(time, 800, 2020);
        const batX = 174 - 61 * flight;
        const batY = 60 - 26 * flight - 5 * Math.sin(flight * Math.PI);
        sprite(Math.floor(time / 140) % 2 ? "bat-down" : "bat", batX, batY, 31);
        ctx.restore();

        const idle = [0, 1, 2, 1][Math.floor(time / 260) % 4];
        sprite(strike ? "garry-attack" : "garry-" + idle, 81, 106, 55);
        sprite("pine", 153, 91, 62);
        sprite("tree", 165, 114, 48);
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
                const time = Math.max(0, Math.min(now - start, DURATION));
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
