/*
 * Project wheel: a wheel lying flat, seen in perspective, with one card stuck to its rim
 * at each notch. The cards keep facing us: the front one is at the centre, its two neighbours
 * shrink, rise and darken, without ever changing shape; the next ones fade out.
 * Only the centre card shows its story (css/pages/portfolio.css). "Play" and "Try it" widen
 * the centre card and push the others aside.
 * Each time a card arrives at the centre, the showcase sends the "showcase:active" event
 * (detail: { card, neighbours }): card-scenes.js plays the animated scene of that card.
 * Without this module, the cards stay in a scrolling strip and keep all their text.
 */
import { initProjectFilter } from "./project-filter.js";

/*
 * Under 6 px, a press stays a click and does not turn the wheel.
 */
const DRAG_THRESHOLD = 6;
/*
 * Only these games can be loaded into a card.
 */
const GAMES = ["pendu", "snake"];
/*
 * Shape of the wheel, in card widths: left-to-right radius (radius), front-to-back radius (depth)
 * and distance of the eye (perspective). The wheel is wider than it is deep: the side cards move apart
 * instead of hiding behind each other.
 * lift: how high the back card rises, in card heights (the wheel is seen from above).
 * On phones, the wheel is tighter: only the centre card is whole, the edges of its neighbours peek out.
 */
const RINGS = {
    wide: { radius: 1.5, depth: 1, perspective: 3, lift: 0.2 },
    narrow: { radius: 1.1, depth: 1.1, perspective: 2.6, lift: 0.12 }
};
/*
 * Shade of the cards from one notch away from the centre (0 to 1): their red ground turns dark, with no large bright block.
 * The shade lies under the content (css/pages/portfolio.css): title, tags and, on desktop, story stay readable.
 */
const SHADE = 0.6;
/*
 * A sober wheel: only the centre card and its two neighbours are seen.
 * A card fades out between 1.5 and 2 notches from the centre: the back cards, cut by the centre one, disappear.
 * Their text leaves before them, as soon as another card passes in front (render): the fading card stays dark and empty.
 */
const HIDE_FROM = 1.5;
const HIDE_TO = 2;
/*
 * Visible edge of a neighbour that cannot show all its text, in pixels (ringRadius):
 * as on phones, it goes behind the centre card and only its edge peeks out, instead of a large dark block.
 */
const SIDE_BAND = 48;
/*
 * Wait before the content comes back, as a share of --dur-base (transition in css/pages/portfolio.css).
 * A side card waits until it has almost arrived (60 % of the move, already 97 % of the way): earlier, the front card
 * would still hide some of its lines. The card coming to the centre passes in front of the others: it only waits
 * until it has entered the wheel (25 % of the move, already three quarters of the way) and stays dark and empty for less time.
 */
const RISE_WAIT = { center: 0.25, side: 0.6 };
/*
 * Maximum width of a widened card, in pixels.
 */
const EXPANDED_MAX = 1040;
/*
 * Space kept under the centre card when the page scrolls to the wheel (wheelTop), in pixels.
 */
const FIT_GAP = 8;
/*
 * Momentum on release: the wheel goes on for this time (ms) at the speed of the gesture, then stops on the nearest card.
 */
const MOMENTUM_MS = 250;
/*
 * Horizontal scrolling (trackpad, Shift + wheel): distance, in pixels, that turns the wheel by one notch.
 */
const WHEEL_STEP = 60;
/*
 * Arrows drawn in SVG: the site font does not have these characters.
 */
const ARROW_PATHS = { previous: "M19 12H5M11 6l-6 6 6 6", next: "M5 12h14M13 6l6 6-6 6" };
/*
 * Announcement of the centre card to screen readers, when the visitor turns the wheel.
 */
const ANNOUNCES = {
    fr: (title, position, count) => `${title}, projet ${position} sur ${count}`,
    en: (title, position, count) => `${title}, project ${position} of ${count}`
};


