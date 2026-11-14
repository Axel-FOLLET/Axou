/*
 * Animated scenes of the project cards, played in the media area of each card (.project-card__media).
 * The scene of a card is picked by its data-slug (SCENES). A scene module exports createScene(media, { language })
 * and returns { play(), finish(), prepare?() }:
 * - play(): plays the scene once from the start, then leaves it on its final state;
 * - finish(): shows the final state at once, without movement;
 * - prepare(), optional: loads ahead (the 3D cat loads its model there).
 * This controller listens to the "showcase:active" event of project-showcase.js (detail: { card, neighbours }):
 * - the card that arrives at the centre is played once the wheel is on screen (its media at least VISIBLE_RATIO visible);
 *   a card already at the centre is played when the wheel first enters the screen;
 * - with prefers-reduced-motion: reduce, the card is finished instead of played;
 * - the card that leaves the centre is finished (final state, no movement left in the middle);
 * - the two neighbours of the centre card are prepared (the centre card too, if it was not prepared yet: arrival by an anchor).
 * The scene modules are only imported when the wheel comes near the screen (LOAD_MARGIN).
 * A module that cannot be loaded, a createScene that throws or a scene that throws later puts back the original
 * media of the card (symbol or drawn cat), without any console message: the card is never empty.
 * An entry is only imported if ready is true: a new scene is switched on once its file exists, since importing a
 * missing file would log a 404 in the console.
 */

/*
 * Scene of each card, by data-slug; paths are relative to this file.
 */
const SCENES = {
    "yia-jobs": { path: "./scenes/job-board.js", ready: true },
    "cesar-vigenere": { path: "./scenes/cipher.js", ready: true },
    "snake": { path: "./scenes/snake.js", ready: true },
    "pendu": { path: "./scenes/hangman.js", ready: true },
    "cat-game": { path: "./cat-3d.js", ready: true },
    "parcours-portfolio": { path: "./scenes/portfolio-site.js", ready: true },
    "detecteur-langue": { path: "./scenes/language.js", ready: true }
};

/*
 * Share of the media that must be on screen, under the header, for the wheel to count as visible.
 */
const VISIBLE_RATIO = 0.6;
const HEADER_MARGIN = "-64px 0px 0px 0px";

/*
 * The scenes are imported when the wheel is less than half a screen away.
 */
const LOAD_MARGIN = "50% 0px";

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)");

/*
 * Time for a card to settle at its new place on the wheel, in ms (transform transition of --dur-base, 450 ms, plus a margin).
 * Chromium lays out SVG text for the scale of the card at that moment and does not lay it out again when only the
 * transform of the card changes: a scene built while its card was small at the back of the wheel painted its letters
 * smaller and shifted once at the centre (Hangman word in reduced motion, seen in the captures of task 08).
 * Once the cards have settled, the scene SVGs of the centre card and its neighbours are laid out again (refreshText).
 */
const SETTLE_MS = 520;


