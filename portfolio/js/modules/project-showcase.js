/*
 * Roue des projets : une roue posée à plat, vue en perspective, avec une carte collée sur son bord
 * à chaque cran. Les cartes restent tournées vers nous : celle de devant est au centre, les suivantes
 * rapetissent, montent et s'assombrissent en s'éloignant, jusqu'à celle du fond, derrière la carte du centre.
 * Seule la carte du centre affiche son récit (projects.css). « Jouer » et « Tester » agrandissent
 * la carte du centre et écartent les autres.
 * Sans ce module, les cartes restent dans une bande qui défile et gardent tout leur texte.
 */
import { initProjectFilter } from "./project-filter.js";

/*
 * En dessous de 6 px, un appui reste un clic et ne fait pas tourner la roue.
 */
const DRAG_THRESHOLD = 6;
/*
 * Seuls ces jeux peuvent être chargés dans une carte.
 */
const GAMES = ["pendu", "snake"];
/*
 * Forme de la roue, en largeurs de carte : rayon de gauche à droite (radius), rayon d'avant en arrière (depth)
 * et distance de l'œil (perspective). La roue est plus large que profonde : les cartes de côté s'écartent
 * au lieu de se cacher les unes derrière les autres.
 * lift : hauteur dont monte la carte du fond, en hauteurs de carte (la roue est vue d'au-dessus).
 * shade : assombrissement de la carte du fond.
 * Sur téléphone, la roue est plus serrée : seule la carte du centre est entière, on devine le bord de ses voisines.
 */
const RINGS = {
    wide: { radius: 1.5, depth: 1, perspective: 3, lift: 0.2, shade: 0.55 },
    narrow: { radius: 1.1, depth: 1.1, perspective: 2.6, lift: 0.12, shade: 0.55 }
};
/*
 * Largeur maximale d'une carte agrandie, en pixels.
 */
const EXPANDED_MAX = 1040;
/*
 * Élan au lâcher : la roue continue pendant ce temps (ms) à la vitesse du geste, puis s'arrête sur la carte la plus proche.
 */
const MOMENTUM_MS = 250;
/*
 * Défilement horizontal (trackpad, Maj + molette) : distance, en pixels, qui fait tourner la roue d'un cran.
 */
const WHEEL_STEP = 60;
/*
 * Flèches dessinées en SVG : la police du site n'a pas ces caractères.
 */