export function initProjectShowcase(language) {
    const showcase = document.querySelector(".showcase");
    const track = showcase?.querySelector(".showcase__track");
    if (!showcase || !track) return;
    const cards = [...track.querySelectorAll(".project-card")];
    if (!cards.length) return;

    /*
     * The arrows are for the mouse on large screens. With a finger, one swipes: the hint says so.
     * The games are played with the keyboard: neither on small screens nor on touch screens (landscape tablets included).
     */
    const arrowMode = window.matchMedia("(min-width: 1025px) and (hover: hover) and (pointer: fine)");
    const noGames = window.matchMedia("(max-width: 1024px), (hover: none) and (pointer: coarse)");
    const narrow = window.matchMedia("(max-width: 767px)");
    /*
     * visible: cards kept by the filter, in wheel order.
     * dragShift: rotation during a drag, in cards.
     */
    let visible = cards;
    let active = null;
    let expanded = null;
    let dragShift = 0;
    let drag = null;
    let suppressClick = false;
    let frameRequest = null;


    /* -------------------- ARROWS AND HINT -------------------- */

    const hint = document.createElement("p");
    hint.className = "showcase__hint";
    showcase.prepend(hint);

    function updateMode() {
        const touch = !arrowMode.matches;
        showcase.classList.toggle("showcase--touch", touch);
        hint.textContent = (touch ? showcase.dataset.labelHintTouch : showcase.dataset.labelHint) || "";
        updateWidth();
        render();
    }

    /*
     * Frame around the wheel: the arrows, placed on either side, are positioned from it.
     */
    const frame = document.createElement("div");
    frame.className = "showcase__frame";
    track.before(frame);
    const previousButton = createArrow(showcase.dataset.labelPrev, "previous");
    const nextButton = createArrow(showcase.dataset.labelNext, "next");
    frame.append(previousButton, track, nextButton);

    function createArrow(label, side) {
        const button = document.createElement("button");
        button.className = "showcase__arrow showcase__arrow--" + side;
        button.type = "button";
        button.innerHTML = `<svg class="showcase__arrow-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${ARROW_PATHS[side]}"/></svg>`;
        button.setAttribute("aria-label", label || "");
        return button;
    }

    /*
     * The wheel is circular: after the last card comes the first one.
     * Only the visitor turns the wheel: the new card is announced and its address recorded.
     */
    function turn(steps) {
        if (visible.length < 2) return;
        const index = visible.indexOf(active);
        setActive(visible[(index + steps + visible.length * 4) % visible.length], true);
    }

    previousButton.addEventListener("click", () => turn(-1));
    nextButton.addEventListener("click", () => turn(1));

    /*
     * First displayed element of the card that can take the focus; offsetParent is null for a hidden element
     * ("Play" button on tablets, for example).
     */
    function focusInCard(card, preferred) {
        const target = [preferred, ...card.querySelectorAll("a[href], button:not(:disabled)")]
            .find(element => element && element.offsetParent !== null);
        target?.focus({ preventScroll: true });
    }

    /*
     * Keyboard arrows in the wheel; fields, buttons and the game of a widened card keep their own behaviour.
     */
    track.addEventListener("keydown", event => {
        if (event.target.closest("input, textarea, select, .project-card__stage")) return;
        if (event.key === "ArrowLeft") turn(-1);
        else if (event.key === "ArrowRight") turn(1);
        else return;
        event.preventDefault();
        focusInCard(active);
    });


    /* -------------------- CENTRE CARD -------------------- */

    /*
     * Area read by screen readers, invisible on screen (base.css).
     */
    const announcer = document.createElement("p");
    announcer.className = "visually-hidden";
    announcer.setAttribute("aria-live", "polite");
    showcase.append(announcer);

    /*
     * Cards right before and after the centre card, among the cards kept by the filter (without the centre card itself).
     */
    function neighboursOf(card) {
        const index = visible.indexOf(card);
        if (index < 0 || visible.length < 2) return [];
        const around = [visible[(index - 1 + visible.length) % visible.length], visible[(index + 1) % visible.length]];
        return [...new Set(around)].filter(item => item !== card);
    }

    /*
     * Tells the card scenes (card-scenes.js) which card is at the centre and which ones are its neighbours.
     * Also sent when only the neighbours change (filter): the same card is then not played again.
     */
    function notifyCentre() {
        if (!active) return;
        showcase.dispatchEvent(new CustomEvent("showcase:active", { detail: { card: active, neighbours: neighboursOf(active) } }));
    }

    /*
     * The centre card comes to the front and shows its story (css/pages/portfolio.css).
     * Chosen by the visitor (byUser), it is announced and the page address points to it: #projects/snake.
     * replaceState changes the address without adding a step to the history.
     */
    function setActive(card, byUser = false) {
        if (card === active) return;
        if (expanded && expanded !== card) collapse(expanded, false);
        active?.classList.remove("project-card--active");
        active = card;
        card.classList.add("project-card--active");
        render();
        notifyCentre();
        if (!byUser) return;
        const title = card.querySelector(".project-card__title")?.textContent || "";
        announcer.textContent = (ANNOUNCES[language] || ANNOUNCES.fr)(title, visible.indexOf(card) + 1, visible.length);
        if (card.dataset.slug) history.replaceState(null, "", "#projects/" + card.dataset.slug);
    }

    /*
     * Signed gap between a card and the centre, brought back between -n/2 and n/2: the shortest way round the wheel.
     */
    function wrap(offset, count) {
        const value = ((offset % count) + count) % count;
        return value > count / 2 ? value - count : value;
    }

    /*
     * Place of a card on the wheel from its gap to the centre (in notches, decimals included).
     * angle 0 = front; depth = move towards the back, hence its size seen from afar (scale).
     * x in card widths, y in card heights; back is 0 at the front and 1 at the back.
     */
    function ringPlace(offset, count, ring, radius) {
        const angle = 2 * Math.PI * offset / count;
        const back = (1 - Math.cos(angle)) / 2;
        const scale = ring.perspective / (ring.perspective + ring.depth * 2 * back);
        return {
            x: radius * Math.sin(angle) * scale,
            y: -ring.lift * back,
            scale
        };
    }

    /*
     * Number of notches of the wheel for a number of cards. A wheel always has at least three notches:
     * with two cards and two notches, the second card would sit right behind the centre one, entirely hidden,
     * and nothing would tell that the filter kept more than one card. With three notches it stays on the right side,
     * like the neighbour of a three-card wheel, and the notch on the left stays empty.
     */
    function notches(count) {
        return Math.max(count, 3);
    }

    /*
     * Radius reduced when space is short, so that the side cards stay inside the frame.
     */
    function ringRoom(ring, width) {
        const room = (track.clientWidth / 2 / width - 0.45) / 0.75;
        return Math.min(ring.radius, Math.max(0.8, room));
    }

    function ringRadius(ring, width, count) {
        const radius = ringRoom(ring, width);
        /*
         * Neighbour one notch from the centre, for a radius of 1 (x in card widths).
         * If it cannot show all its text (partly hidden by the centre card or cut by the edge,
         * same computation as render), the wheel tightens: only its edge peeks out from the centre card (SIDE_BAND).
         */
        const unit = ringPlace(1, notches(count), ring, 1);
        if (unit.x < 0.01) return radius;
        const x = unit.x * radius * width;
        const covered = (width + width * unit.scale) / 2 - x;
        const overflow = x + width * unit.scale / 2 - track.clientWidth / 2;
        if (Math.max(covered, overflow) <= 0) return radius;
        return Math.min(radius, (SIDE_BAND / width + (1 - unit.scale) / 2) / unit.x);
    }

    /*
     * Room left above the wheel for the back card, which rises above the centre card.
     */
    let roomAbove = -1;
    function updateRoomAbove(ring, height) {
        const back = ringPlace(0.5, 1, ring, 0);
        const room = Math.max(0, Math.round((ring.lift + back.scale / 2 - 0.5) * height)) + 10;
        if (room === roomAbove) return;
        roomAbove = room;
        track.style.paddingTop = room + "px";
    }

    /*
     * Width of a normal card, in pixels; offsetWidth ignores transforms.
     */
    function cardWidth() {
        return visible.find(card => card !== expanded)?.offsetWidth || active.offsetWidth;
    }

    /*
     * Distance from the top of the showcase (filters) to the top of the cards, in pixels.
     */
    function cardRowOffset() {
        return track.getBoundingClientRect().top - showcase.getBoundingClientRect().top + parseFloat(getComputedStyle(track).paddingTop);
    }

    /*
     * On desktop, if the centre card does not fit under the header (small screen, zoom),
     * the cards widen (showcase--wide, css/pages/portfolio.css): their text takes fewer lines and they are shorter.
     * The height is measured at the normal width and without transition: otherwise the widened card,
     * now short enough, would lose the class at the next measurement.
     * All the cards share the grid row, as tall as the tallest one: active.offsetHeight is the height of every card.
     */
    function updateWidth() {
        if (!active || expanded) return;
        const instant = showcase.classList.contains("showcase--instant");
        showcase.classList.add("showcase--instant");
        showcase.classList.remove("showcase--wide");
        const tooHigh = active.offsetHeight > window.innerHeight - headerRoom();
        showcase.classList.toggle("showcase--wide", arrowMode.matches && tooHigh);
        active.offsetWidth;
        if (!instant) showcase.classList.remove("showcase--instant");
    }

    /*
     * Margin between the edge of a card and its text, in pixels, before scaling (padding of project-card__body).
     */
    function textInset() {
        const body = active.querySelector(".project-card__body");
        return (body && parseFloat(getComputedStyle(body).paddingLeft)) || 16;
    }

    /*
     * Computes the place of each card. The cards are stacked at the centre (see css/pages/portfolio.css):
     * translate moves them apart, scale shrinks them, z-index puts the nearest ones in front.
     * They all keep their whole height: the wheel moves and shrinks them, without ever cutting or unfolding them.
     */
    function render() {
        if (!active || !showcase.classList.contains("showcase--ready")) return;
        const ring = narrow.matches ? RINGS.narrow : RINGS.wide;
        const count = visible.length;
        const width = cardWidth();
        const height = active.offsetHeight;
        const radius = ringRadius(ring, width, count);
        /*
         * Tight wheel (neighbours reduced to their edge): the card coming to the centre passes in front from the start
         * and never touches the edge, no word can be cut. Its text comes back without waiting (RISE_WAIT not needed).
         */
        const tight = radius < ringRoom(ring, width);
        const half = track.clientWidth / 2;
        const inset = textInset();
        updateRoomAbove(ring, height);
        /*
         * Widened card: its neighbours move apart as much as the card is going to grow, to stay on the edges.
         * The target width is read from --expanded-width: the transition of the card is not over yet.
         */
        const target = parseFloat(showcase.style.getPropertyValue("--expanded-width")) || width;
        const extra = expanded ? (target - width) / 2 + 16 : 0;
        const center = visible.indexOf(active);
        /*
         * Abscissa of a place on the wheel, in pixels, gap left for the widened card included.
         */
        const placeX = (offset, place) => place.x * width + Math.sign(offset) * extra * Math.min(Math.abs(offset), 1);

        visible.forEach((card, index) => {
            const offset = wrap(index - center + dragShift, count);
            const distance = Math.abs(offset);
            const place = ringPlace(offset, notches(count), ring, radius);
            const x = placeX(offset, place);
            /*
             * A card that goes from one side to the other through the back of the wheel jumps without animation:
             * its two places merge at the back, and it does not cross the front of the wheel.
             */
            const jump = card.wheelOffset !== undefined && Math.abs(offset - card.wheelOffset) > count / 2;
            card.wheelOffset = offset;
            if (jump) {
                card.style.transition = "none";
                /*
                 * It arrives without text, at once (--content-rise at 0): with three cards, it jumps to its side place
                 * while the card going to the centre still passes in front of it. Its text then comes back
                 * like that of a card coming back from the back (RISE_WAIT).
                 */
                card.style.setProperty("--content-rise", "0");
                card.style.setProperty("--content", "0");
                card.style.setProperty("--shade", String(SHADE));
                card.wheelContent = 0;
                card.offsetWidth;
            }
            card.style.transform = `translate(${x}px, ${place.y * height}px) scale(${place.scale})`;
            card.style.zIndex = String(100 - Math.round(distance * 10));
            /*
             * No cut word at the edge of the wheel (overflow-x: clip, css/pages/portfolio.css): the content (--content, 0 to 1)
             * is only seen if the card fits between the edges. It fades while the edge of the card crosses the margin
             * of its text (inset): at the edge of the wheel, it is already invisible.
             * Computed on the arrival place: during the move, the edge of the card stays between its two places.
             * Content that fades leaves at once; content that comes back waits until the card has moved far enough
             * (--content-rise at 1 and --content-wait, constant RISE_WAIT; transition in css/pages/portfolio.css).
             * A widened card keeps its content.
             */
            const overflow = Math.abs(x) + width * place.scale / 2 - half;
            /*
             * Back card hidden: beyond half a notch, the card one notch closer to the centre, on its side, passes in front.
             * covered: width of the card hidden by the front one, in pixels (negative if a gap remains between them).
             * The content fades the same way, while the edge of the front card crosses the margin of the text:
             * no word can be read behind another card, neither on the card leaving to the back nor on the one coming back.
             */
            let covered = -Infinity;
            if (distance > 0.5) {
                const frontOffset = offset - Math.sign(offset);
                const front = ringPlace(frontOffset, notches(count), ring, radius);
                const frontWidth = expanded && frontOffset === 0 ? target : width;
                covered = Math.sign(offset) * (placeX(frontOffset, front) - x) + (frontWidth * front.scale + width * place.scale) / 2;
            }
            const content = card === expanded ? 1 : Math.min(1, Math.max(0, 1 - Math.max(overflow, covered) / (inset * place.scale)));
            /*
             * Darkened by a shade (::after in css/pages/portfolio.css) rather than by opacity:
             * transparent cards would show the ones behind them, and flatten their cube.
             * near is 0 at the centre and 1 from one notch away; the shade follows near, even during a drag.
             * A card without text (content at 0) always has the whole shade: never an empty red block.
             * The shade also follows the pace of the content (--content-rise); --content-rise goes back to 0 at the next notch
             * if the content does not change (shade at the normal pace).
             */
            const near = card === expanded ? 0 : Math.min(distance, 1);
            const shade = Math.max(SHADE * near, SHADE * (1 - content), expanded && card !== expanded ? 0.35 : 0).toFixed(3);
            card.style.setProperty("--shade", shade);
            if (card.wheelContent !== undefined && content !== card.wheelContent) {
                const rise = content > card.wheelContent;
                card.style.setProperty("--content-rise", rise ? "1" : "0");
                if (rise) card.style.setProperty("--content-wait", String(distance < 0.5 ? (tight ? 0 : RISE_WAIT.center) : RISE_WAIT.side));
            } else if (card.wheelShade !== undefined && shade !== card.wheelShade) {
                card.style.setProperty("--content-rise", "0");
            }
            card.wheelShade = shade;
            card.wheelContent = content;
            card.style.setProperty("--content", content.toFixed(3));
            /*
             * Sobriety (constants HIDE_FROM and HIDE_TO): the back card fades out. A faded card no longer receives clicks.
             */
            const fade = Math.min(1, Math.max(0, (HIDE_TO - distance) / (HIDE_TO - HIDE_FROM)));
            card.style.opacity = fade.toFixed(3);
            card.style.pointerEvents = fade ? "" : "none";
            if (jump) {
                card.offsetWidth;
                card.style.transition = "";
            }
        });
        /*
         * A single card: nothing to turn, the arrows are removed (hidden, css/pages/portfolio.css).
         */
        previousButton.hidden = nextButton.hidden = count < 2;
    }

    function requestRender() {
        if (frameRequest) return;
        frameRequest = requestAnimationFrame(() => {
            frameRequest = null;
            render();
        });
    }

    /*
     * A side card is brought to the centre by the first click, without opening its links.
     * With the keyboard (visible focus), reaching a side card also brings it to the centre;
     * the focus given by a click waits for the click itself.
     */
    cards.forEach(card => {
        card.addEventListener("click", event => {
            if (card === active) return;
            event.preventDefault();
            event.stopPropagation();
            setActive(card, true);
        }, true);
        card.addEventListener("focusin", event => {
            if (event.target.matches(":focus-visible")) setActive(card, true);
        });
    });


    window.addEventListener("resize", () => {
        updateWidth();
        requestRender();
    });


    /* -------------------- DRAG AND SWIPE -------------------- */

    /*
     * With the mouse as with a finger, the cards follow the gesture; on release, the wheel stops on the nearest one.
     * pan-y (css/pages/portfolio.css) lets the finger scroll the page vertically.
     * Fields, cubes, the cat and the games keep their own behaviour.
     */
    track.addEventListener("pointerdown", event => {
        if (expanded || event.button !== 0 || visible.length < 2) return;
        if (event.target.closest(".cube, .cat-figure, input, textarea, select, output, .project-card__stage")) return;
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, lastX: event.clientX, time: event.timeStamp, velocity: 0, step: 40 };
    });

    track.addEventListener("pointermove", event => {
        if (!drag || event.pointerId !== drag.id) return;
        /*
         * Button released outside the window: the pointerup never came, the gesture stops here.
         */
        if (!(event.buttons & 1)) {
            endDrag(event);
            return;
        }
        const distance = event.clientX - drag.x;
        if (!drag.moved) {
            if (Math.abs(distance) < DRAG_THRESHOLD) return;
            /*
             * Mostly vertical gesture: it scrolls the page, it is not a drag.
             */
            if (Math.abs(event.clientY - drag.y) > Math.abs(distance)) {
                drag = null;
                return;
            }
            drag.moved = true;
            track.setPointerCapture(event.pointerId);
            showcase.classList.add("showcase--dragging");
        }
        /*
         * One notch of the wheel matches the gap between the centre card and its neighbour.
         */
        const ring = narrow.matches ? RINGS.narrow : RINGS.wide;
        const width = cardWidth();
        const count = visible.length;
        drag.step = Math.max(ringPlace(1, notches(count), ring, ringRadius(ring, width, count)).x * width, 40);
        dragShift = distance / drag.step;
        /*
         * Speed of the gesture in px/ms, smoothed over the last moves: it gives the momentum on release.
         */
        const elapsed = event.timeStamp - drag.time;
        if (elapsed > 0) drag.velocity = 0.8 * (event.clientX - drag.lastX) / elapsed + 0.2 * drag.velocity;
        drag.lastX = event.clientX;
        drag.time = event.timeStamp;
        /*
         * A single layout per frame, even if the pointer sends more moves.
         */
        requestRender();
    });

    /*
     * On release, the momentum extends the gesture; a finger that stopped before lifting (80 ms) gives none.
     * A quick gesture of at least 40 px is enough to go to the next card; a throw makes half a turn at most.
     * The click that follows a drag is ignored: it does not open a link by mistake.
     * Listened to on the window: a button released outside the wheel also ends the gesture.
     */
    function endDrag(event) {
        if (!drag || event.pointerId !== drag.id) return;
        if (drag.moved) {
            suppressClick = true;
            setTimeout(() => { suppressClick = false; }, 0);
            showcase.classList.remove("showcase--dragging");
            const coast = event.type === "pointerup" && event.timeStamp - drag.time < 80 ? drag.velocity * MOMENTUM_MS / drag.step : 0;
            const limit = Math.floor(visible.length / 2);
            let steps = Math.max(-limit, Math.min(limit, -Math.round(dragShift + coast)));
            if (!steps && Math.abs(dragShift) * active.offsetWidth > 40) steps = dragShift < 0 ? 1 : -1;
            dragShift = 0;
            drag = null;
            if (steps) turn(steps);
            else render();
            return;
        }
        drag = null;
    }

    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);

    /*
     * Horizontal scrolling with the trackpad (or Shift + wheel): one notch per gesture.
     * After a notch, the wheel waits for the end of the gesture (200 ms without scrolling): the trackpad inertia does not make it race.
     * Vertical scrolling stays with the page; preventDefault avoids the browser's back navigation.
     */
    let wheelSum = 0;
    let wheelDone = false;
    let wheelTimer = null;
    track.addEventListener("wheel", event => {
        if (expanded || visible.length < 2 || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
        event.preventDefault();
        clearTimeout(wheelTimer);
        wheelTimer = setTimeout(() => {
            wheelSum = 0;
            wheelDone = false;
        }, 200);
        if (wheelDone) return;
        wheelSum += event.deltaX * (event.deltaMode === 1 ? 16 : 1);
        if (Math.abs(wheelSum) < WHEEL_STEP) return;
        wheelDone = true;
        turn(Math.sign(wheelSum));
    }, { passive: false });
    track.addEventListener("click", event => {
        if (!suppressClick) return;
        event.preventDefault();
        event.stopPropagation();
    }, true);
    /*
     * Prevents the native drag and drop of images and links, which would interrupt the gesture.
     */
    track.addEventListener("dragstart", event => event.preventDefault());


    /* -------------------- WIDENED CARD: GAME OR DEMO -------------------- */

    /*
     * Loads the game into the card. import.meta.url is the address of this file:
     * the path to pages/games/ stays right whatever the page (js/modules/ → ../../pages/games/).
     */
    function loadGame(stage) {
        const game = stage.dataset.game;
        if (!GAMES.includes(game)) return;
        const gameFrame = document.createElement("iframe");
        gameFrame.className = "project-card__frame";
        gameFrame.title = stage.dataset.gameTitle || game;
        gameFrame.src = new URL("../../pages/games/" + game + ".html?lang=" + language, import.meta.url).href;
        /*
         * The keyboard must go to the game as soon as it is loaded. ?. accepts an inaccessible document.
         */
        gameFrame.addEventListener("load", () => {
            gameFrame.focus({ preventScroll: true });
            gameFrame.contentDocument?.querySelector("canvas")?.focus({ preventScroll: true });
        }, { once: true });
        stage.replaceChildren(gameFrame);
    }

    /*
     * Visible label of a "Play" or "Try it" button: only its .project-card__toggle-label changes,
     * the visually hidden project name that follows it stays (accessible name "Try it – Language detector").
     */
    function setToggleLabel(button, label) {
        (button.querySelector(".project-card__toggle-label") || button).textContent = label;
    }

    /*
     * The card widens at the centre of the wheel; its neighbours slide towards the edges.
     */
    function expand(card, button, stage) {
        setActive(card);
        expanded = card;
        button.setAttribute("aria-expanded", "true");
        setToggleLabel(button, button.dataset.labelClose);
        stage.hidden = false;
        card.classList.add("project-card--expanded");
        if (stage.dataset.game) loadGame(stage);
        else stage.querySelector("textarea")?.focus({ preventScroll: true });
        render();
    }

    /*
     * Closes the card; changing documents unloads the game and stops its animation loop.
     * If the focus was in the game or the demo, it comes back into the card instead of being lost with it.
     */
    function collapse(card, restoreFocus = true) {
        const button = card.querySelector(".project-card__toggle[aria-expanded='true']");
        const stage = button && document.getElementById(button.getAttribute("aria-controls"));
        if (stage?.contains(document.activeElement)) restoreFocus = true;
        if (button) {
            button.setAttribute("aria-expanded", "false");
            setToggleLabel(button, button.dataset.labelOpen);
        }
        if (stage) {
            if (stage.dataset.game) stage.replaceChildren();
            stage.hidden = true;
        }
        card.classList.remove("project-card--expanded");
        if (expanded === card) expanded = null;
        if (restoreFocus) focusInCard(card, button);
        requestRender();
    }

    document.querySelectorAll(".project-card__toggle").forEach(button => {
        const card = button.closest(".project-card");
        const stage = document.getElementById(button.getAttribute("aria-controls"));
        if (!card || !stage) return;
        button.addEventListener("click", () => {
            if (button.getAttribute("aria-expanded") === "true") collapse(card);
            else expand(card, button, stage);
        });
    });

    /*
     * Escape closes the game or the demo when the focus is on the page.
     * Inside the iframe, Escape keeps its role: back to the game menu.
     */
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && expanded) collapse(expanded);
    });

    /*
     * Window reduced under 1024 px or switch to touch: an open game closes.
     */
    noGames.addEventListener("change", () => {
        if (noGames.matches && expanded?.querySelector(".project-card__stage--game:not([hidden])")) collapse(expanded, false);
    });
    arrowMode.addEventListener("change", updateMode);
    narrow.addEventListener("change", render);


    /* -------------------- START -------------------- */

    /*
     * --expanded-width gives its width to a widened card.
     */
    const resizeObserver = new ResizeObserver(() => {
        if (!active) return;
        const width = Math.min(EXPANDED_MAX, track.clientWidth - (narrow.matches ? 0 : cardWidth() / 2));
        showcase.style.setProperty("--expanded-width", width + "px");
        requestRender();
    });
    resizeObserver.observe(track);

    /*
     * The filter removes cards: the centre card stays if it is kept, otherwise the first one takes its place.
     * The address no longer points to the removed card (at start, active is still empty: the address is kept).
     * The card scenes learn the new neighbours (notifyCentre); the centre card, if unchanged, is not played again.
     */
    function showCards(cardsLeft) {
        if (!cardsLeft.length) return;
        visible = cardsLeft;
        if (expanded && !visible.includes(expanded)) collapse(expanded, false);
        cards.forEach(card => { card.wheelOffset = undefined; });
        if (!visible.includes(active)) {
            if (active && location.hash.startsWith("#projects/")) history.replaceState(null, "", "#projects");
            setActive(visible[0]);
        }
        updateWidth();
        render();
        notifyCentre();
    }

    /*
     * Scroll height that puts the wheel under the header: scroll-padding-top (base.css),
     * or the height of the header on phones, where it is taller.
     * offsetTop ignores the reveal slide (reveal.js): the target is the final place of the wheel.
     * If the centre card is too tall to fit under the header with the filters (narrow or low window),
     * the page scrolls further so that its buttons stay on screen,
     * but never so far that the top of the card goes under the header.
     */
    function wheelTop() {
        let top = 0;
        for (let element = showcase; element; element = element.offsetParent) top += element.offsetTop;
        const showcaseTop = top - headerRoom();
        if (!active) return showcaseTop;
        const cardTop = top + cardRowOffset();
        const below = cardTop + active.offsetHeight + FIT_GAP - (showcaseTop + window.innerHeight);
        if (below <= 0) return showcaseTop;
        return Math.min(showcaseTop + below, cardTop - headerRoom());
    }

    function headerRoom() {
        return Math.max(
            parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop),
            document.querySelector(".header").offsetHeight
        );
    }

    /*
     * From the top of the page, the header shrinks during the trip and makes the page move up:
     * once the scroll and that shrinking are over, the position is corrected if needed.
     * The scroll follows scroll-behavior (base.css), hence the "reduced motion" setting.
     * The visitor keeps control: wheel, finger, keyboard or click during the trip cancel the correction.
     * AbortController removes all the listeners of a trip at once; a new trip cancels the previous one.
     * Without scrollend (old Safari), the correction waits 900 ms; after 3 s, it is given up.
     */
    let placing = null;
    function placeWheel() {
        placing?.abort();
        if (Math.abs(window.scrollY - wheelTop()) <= 1) return;
        const controller = new AbortController();
        placing = controller;
        const { signal } = controller;
        ["wheel", "touchstart", "keydown", "pointerdown"].forEach(type => {
            window.addEventListener(type, () => controller.abort(), { once: true, passive: true, signal });
        });
        async function settle() {
            /* The reading bar (scroll.css) follows the scroll: its finished promise only comes at the bottom of the page */
            const animations = document.querySelector(".header").getAnimations({ subtree: true }).filter(animation => animation.timeline === document.timeline);
            await Promise.all(animations.map(animation => animation.finished));
            if (signal.aborted) return;
            controller.abort();
            if (Math.abs(window.scrollY - wheelTop()) > 1) window.scrollTo({ top: wheelTop() });
        }
        if ("onscrollend" in window) window.addEventListener("scrollend", settle, { once: true, signal });
        else setTimeout(settle, 900);
        setTimeout(() => controller.abort(), 3000);
        window.scrollTo({ top: wheelTop() });
    }

    /*
     * Address of a card (#projects/snake): the card goes to the centre and the wheel comes under the header.
     * A card removed by the filter brings the filter back to "All".
     */
    function showCardFromAddress() {
        if (!location.hash.startsWith("#projects/")) return;
        const slug = decodeURIComponent(location.hash.slice("#projects/".length));
        const card = cards.find(item => item.dataset.slug === slug);
        if (!card) return;
        if (!visible.includes(card)) showcase.querySelector('.showcase__filter[data-value=""]')?.click();
        setActive(card);
        placeWheel();
    }

    /*
     * First layout without animation: the cards do not all start from the centre.
     */
    showcase.classList.add("showcase--ready", "showcase--instant");
    initProjectFilter(showcase, cards, language, showCards);
    /*
     * The hint joins the line of the filters: one line less above the wheel.
     */
    showcase.querySelector(".showcase__filters").append(hint);

    /*
     * The "Projects" links (menu, home page, footer) and the filters bring the wheel right under the header,
     * not the section title: the cards fit on screen.
     * Ctrl, Cmd, Shift or the middle click keep their role (new tab, new window).
     * The focus goes to the section, as with an anchor: the Tab key goes on in the projects.
     */
    const section = document.getElementById("projects");
    if (section && !section.hasAttribute("tabindex")) section.setAttribute("tabindex", "-1");
    document.querySelectorAll('a[href="#projects"]').forEach(link => link.addEventListener("click", event => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        if (location.hash !== "#projects") history.pushState(null, "", "#projects");
        section?.focus({ preventScroll: true });
        placeWheel();
    }));
    showcase.querySelector(".showcase__filters").addEventListener("click", event => {
        if (event.target.closest(".showcase__filter")) placeWheel();
    });
    updateMode();
    showCardFromAddress();
    window.addEventListener("hashchange", showCardFromAddress);
    /*
     * The fonts can change the height of the text once loaded: the width of the cards is checked again.
     */
    document.fonts?.ready.then(() => {
        updateWidth();
        render();
    });
    requestAnimationFrame(() => requestAnimationFrame(() => showcase.classList.remove("showcase--instant")));
}