export function initCardScenes(language) {
    const showcase = document.querySelector(".showcase");
    const track = showcase?.querySelector(".showcase__track");
    if (!showcase || !track || !("IntersectionObserver" in window)) return;

    /*
     * One slot per card that has a delivered scene. original: the nodes of the media before any scene,
     * put back if the scene fails (the same nodes, so the drawn cat keeps its listeners).
     */
    const slots = new Map();
    track.querySelectorAll(".project-card").forEach(card => {
        const media = card.querySelector(".project-card__media");
        const config = SCENES[card.dataset.slug];
        if (!media || !config?.ready) return;
        slots.set(card, { card, media, config, original: [...media.childNodes], scene: null, loading: null, broken: false, prepared: false, visible: false });
    });
    if (!slots.size) return;

    let centre = null;
    let neighbours = [];
    /* Centre card not played yet since its arrival (wheel off screen or scenes not loaded yet) */
    let pending = null;
    let near = false;
    let settleTimer = 0;


    /* -------------------- LOADING AND SAFETY -------------------- */

    /*
     * Puts the original media back and forgets the scene: the card keeps its symbol.
     * The scenes hide the original nodes with an inline display or visibility: both are removed.
     */
    function fail(slot) {
        slot.broken = true;
        try {
            slot.scene?.dispose?.();
        } catch {
            /* The media is rebuilt below anyway */
        }
        slot.scene = null;
        slot.media.replaceChildren(...slot.original);
        slot.original.forEach(node => {
            if (!(node instanceof Element)) return;
            [node, ...node.querySelectorAll("*")].forEach(element => {
                element.style?.removeProperty("display");
                element.style?.removeProperty("visibility");
            });
        });
    }

    /*
     * Imports the module and builds the scene, once per card; resolves to the scene, or null if anything fails.
     */
    function load(slot) {
        if (!slot.loading) {
            slot.loading = import(slot.config.path)
                .then(module => {
                    const scene = module.createScene(slot.media, { language });
                    if (typeof scene?.play !== "function" || typeof scene.finish !== "function") throw new TypeError("Invalid scene");
                    slot.scene = scene;
                    return scene;
                })
                .catch(() => {
                    fail(slot);
                    return null;
                });
        }
        return slot.loading;
    }

    /*
     * Calls one method of a scene; an error, thrown or returned as a rejected promise, puts the original media back.
     */
    function run(slot, method) {
        const scene = slot?.scene;
        if (!scene || slot.broken || typeof scene[method] !== "function") return;
        try {
            const result = scene[method]();
            if (result && typeof result.then === "function") result.then(null, () => fail(slot));
        } catch {
            fail(slot);
        }
    }

    /*
     * prepare() is called at most once per card.
     */
    function prepare(slot) {
        if (!slot || slot.prepared) return;
        slot.prepared = true;
        load(slot).then(scene => {
            if (scene) run(slot, "prepare");
        });
    }


    /*
     * Lays out again the SVG of the scenes that contain text (see SETTLE_MS): hidden then shown again in the same task,
     * so nothing is painted in between; running animations go on.
     */
    function refreshText(cards) {
        cards.forEach(card => {
            slots.get(card)?.media.querySelectorAll("svg").forEach(svg => {
                if (!svg.querySelector("text")) return;
                const display = svg.style.display;
                svg.style.display = "none";
                svg.getBoundingClientRect();
                svg.style.display = display;
            });
        });
    }


    /* -------------------- PLAYING -------------------- */

    /*
     * Plays (or finishes, in reduced motion) the pending centre card when everything is ready:
     * scenes loaded (near), and, to play, its media visible on screen, or the wheel already on screen when the card
     * arrived (onScreen: a card that slides in from the edge of a phone is not yet visible at that moment).
     * Played at once: a scene that waited would first show its final state, then start again from the beginning.
     * In a quick series of turns, each card that leaves the centre is finished at once (arrive).
     */
    function schedule(onScreen = false) {
        const slot = slots.get(pending);
        if (!slot) {
            pending = null;
            return;
        }
        if (!near) return;
        if (REDUCED_MOTION.matches) {
            pending = null;
            load(slot).then(scene => {
                if (scene) run(slot, "finish");
            });
            return;
        }
        if (!slot.visible && !onScreen) return;
        pending = null;
        load(slot).then(scene => {
            if (scene && centre === slot.card) run(slot, "play");
        });
    }

    /*
     * A card arrives at the centre: the previous one is finished, the new one is played if the wheel is on screen
     * (media of the previous or of the new centre card visible), otherwise it waits; the neighbours are prepared.
     * The same card sent again (filter) only updates the neighbours.
     */
    function arrive(card, cardNeighbours) {
        let onScreen = false;
        if (card !== centre) {
            const previous = slots.get(centre);
            onScreen = Boolean(previous?.visible || slots.get(card)?.visible);
            if (previous?.scene) run(previous, "finish");
            centre = card;
            pending = card;
        }
        neighbours = cardNeighbours || [];
        if (near) [card, ...neighbours].forEach(item => prepare(slots.get(item)));
        schedule(onScreen);
        clearTimeout(settleTimer);
        settleTimer = setTimeout(() => {
            if (near) refreshText([centre, ...neighbours]);
        }, SETTLE_MS);
    }

    showcase.addEventListener("showcase:active", event => arrive(event.detail?.card || null, event.detail?.neighbours));

    /*
     * Reduced motion switched on while a scene plays: its final state is shown at once.
     */
    REDUCED_MOTION.addEventListener("change", () => {
        if (REDUCED_MOTION.matches) run(slots.get(centre), "finish");
    });


    /* -------------------- SCREEN -------------------- */

    /*
     * Visibility of each media; when the media of the pending centre card comes on screen, it is played.
     */
    const screen = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            const slot = slots.get(entry.target.closest(".project-card"));
            if (!slot) return;
            slot.visible = entry.isIntersecting && entry.intersectionRatio >= VISIBLE_RATIO - 0.01;
            if (slot.visible && slot.card === pending) schedule();
        });
    }, { rootMargin: HEADER_MARGIN, threshold: [0, VISIBLE_RATIO] });
    slots.forEach(slot => screen.observe(slot.media));

    /*
     * The wheel comes near the screen: every scene is built (each one shows a readable state at once),
     * the neighbours are prepared and the centre card is played as soon as it is visible.
     */
    const approach = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        approach.disconnect();
        near = true;
        slots.forEach(slot => load(slot));
        prepare(slots.get(centre));
        neighbours.forEach(item => prepare(slots.get(item)));
        schedule();
    }, { rootMargin: LOAD_MARGIN });
    approach.observe(track);
}