const ARROW_PATHS = { previous: "M19 12H5M11 6l-6 6 6 6", next: "M5 12h14M13 6l6 6-6 6" };
/*
 * Annonce de la carte du centre aux lecteurs d'écran, quand le visiteur fait tourner la roue.
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
     * Les flèches servent à la souris sur grand écran. Au doigt, on balaie : la consigne le dit.
     * Les jeux se jouent au clavier : ni sur petit écran, ni sur écran tactile (tablette en paysage comprise).
     */
    const arrowMode = window.matchMedia("(min-width: 1025px) and (hover: hover) and (pointer: fine)");
    const noGames = window.matchMedia("(max-width: 1024px), (hover: none) and (pointer: coarse)");
    const narrow = window.matchMedia("(max-width: 767px)");
    /*
     * visible : cartes retenues par le filtre, dans l'ordre de la roue.
     * dragShift : rotation pendant un glisser, en cartes.
     */
    let visible = cards;
    let active = null;
    let expanded = null;
    let dragShift = 0;
    let drag = null;
    let suppressClick = false;
    let frameRequest = null;


    /* -------------------- FLÈCHES ET CONSIGNE -------------------- */

    const hint = document.createElement("p");
    hint.className = "showcase__hint";
    showcase.prepend(hint);

    function updateMode() {
        const touch = !arrowMode.matches;
        showcase.classList.toggle("showcase--touch", touch);
        hint.textContent = (touch ? showcase.dataset.labelHintTouch : showcase.dataset.labelHint) || "";
        render();
    }

    /*
     * Cadre autour de la roue : il sert de repère aux flèches, placées de part et d'autre.
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
     * La roue est circulaire : après la dernière carte, on retrouve la première.
     * Seul le visiteur fait tourner la roue : la nouvelle carte est annoncée et son adresse notée.
     */
    function turn(steps) {
        if (visible.length < 2) return;
        const index = visible.indexOf(active);
        setActive(visible[(index + steps + visible.length * 4) % visible.length], true);
    }

    previousButton.addEventListener("click", () => turn(-1));
    nextButton.addEventListener("click", () => turn(1));

    /*
     * Premier élément affiché de la carte qui peut recevoir le focus ; offsetParent est nul pour un élément caché
     * (bouton « Jouer » sur tablette, par exemple).
     */
    function focusInCard(card, preferred) {
        const target = [preferred, ...card.querySelectorAll("a[href], button:not(:disabled)")]
            .find(element => element && element.offsetParent !== null);
        target?.focus({ preventScroll: true });
    }

    /*
     * Flèches du clavier dans la roue ; les champs, les boutons et le jeu d'une carte agrandie gardent leur comportement.
     */
    track.addEventListener("keydown", event => {
        if (event.target.closest("input, textarea, select, .project-card__stage")) return;
        if (event.key === "ArrowLeft") turn(-1);
        else if (event.key === "ArrowRight") turn(1);
        else return;
        event.preventDefault();
        focusInCard(active);
    });


    /* -------------------- CARTE DU CENTRE -------------------- */

    /*
     * Zone lue par les lecteurs d'écran, invisible à l'écran (base.css).
     */
    const announcer = document.createElement("p");
    announcer.className = "visually-hidden";
    announcer.setAttribute("aria-live", "polite");
    showcase.append(announcer);

    /*
     * La carte du centre passe devant et affiche son récit (projects.css).
     * Choisie par le visiteur (byUser), elle est annoncée et l'adresse de la page la désigne : #projects/snake.
     * replaceState change l'adresse sans ajouter d'étape à l'historique.
     */
    function setActive(card, byUser = false) {
        if (card === active) return;
        if (expanded && expanded !== card) collapse(expanded, false);
        active?.classList.remove("project-card--active");
        active = card;
        card.classList.add("project-card--active");
        render();
        if (!byUser) return;
        const title = card.querySelector(".project-card__title")?.textContent || "";
        announcer.textContent = (ANNOUNCES[language] || ANNOUNCES.fr)(title, visible.indexOf(card) + 1, visible.length);
        if (card.dataset.slug) history.replaceState(null, "", "#projects/" + card.dataset.slug);
    }

    /*
     * Écart signé entre une carte et le centre, ramené entre -n/2 et n/2 : le chemin le plus court sur la roue.
     */
    function wrap(offset, count) {
        const value = ((offset % count) + count) % count;
        return value > count / 2 ? value - count : value;
    }

    /*
     * Place d'une carte sur la roue selon son écart avec le centre (en crans, décimales comprises).
     * angle 0 = devant ; depth = recul vers le fond, d'où sa taille vue de loin (scale).
     * x en largeurs de carte, y en hauteurs de carte ; back vaut 0 devant et 1 au fond.
     */
    function ringPlace(offset, count, ring, radius) {
        const angle = 2 * Math.PI * offset / count;
        const back = (1 - Math.cos(angle)) / 2;
        const scale = ring.perspective / (ring.perspective + ring.depth * 2 * back);
        return {
            x: radius * Math.sin(angle) * scale,
            y: -ring.lift * back,
            scale,
            shade: ring.shade * back
        };
    }

    /*
     * Rayon réduit quand la place manque, pour que les cartes de côté restent dans le cadre.
     */
    function ringRadius(ring, width) {
        const room = (track.clientWidth / 2 / width - 0.45) / 0.75;
        return Math.min(ring.radius, Math.max(0.8, room));
    }

    /*
     * Place laissée au-dessus de la roue pour la carte du fond, qui dépasse de la carte du centre.
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
     * Largeur d'une carte normale, en pixels ; offsetWidth ignore les transform.
     */
    function cardWidth() {
        return visible.find(card => card !== expanded)?.offsetWidth || active.offsetWidth;
    }

    /*
     * Calcule la place de chaque carte. Les cartes sont superposées au centre (voir projects.css) :
     * translate les écarte, scale les rapetisse, z-index met les plus proches devant.
     */
    function render() {
        if (!active || !showcase.classList.contains("showcase--ready")) return;
        const ring = narrow.matches ? RINGS.narrow : RINGS.wide;
        const count = visible.length;
        const width = cardWidth();
        const height = active.offsetHeight;
        const radius = ringRadius(ring, width);
        updateRoomAbove(ring, height);
        /*
         * Carte agrandie : ses voisines s'écartent d'autant que la carte va grandir, pour rester sur les bords.
         * La largeur visée est lue dans --expanded-width : la transition de la carte n'est pas encore finie.
         */
        const target = parseFloat(showcase.style.getPropertyValue("--expanded-width")) || width;
        const extra = expanded ? (target - width) / 2 + 16 : 0;
        const center = visible.indexOf(active);

        visible.forEach((card, index) => {
            const offset = wrap(index - center + dragShift, count);
            const distance = Math.abs(offset);
            const place = ringPlace(offset, count, ring, radius);
            const x = place.x * width + Math.sign(offset) * extra * Math.min(distance, 1);
            /*
             * Une carte qui passe d'un côté à l'autre par le fond de la roue saute sans animation :
             * ses deux places se confondent au fond, et elle ne traverse pas le devant de la roue.
             */
            const jump = card.wheelOffset !== undefined && Math.abs(offset - card.wheelOffset) > count / 2;
            card.wheelOffset = offset;
            if (jump) card.style.transition = "none";
            card.style.transform = `translate(${x}px, ${place.y * height}px) scale(${place.scale})`;
            /*
             * Assombrissement par un voile (::after dans projects.css) plutôt que par opacity :
             * des cartes transparentes laisseraient voir celles de derrière, et aplatiraient leur cube.
             */
            const shade = expanded && card !== expanded ? Math.max(place.shade, 0.35) : place.shade;
            card.style.setProperty("--shade", shade.toFixed(3));
            card.style.zIndex = String(100 - Math.round(distance * 10));
            if (jump) {
                card.offsetWidth;
                card.style.transition = "";
            }
        });
        previousButton.disabled = nextButton.disabled = count < 2;
    }

    function requestRender() {
        if (frameRequest) return;
        frameRequest = requestAnimationFrame(() => {
            frameRequest = null;
            render();
        });
    }

    /*
     * Une carte de côté s'amène au centre au premier clic, sans ouvrir ses liens.
     * Au clavier (focus visible), atteindre une carte de côté la fait aussi venir au centre ;
     * le focus donné par un clic attend le clic lui-même.
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


    window.addEventListener("resize", requestRender);


    /* -------------------- GLISSER ET BALAYER -------------------- */

    /*
     * À la souris comme au doigt, les cartes suivent le geste ; au lâcher, la roue s'arrête sur la plus proche.
     * pan-y (projects.css) laisse le doigt faire défiler la page verticalement.
     * Les champs, les cubes, le chat et les jeux gardent leur propre comportement.
     */
    track.addEventListener("pointerdown", event => {
        if (expanded || event.button !== 0 || visible.length < 2) return;
        if (event.target.closest(".cube, .cat-figure, input, textarea, select, output, .project-card__stage")) return;
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, lastX: event.clientX, time: event.timeStamp, velocity: 0, step: 40 };
    });

    track.addEventListener("pointermove", event => {
        if (!drag || event.pointerId !== drag.id) return;
        /*
         * Bouton relâché hors de la fenêtre : le pointerup n'est jamais arrivé, le geste s'arrête ici.
         */
        if (!(event.buttons & 1)) {
            endDrag(event);
            return;
        }
        const distance = event.clientX - drag.x;
        if (!drag.moved) {
            if (Math.abs(distance) < DRAG_THRESHOLD) return;
            /*
             * Geste surtout vertical : c'est un défilement de la page, pas un glisser.
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
         * Un cran de la roue correspond à l'écart entre la carte du centre et sa voisine.
         */
        const ring = narrow.matches ? RINGS.narrow : RINGS.wide;
        const width = cardWidth();
        drag.step = Math.max(ringPlace(1, Math.max(visible.length, 2), ring, ringRadius(ring, width)).x * width, 40);
        dragShift = distance / drag.step;
        /*
         * Vitesse du geste en px/ms, lissée sur les derniers mouvements : elle donne l'élan du lâcher.
         */
        const elapsed = event.timeStamp - drag.time;
        if (elapsed > 0) drag.velocity = 0.8 * (event.clientX - drag.lastX) / elapsed + 0.2 * drag.velocity;
        drag.lastX = event.clientX;
        drag.time = event.timeStamp;
        /*
         * Une seule mise en place par image, même si le pointeur envoie plus de mouvements.
         */
        requestRender();
    });

    /*
     * Au lâcher, l'élan prolonge le geste ; un doigt arrêté avant de se lever (80 ms) n'en donne pas.
     * Un geste vif d'au moins 40 px suffit à passer à la carte voisine ; un lancer fait au plus un demi-tour.
     * Le clic qui suit un glisser est ignoré : il n'ouvre pas un lien par erreur.
     * Écouté sur la fenêtre : un bouton relâché hors de la roue termine aussi le geste.
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
     * Défilement horizontal au trackpad (ou Maj + molette) : un cran par geste.
     * Après un cran, la roue attend la fin du geste (200 ms sans défilement) : l'inertie du trackpad ne l'emballe pas.
     * Le défilement vertical reste à la page ; preventDefault évite le retour arrière du navigateur.
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
     * Empêche le glisser-déposer natif des images et des liens, qui interromprait le geste.
     */
    track.addEventListener("dragstart", event => event.preventDefault());


    /* -------------------- CARTE AGRANDIE : JEU OU DÉMO -------------------- */

    /*
     * Charge le jeu dans la carte. import.meta.url est l'adresse de ce fichier :
     * le chemin vers games/ reste juste quelle que soit la page.
     */
    function loadGame(stage) {
        const game = stage.dataset.game;
        if (!GAMES.includes(game)) return;
        const gameFrame = document.createElement("iframe");
        gameFrame.className = "project-card__frame";
        gameFrame.title = stage.dataset.gameTitle || game;
        gameFrame.src = new URL("../../games/" + game + ".html?lang=" + language, import.meta.url).href;
        /*
         * Le clavier doit aller au jeu dès son chargement. ?. accepte un document inaccessible.
         */
        gameFrame.addEventListener("load", () => {
            gameFrame.focus({ preventScroll: true });
            gameFrame.contentDocument?.querySelector("canvas")?.focus({ preventScroll: true });
        }, { once: true });
        stage.replaceChildren(gameFrame);
    }

    /*
     * La carte s'agrandit au centre de la roue ; ses voisines glissent vers les bords.
     */
    function expand(card, button, stage) {
        setActive(card);
        expanded = card;
        button.setAttribute("aria-expanded", "true");
        button.textContent = button.dataset.labelClose;
        stage.hidden = false;
        card.classList.add("project-card--expanded");
        if (stage.dataset.game) loadGame(stage);
        else stage.querySelector("textarea")?.focus({ preventScroll: true });
        render();
    }

    /*
     * Referme la carte ; changer de document décharge le jeu et arrête sa boucle d'animation.
     * Si le focus était dans le jeu ou la démo, il revient dans la carte au lieu de se perdre avec elle.
     */
    function collapse(card, restoreFocus = true) {
        const button = card.querySelector(".project-card__toggle[aria-expanded='true']");
        const stage = button && document.getElementById(button.getAttribute("aria-controls"));
        if (stage?.contains(document.activeElement)) restoreFocus = true;
        if (button) {
            button.setAttribute("aria-expanded", "false");
            button.textContent = button.dataset.labelOpen;
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
     * Échap referme le jeu ou la démo quand le focus est sur la page.
     * Dans l'iframe, Échap garde son rôle : retour au menu du jeu.
     */
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && expanded) collapse(expanded);
    });

    /*
     * Fenêtre réduite sous 1024 px ou passage au tactile : un jeu ouvert se referme.
     */
    noGames.addEventListener("change", () => {
        if (noGames.matches && expanded?.querySelector(".project-card__stage--game:not([hidden])")) collapse(expanded, false);
    });
    arrowMode.addEventListener("change", updateMode);
    narrow.addEventListener("change", render);


    /* -------------------- DÉMARRAGE -------------------- */

    /*
     * --expanded-width donne sa largeur à une carte agrandie.
     */
    const resizeObserver = new ResizeObserver(() => {
        if (!active) return;
        const width = Math.min(EXPANDED_MAX, track.clientWidth - (narrow.matches ? 0 : cardWidth() / 2));
        showcase.style.setProperty("--expanded-width", width + "px");
        requestRender();
    });
    resizeObserver.observe(track);

    /*
     * Le filtre retire des cartes : la carte du centre reste si elle est retenue, sinon la première prend sa place.
     * L'adresse ne désigne plus la carte écartée (au démarrage, active est encore vide : l'adresse est gardée).
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
        else render();
    }

    /*
     * Hauteur de défilement qui pose la roue sous l'en-tête : scroll-padding-top (base.css),
     * ou la hauteur de l'en-tête sur téléphone, où il est plus haut.
     * offsetTop ignore le glissement d'apparition (reveal.js) : la cible est la place finale de la roue.
     */
    function wheelTop() {
        let top = 0;
        for (let element = showcase; element; element = element.offsetParent) top += element.offsetTop;
        const headerRoom = Math.max(
            parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop),
            document.querySelector(".header").offsetHeight
        );
        return top - headerRoom;
    }

    /*
     * Depuis le haut de page, l'en-tête rétrécit pendant le trajet et fait remonter la page :
     * une fois le défilement et ce rétrécissement finis, la position est corrigée si besoin.
     * Le défilement suit scroll-behavior (base.css), donc le réglage « mouvement réduit ».
     * Le visiteur garde la main : molette, doigt, clavier ou clic pendant le trajet annulent la correction.
     * AbortController retire d'un coup tous les écouteurs d'un trajet ; un nouveau trajet annule le précédent.
     * Sans scrollend (anciens Safari), la correction attend 900 ms ; au-delà de 3 s, elle est abandonnée.
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
            await Promise.all(document.querySelector(".header").getAnimations({ subtree: true }).map(animation => animation.finished));
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
     * Adresse d'une carte (#projects/snake) : la carte passe au centre et la roue vient sous l'en-tête.
     * Une carte écartée par le filtre fait revenir le filtre sur « Tous ».
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
     * Première mise en place sans animation : les cartes ne partent pas toutes du centre.
     */
    showcase.classList.add("showcase--ready", "showcase--instant");
    initProjectFilter(showcase, cards, language, showCards);
    /*
     * La consigne rejoint la ligne des filtres : une ligne de moins au-dessus de la roue.
     */
    showcase.querySelector(".showcase__filters").append(hint);

    /*
     * Les liens « Projets » (menu, accueil, pied de page) et les filtres amènent la roue juste sous l'en-tête,
     * pas le titre de la section : les cartes tiennent à l'écran.
     * Ctrl, Cmd, Maj ou le clic du milieu gardent leur rôle (nouvel onglet, nouvelle fenêtre).
     * Le focus passe à la section, comme avec une ancre : la touche Tab continue dans les projets.
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
    requestAnimationFrame(() => requestAnimationFrame(() => showcase.classList.remove("showcase--instant")));
}
