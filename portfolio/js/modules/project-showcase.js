/*
 * Bande des projets : une carte active à la fois, reliée à la bulle qui affiche
 * son objectif et ce que j'en retiens. « Jouer » et « Tester » agrandissent la carte
 * pour y afficher le jeu ou la démo, sans ouvrir de nouvelle fenêtre.
 * Sans ce module, la bande défile quand même et chaque carte garde tout son texte.
 */

/*
 * En dessous de 6 px, un appui à la souris reste un clic et ne fait pas glisser la bande.
 */
const DRAG_THRESHOLD = 6;
/*
 * Évasement du raccord de chaque côté, en pixels, entre le bas de la carte et la bulle.
 */
const NECK_FLARE = 18;
/*
 * Délai sans défilement après lequel la bande est considérée comme arrêtée.
 */
const SETTLE_DELAY = 150;
/*
 * Seuls ces jeux peuvent être chargés dans une carte.
 */
const GAMES = ["pendu", "snake"];


export function initProjectShowcase(language) {
    const showcase = document.querySelector(".showcase");
    const track = showcase?.querySelector(".showcase__track");
    const bubble = showcase?.querySelector(".showcase__bubble");
    if (!showcase || !track || !bubble) return;
    const eyebrow = bubble.querySelector(".showcase__bubble-eyebrow");
    const content = bubble.querySelector(".showcase__bubble-content");
    /*
     * La carte « Prochains projets » n'a ni objectif ni bulle : elle n'est jamais active.
     */
    const cards = [...track.querySelectorAll(".project-card:not(.project-card--upcoming)")];
    if (!cards.length) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    /*
     * Les flèches servent à la souris sur grand écran. Au doigt, on balaie : une consigne animée les remplace.
     * Les jeux se jouent au clavier : ni sur petit écran, ni sur écran tactile (tablette en paysage comprise).
     */
    const arrowMode = window.matchMedia("(min-width: 1025px) and (hover: hover) and (pointer: fine)");
    const noGames = window.matchMedia("(max-width: 1024px), (hover: none) and (pointer: coarse)");
    let active = null;
    let expanded = null;
    let drag = null;
    let suppressClick = false;
    let settleTimer = null;
    let neckFrame = null;

    function scrollBehavior() {
        return reducedMotion.matches ? "auto" : "smooth";
    }


    /* -------------------- FLÈCHES ET CONSIGNE -------------------- */

    const hint = document.createElement("p");
    hint.className = "showcase__hint";
    const hintText = document.createElement("span");
    /*
     * Chevrons décoratifs animés par le CSS en mode tactile : ils montrent le sens du geste.
     */
    const hintIcon = document.createElement("span");
    hintIcon.className = "showcase__hint-icon";
    hintIcon.setAttribute("aria-hidden", "true");
    hintIcon.textContent = "›››";
    hint.append(hintText, hintIcon);
    showcase.prepend(hint);

    function updateMode() {
        const touch = !arrowMode.matches;
        showcase.classList.toggle("showcase--touch", touch);
        hintText.textContent = (touch ? showcase.dataset.labelHintTouch : showcase.dataset.labelHint) || "";
    }

    /*
     * Cadre autour de la bande : il sert de repère aux flèches, placées de part et d'autre.
     */
    const frame = document.createElement("div");
    frame.className = "showcase__frame";
    track.before(frame);
    const previousButton = createArrow("←", showcase.dataset.labelPrev, "previous");
    const nextButton = createArrow("→", showcase.dataset.labelNext, "next");
    frame.append(previousButton, track, nextButton);

    function createArrow(symbol, label, side) {
        const button = document.createElement("button");
        button.className = "showcase__arrow showcase__arrow--" + side;
        button.type = "button";
        button.textContent = symbol;
        button.setAttribute("aria-label", label || "");
        return button;
    }

    function isAtEnd() {
        return track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    }

    function updateArrows() {
        const index = cards.indexOf(active);
        previousButton.disabled = index <= 0;
        nextButton.disabled = index === cards.length - 1 && isAtEnd();
    }

    previousButton.addEventListener("click", () => {
        const index = cards.indexOf(active);
        if (index > 0) setActive(cards[index - 1], true);
    });

    /*
     * Après la dernière carte, la flèche amène encore jusqu'à « Prochains projets ».
     */
    nextButton.addEventListener("click", () => {
        const index = cards.indexOf(active);
        if (index < cards.length - 1) setActive(cards[index + 1], true);
        else track.scrollTo({ left: track.scrollWidth, behavior: scrollBehavior() });
    });


    /* -------------------- CARTE ACTIVE ET BULLE -------------------- */

    /*
     * Le raccord est un simple bloc découpé en trapèze par clip-path (voir projects.css).
     */
    const neck = document.createElement("div");
    neck.className = "showcase__neck showcase__neck--hidden";
    neck.setAttribute("aria-hidden", "true");
    showcase.append(neck);

    /*
     * Fait défiler la bande (et la page si besoin) pour caler la carte sur le bord gauche.
     */
    function scrollToCard(card) {
        card.scrollIntoView({ behavior: scrollBehavior(), block: "nearest", inline: "start" });
    }

    /*
     * Rend la carte active : elle passe au bleu et la bulle reprend son objectif et ce que j'en retiens.
     * La copie de la bulle est masquée aux lecteurs d'écran, qui lisent déjà le texte dans la carte.
     */
    function setActive(card, scroll = false) {
        if (card !== active) {
            active?.classList.remove("project-card--active");
            active = card;
            card.classList.add("project-card--active");
            const theme = card.closest(".showcase__theme")?.querySelector(".showcase__tab")?.textContent.trim();
            const title = card.querySelector(".project-card__title")?.textContent.trim();
            eyebrow.textContent = [theme, title].filter(Boolean).join(" · ");
            const story = card.querySelector(".project-card__story");
            content.replaceChildren(...(story ? [story.cloneNode(true)] : []));
            if (!reducedMotion.matches) {
                content.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 220, easing: "ease-out" });
            }
            updateArrows();
        }
        if (scroll) scrollToCard(card);
        placeNeck();
    }

    /*
     * Place le raccord entre la partie visible du bas de la carte active et le haut de la bulle.
     * Les positions sont calculées dans le repère de .showcase (position: relative).
     */
    function placeNeck() {
        if (!active) return;
        const origin = showcase.getBoundingClientRect();
        const view = track.getBoundingClientRect();
        const card = active.getBoundingClientRect();
        const target = bubble.getBoundingClientRect();
        const left = Math.max(card.left, view.left);
        const right = Math.min(card.right, view.right);
        const height = target.top - card.bottom + 2;
        /*
         * Carte presque sortie de la bande : le raccord s'efface au lieu de pointer dans le vide.
         */
        if (right - left < 48 || height <= 0) {
            neck.classList.add("showcase__neck--hidden");
            return;
        }
        const bottomLeft = Math.max(left - NECK_FLARE, target.left + 1);
        const bottomRight = Math.min(right + NECK_FLARE, target.right - 1);
        neck.classList.remove("showcase__neck--hidden");
        neck.style.left = bottomLeft - origin.left + "px";
        neck.style.top = card.bottom - origin.top - 1 + "px";
        neck.style.width = bottomRight - bottomLeft + "px";
        neck.style.height = height + "px";
        neck.style.setProperty("--neck-top-left", left - bottomLeft + "px");
        neck.style.setProperty("--neck-top-right", right - bottomLeft + "px");
    }

    /*
     * Regroupe les recalculs demandés pendant une même image (défilement, redimensionnement).
     */
    function requestNeck() {
        if (neckFrame) return;
        neckFrame = requestAnimationFrame(() => {
            neckFrame = null;
            placeNeck();
        });
    }

    /*
     * Largeur visible d'une carte dans la bande, en pixels.
     */
    function visibleWidth(card) {
        const view = track.getBoundingClientRect();
        const box = card.getBoundingClientRect();
        return Math.max(0, Math.min(box.right, view.right) - Math.max(box.left, view.left));
    }

    /*
     * Bande arrêtée (doigt, pavé tactile, glisser) : si la carte active est presque sortie,
     * la carte la plus visible prend le relais. Une carte agrandie reste active.
     */
    function settle() {
        if (expanded) return;
        if (visibleWidth(active) >= active.offsetWidth * 0.6) return;
        let best = null;
        let bestShare = 0.5;
        cards.forEach(card => {
            const share = visibleWidth(card) / card.offsetWidth;
            if (share > bestShare + 0.01) {
                best = card;
                bestShare = share;
            }
        });
        if (best) setActive(best);
    }

    cards.forEach(card => {
        /*
         * Survol à la souris : la bulle suit. Pendant un jeu ou une démo, elle reste sur la carte agrandie.
         */
        card.addEventListener("pointerenter", event => {
            if (event.pointerType === "mouse" && !drag && !expanded) setActive(card);
        });
        card.addEventListener("focusin", () => setActive(card));
        card.addEventListener("click", () => setActive(card));
    });

    track.addEventListener("scroll", () => {
        showcase.classList.add("showcase--scrolling");
        requestNeck();
        clearTimeout(settleTimer);
        settleTimer = setTimeout(() => {
            showcase.classList.remove("showcase--scrolling");
            if (!drag) settle();
            updateArrows();
        }, SETTLE_DELAY);
    }, { passive: true });


    /* -------------------- GLISSER À LA SOURIS -------------------- */

    /*
     * Au doigt, la bande défile nativement. À la souris, on la fait glisser à la main.
     * Les champs, les cubes et les jeux gardent leur propre comportement.
     */
    track.addEventListener("pointerdown", event => {
        if (event.pointerType !== "mouse" || event.button !== 0) return;
        if (event.target.closest(".cube, input, textarea, select, output, .project-card__stage")) return;
        drag = { id: event.pointerId, x: event.clientX, scrollLeft: track.scrollLeft, moved: false };
    });

    track.addEventListener("pointermove", event => {
        if (!drag || event.pointerId !== drag.id) return;
        const distance = event.clientX - drag.x;
        if (!drag.moved) {
            if (Math.abs(distance) < DRAG_THRESHOLD) return;
            drag.moved = true;
            track.setPointerCapture(event.pointerId);
            showcase.classList.add("showcase--dragging");
        }
        track.scrollLeft = drag.scrollLeft - distance;
    });

    /*
     * Au lâcher, l'accroche reprend et cale la carte la plus proche.
     * Le clic qui suit un glisser est ignoré : il n'ouvre pas un lien par erreur.
     */
    function endDrag() {
        if (!drag) return;
        if (drag.moved) {
            suppressClick = true;
            setTimeout(() => { suppressClick = false; }, 0);
            showcase.classList.remove("showcase--dragging");
        }
        drag = null;
    }

    track.addEventListener("pointerup", endDrag);
    track.addEventListener("pointercancel", endDrag);
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
        const frame = document.createElement("iframe");
        frame.className = "project-card__frame";
        frame.title = stage.dataset.gameTitle || game;
        frame.src = new URL("../../games/" + game + ".html?lang=" + language, import.meta.url).href;
        /*
         * Le clavier doit aller au jeu dès son chargement. ?. accepte un document inaccessible.
         */
        frame.addEventListener("load", () => {
            frame.focus({ preventScroll: true });
            frame.contentDocument?.querySelector("canvas")?.focus({ preventScroll: true });
        }, { once: true });
        stage.replaceChildren(frame);
    }

    function expand(card, button, stage) {
        if (expanded && expanded !== card) collapse(expanded, false);
        expanded = card;
        setActive(card);
        button.setAttribute("aria-expanded", "true");
        button.textContent = button.dataset.labelClose;
        stage.hidden = false;
        card.classList.add("project-card--expanded");
        if (stage.dataset.game) loadGame(stage);
        else stage.querySelector("textarea")?.focus({ preventScroll: true });
        scrollToCard(card);
    }

    /*
     * Referme la carte ; changer de document décharge le jeu et arrête sa boucle d'animation.
     */
    function collapse(card, restoreFocus = true) {
        const button = card.querySelector(".project-card__toggle[aria-expanded='true']");
        const stage = button && document.getElementById(button.getAttribute("aria-controls"));
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
        if (restoreFocus) button?.focus({ preventScroll: true });
    }

    document.querySelectorAll(".project-card__toggle").forEach(button => {
        const card = button.closest(".project-card");
        const stage = document.getElementById(button.getAttribute("aria-controls"));
        if (!card || !stage) return;
        button.addEventListener("click", () => {
            if (button.getAttribute("aria-expanded") === "true") collapse(card);
            else expand(card, button, stage);
        });
        /*
         * Une fois la carte à sa nouvelle largeur, on la recale : elle peut avoir débordé de la bande.
         */
        card.addEventListener("transitionend", event => {
            if (event.target === card && event.propertyName === "flex-basis" && card === expanded) scrollToCard(card);
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


    /* -------------------- INVITATION À BALAYER -------------------- */

    /*
     * Au doigt, rien ne dit que la bande défile : la première fois qu'elle apparaît à l'écran,
     * les cartes glissent un peu vers la gauche puis reviennent, deux fois.
     * translate déplace l'affichage sans toucher au défilement, que l'accroche viendrait corriger.
     */
    function nudge() {
        if (reducedMotion.matches || !showcase.classList.contains("showcase--touch") || track.scrollLeft > 4) return;
        const keyframes = [
            { translate: "0" },
            { translate: "-56px 0", offset: 0.25 },
            { translate: "0", offset: 0.5 },
            { translate: "-28px 0", offset: 0.7 },
            { translate: "0" }
        ];
        [...track.children].forEach(element => {
            element.animate(keyframes, { duration: 1400, easing: "ease-in-out" });
        });
        /*
         * Le raccord relie la bulle, qui ne bouge pas : il s'efface le temps du mouvement.
         */
        neck.animate([{ opacity: 1 }, { opacity: 0, offset: 0.1 }, { opacity: 0, offset: 0.9 }, { opacity: 1 }], { duration: 1400 });
    }

    const nudgeObserver = new IntersectionObserver(entries => {
        if (!entries[0].isIntersecting) return;
        nudgeObserver.disconnect();
        setTimeout(nudge, 400);
    }, { threshold: 0.6 });
    nudgeObserver.observe(track);


    /* -------------------- DÉMARRAGE -------------------- */

    /*
     * --showcase-width donne sa largeur maximale à une carte agrandie.
     * Tout changement de taille (fenêtre, carte qui s'agrandit, bulle) replace le raccord.
     */
    const resizeObserver = new ResizeObserver(() => {
        showcase.style.setProperty("--showcase-width", track.clientWidth + "px");
        requestNeck();
        updateArrows();
    });
    resizeObserver.observe(track);
    resizeObserver.observe(bubble);
    cards.forEach(card => resizeObserver.observe(card));
    window.addEventListener("resize", requestNeck);

    updateMode();
    showcase.classList.add("showcase--ready");
    bubble.hidden = false;
    setActive(cards[0]);
}
