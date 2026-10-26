/*
 * Finitions de mouvement communes au portfolio et au site CV (styles dans motion.css) :
 * apparition en cascade, trait glissant sous les liens du menu, boutons magnétiques,
 * entrée en scène de l'accueil, apparition des grands titres, halo des cartes, détails de la frise,
 * chiffrement des cartes data-hover="cipher" et changement de langue des cartes data-hover="language".
 * Chaque partie vérifie que ses éléments existent : le fichier se copie tel quel d'un site à l'autre.
 * En mouvement réduit, ni cascade, ni magnétisme, ni entrée en scène, ni apparition des titres, ni halo,
 * ni chiffrement, ni changement de langue ;
 * le trait change de lien sans glisser (motion.css).
 */

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)");

/*
 * Ensembles répétés qui apparaissent l'un après l'autre : étapes de frise, items de la méthode,
 * cartes de liens et étiquettes. Les cartes de la roue des projets n'y sont pas :
 * project-showcase.js les place et les filtre déjà, une seconde animation les gênerait.
 */
const STAGGER_ITEMS = ".timeline__step, .method__item, .link-list > li, .tag";

/* Le trait n'existe que sur ordinateur, quand les liens sont alignés dans l'en-tête */
const DESKTOP_MENU = window.matchMedia("(min-width: 1025px)");

/* Distance du trait au bas du lien, comme l'ancien soulignement */
const INDICATOR_BOTTOM = 9;

/* Déplacement maximal d'un bouton magnétique, et part du chemin restant parcourue à chaque image */
const MAGNET_MAX = 6;
const MAGNET_EASE = 0.18;

/* Survols réservés à la souris et au pavé tactile : au doigt, un survol ne se termine jamais vraiment */
const FINE_HOVER = window.matchMedia("(hover: hover) and (pointer: fine)");

/* Chiffrement de César : décalage de 3 lettres, comme l'exemple historique, une lettre toutes les 45 ms */
const CIPHER_SHIFT = 3;
const CIPHER_STEP_MS = 45;

/* Changement de langue : un mot toutes les 550 ms, le temps de le lire */
const LANGUAGE_STEP_MS = 550;

/* Grands titres qui montent ligne par ligne : sections, reconversion (CV), méthode (portfolio), pied de page */
const TITLES = ".section__title, .career__intro h2, .method__title, .footer__cta-title";

/* Cartes éclairées par le halo : projets et liens de contact */
const HALO_CARDS = ".project-card, .link-card";


/* -------------------- APPARITION EN CASCADE -------------------- */

/*
 * Numérote les éléments répétés de chaque bloc animé par reveal.js (classe reveal) :
 * --i est leur rang parmi les frères de la même liste, motion.css en tire le délai.
 * À la fin de l'animation, la classe et le rang sont retirés : un filtre ou un réaffichage ne la rejoue pas.
 */
function initStagger() {
    if (REDUCED_MOTION.matches) return;
    const ranks = new Map();
    document.querySelectorAll(".reveal").forEach(part => {
        part.querySelectorAll(STAGGER_ITEMS).forEach(item => {
            const rank = ranks.get(item.parentElement) ?? 0;
            ranks.set(item.parentElement, rank + 1);
            item.style.setProperty("--i", rank);
            item.classList.add("motion-stagger");
            item.addEventListener("animationend", function done(event) {
                if (event.target !== item) return;
                item.classList.remove("motion-stagger");
                item.style.removeProperty("--i");
                item.removeEventListener("animationend", done);
            });
        });
    });
}


/* -------------------- TRAIT GLISSANT DU MENU -------------------- */

/*
 * Place le trait sous un lien, entre ses marges intérieures (lues dans le CSS du site),
 * ou le masque s'il n'y a aucun lien à souligner : il garde alors sa place,
 * et le survol suivant le fait glisser depuis le dernier lien souligné.
 * offsetLeft et offsetTop se mesurent depuis la liste, positionnée par motion.css.
 */
function placeIndicator(indicator, link) {
    if (!link || !DESKTOP_MENU.matches) {
        indicator.classList.remove("header__indicator--visible");
        return;
    }
    const style = getComputedStyle(link);
    const left = link.offsetLeft + parseFloat(style.paddingLeft);
    const width = link.offsetWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const top = link.offsetTop + link.offsetHeight - INDICATOR_BOTTOM;
    indicator.style.translate = `${left}px ${top}px`;
    indicator.style.width = `${width}px`;
    indicator.classList.add("header__indicator--visible");
}


/*
 * Un seul trait pour tout le menu : il glisse d'un lien survolé (ou atteint au clavier) à l'autre,
 * et s'efface en quittant le menu. La section affichée (aria-current, posé par navigation.js),
 * déjà cerclée de blanc, n'en a pas besoin : le trait s'efface aussi sur elle.
 * Un MutationObserver suit les changements de section au défilement.
 * L'élément est un li caché aux lecteurs d'écran : une liste ne contient que des li.
 */
function initIndicator() {
    const list = document.querySelector(".header__links");
    const links = list ? Array.from(list.querySelectorAll(".header__link")) : [];
    if (!links.length) return;
    const indicator = document.createElement("li");
    indicator.className = "header__indicator";
    indicator.setAttribute("aria-hidden", "true");
    list.append(indicator);
    let hovered = null;

    function update() {
        placeIndicator(indicator, hovered?.getAttribute("aria-current") === "true" ? null : hovered);
    }

    links.forEach(link => {
        link.addEventListener("pointerenter", () => {
            hovered = link;
            update();
        });
        link.addEventListener("focus", () => {
            hovered = link;
            update();
        });
        link.addEventListener("blur", () => {
            hovered = null;
            update();
        });
    });
    list.addEventListener("pointerleave", () => {
        hovered = null;
        update();
    });
    new MutationObserver(update).observe(list, { subtree: true, attributeFilter: ["aria-current"] });
    window.addEventListener("resize", update);
    DESKTOP_MENU.addEventListener("change", update);
    /* La police définitive change la largeur des liens : on remesure une fois chargée */
    document.fonts?.ready.then(update);
    update();
    /* Transition activée après la première mise en place, sinon le trait traverserait le menu à l'ouverture */
    requestAnimationFrame(() => {
        requestAnimationFrame(() => indicator.classList.add("header__indicator--ready"));
    });
}


/* -------------------- BOUTONS MAGNÉTIQUES -------------------- */

/*
 * Le bouton glisse de quelques pixels vers le curseur, au plus MAGNET_MAX, puis revient en douceur.
 * Chaque image parcourt une part du chemin restant (MAGNET_EASE) : un mouvement amorti sans transition CSS,
 * qui ne remplace donc pas les transitions du bouton. transform reste libre : appui (scale)
 * et secousse d'erreur (translate) utilisent leurs propres propriétés.
 */
function attachMagnet(button) {
    let target = { x: 0, y: 0 };
    let current = { x: 0, y: 0 };
    let frame = 0;

    function step() {
        current.x += (target.x - current.x) * MAGNET_EASE;
        current.y += (target.y - current.y) * MAGNET_EASE;
        const settled = Math.abs(target.x - current.x) < 0.05 && Math.abs(target.y - current.y) < 0.05;
        if (settled) current = { ...target };
        /* Revenu au repos : le style est retiré, le bouton redevient ordinaire */
        if (settled && !current.x && !current.y) button.style.removeProperty("transform");
        else button.style.transform = `translate(${current.x.toFixed(2)}px, ${current.y.toFixed(2)}px)`;
        frame = settled ? 0 : requestAnimationFrame(step);
    }

    function moveTo(x, y) {
        target = { x, y };
        if (!frame) frame = requestAnimationFrame(step);
    }

    /*
     * Écart du curseur au centre du bouton au repos (sa position mesurée moins le décalage en cours),
     * ramené entre -1 et 1 sur chaque axe, puis multiplié par MAGNET_MAX.
     */
    button.addEventListener("pointermove", event => {
        if (event.pointerType !== "mouse" || REDUCED_MOTION.matches || button.disabled) return;
        const box = button.getBoundingClientRect();
        const x = (event.clientX - box.left + current.x - box.width / 2) / (box.width / 2);
        const y = (event.clientY - box.top + current.y - box.height / 2) / (box.height / 2);
        const clamp = value => Math.max(-1, Math.min(1, value));
        moveTo(clamp(x) * MAGNET_MAX, clamp(y) * MAGNET_MAX);
    });
    button.addEventListener("pointerleave", () => moveTo(0, 0));
}


/*
 * Seulement avec une souris ou un pavé tactile précis (hover et pointer: fine) :
 * au doigt, le bouton ne doit pas bouger sous le doigt.
 */
function initMagnets() {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    document.querySelectorAll(".button--primary").forEach(attachMagnet);
}


/* -------------------- ENTRÉE EN SCÈNE DE L'ACCUEIL -------------------- */

/*
 * Enveloppe chaque mot du titre dans un masque, sans toucher au texte : les espaces restent
 * des nœuds texte entre les masques, la coupure des lignes et textContent ne changent pas.
 * Les span sont neutres pour les lecteurs d'écran : le titre garde son nom accessible.
 * Les enfants (br, span) sont parcourus aussi : seuls les nœuds texte sont découpés.
 */
function wrapWords(element) {
    const masks = [];
    const texts = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) texts.push(walker.currentNode);
    texts.forEach(text => {
        const fragment = document.createDocumentFragment();
        text.data.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) {
                fragment.append(part);
                return;
            }
            const mask = document.createElement("span");
            const word = document.createElement("span");
            mask.className = "motion-intro__mask";
            word.className = "motion-intro__word";
            word.textContent = part;
            mask.append(word);
            fragment.append(mask);
            masks.push(mask);
        });
        text.replaceWith(fragment);
    });
    return masks;
}


/*
 * Rang de ligne de chaque mot, d'après sa position réelle à l'écran : un mot plus bas
 * que le précédent (de plus de 2 px) commence une nouvelle ligne. Refait au redimensionnement
 * et au chargement de la police, qui peuvent déplacer la coupure des lignes.
 */
function measureLines(hero, masks) {
    let line = -1;
    let top = -Infinity;
    masks.forEach(mask => {
        const maskTop = mask.getBoundingClientRect().top;
        if (maskTop > top + 2) {
            line += 1;
            top = maskTop;
        }
        mask.style.setProperty("--line", line);
    });
    hero.style.setProperty("--lines", line + 1);
}


/*
 * Le nom monte ligne par ligne, puis les éléments qui le suivent (poste, phrase, bouton) arrivent en fondu.
 * La page attend main.js avant de s'afficher (blocking="render") : la classe est posée avant la première image,
 * le texte n'apparaît jamais avant son animation.
 * Une fois toutes les animations finies (ou interrompues), la classe et les rangs sont retirés :
 * le titre redevient du texte ordinaire et les mesures s'arrêtent.
 */
function initIntro() {
    if (REDUCED_MOTION.matches) return;
    const hero = document.querySelector(".hero");
    const title = hero?.querySelector("h1");
    if (!title) return;
    const masks = wrapWords(title);
    const followers = [];
    for (let element = title.nextElementSibling; element; element = element.nextElementSibling) followers.push(element);
    followers.forEach((element, index) => {
        element.classList.add("motion-intro__follow");
        element.style.setProperty("--i", index);
    });
    const remeasure = () => measureLines(hero, masks);
    measureLines(hero, masks);
    hero.classList.add("motion-intro");
    window.addEventListener("resize", remeasure);
    document.fonts?.ready.then(() => {
        if (hero.classList.contains("motion-intro")) remeasure();
    });

    const animations = hero.getAnimations({ subtree: true })
        .filter(animation => animation.animationName?.startsWith("motion-intro"));
    Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
        hero.classList.remove("motion-intro");
        hero.style.removeProperty("--lines");
        masks.forEach(mask => mask.style.removeProperty("--line"));
        followers.forEach(element => {
            element.classList.remove("motion-intro__follow");
            element.style.removeProperty("--i");
        });
        window.removeEventListener("resize", remeasure);
    });
}


/* -------------------- APPARITION DES TITRES -------------------- */

/*
 * Les mots de chaque grand titre attendent sous leur masque (motion-title), puis montent ligne par ligne
 * quand le titre entre à l'écran (motion-title--play). Les lignes sont mesurées à ce moment-là : la police est chargée.
 * Une fois les montées finies (ou interrompues), les classes et les rangs sont retirés, comme pour l'accueil.
 */
function playTitle(title, masks) {
    measureLines(title, masks);
    title.classList.add("motion-title--play");
    const transitions = title.getAnimations({ subtree: true })
        .filter(animation => animation.transitionProperty === "translate");
    Promise.allSettled(transitions.map(transition => transition.finished)).then(() => {
        title.classList.remove("motion-title", "motion-title--play");
        title.style.removeProperty("--lines");
        masks.forEach(mask => mask.style.removeProperty("--line"));
    });
}


function initTitles() {
    if (REDUCED_MOTION.matches || !("IntersectionObserver" in window)) return;
    const titles = new Map();
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            observer.unobserve(entry.target);
            playTitle(entry.target, titles.get(entry.target));
        });
    }, { rootMargin: "0px 0px -10% 0px" });
    document.querySelectorAll(TITLES).forEach(title => {
        titles.set(title, wrapWords(title));
        title.classList.add("motion-title");
        observer.observe(title);
    });
}


/* -------------------- HALO DES CARTES -------------------- */

/* Position du curseur dans la carte, en %, pour le dégradé de motion.css */
function attachHalo(card) {
    card.classList.add("motion-halo");
    card.addEventListener("pointermove", event => {
        if (event.pointerType !== "mouse") return;
        const box = card.getBoundingClientRect();
        card.style.setProperty("--halo-x", `${((event.clientX - box.left) / box.width * 100).toFixed(1)}%`);
        card.style.setProperty("--halo-y", `${((event.clientY - box.top) / box.height * 100).toFixed(1)}%`);
    });
}


/* Même condition que le magnétisme : souris ou pavé tactile précis, mouvement non réduit */
function initHalos() {
    if (!FINE_HOVER.matches || REDUCED_MOTION.matches) return;
    document.querySelectorAll(HALO_CARDS).forEach(attachHalo);
}


/* -------------------- DÉTAILS DE LA FRISE -------------------- */

/*
 * Dans chaque étape de frise, les éléments du contenu (timeline__content) reçoivent la classe timeline__detail
 * et leur rang --i : motion.css les pose l'un après l'autre quand l'étape s'allume.
 * Sans contenu enveloppé, ce sont les enfants de l'étape, hors numéro et date.
 */
function initTimelineDetails() {
    if (REDUCED_MOTION.matches) return;
    document.querySelectorAll(".timeline__step").forEach(step => {
        const content = step.querySelector(".timeline__content");
        const details = content
            ? Array.from(content.children)
            : Array.from(step.children).filter(child => !child.matches(".timeline__number, .timeline__date"));
        details.forEach((detail, index) => {
            detail.classList.add("timeline__detail");
            detail.style.setProperty("--i", index);
        });
    });
}


/* -------------------- CHIFFREMENT AU SURVOL -------------------- */

/*
 * Décale une lettre de shift rangs dans l'alphabet, en gardant la casse.
 * Une lettre accentuée est chiffrée sans son accent (é devient h) ; les autres signes ne changent pas.
 */
function shiftLetter(character, shift) {
    const letter = character.normalize("NFD")[0];
    if (!/[a-z]/i.test(letter)) return character;
    const start = letter === letter.toUpperCase() ? 65 : 97;
    return String.fromCharCode((letter.charCodeAt(0) - start + shift) % 26 + start);
}


/*
 * Sans clé : César de CIPHER_SHIFT rangs. Avec la clé data-cipher-vigenere : Vigenère,
 * chaque lettre est décalée par la lettre suivante de la clé (A = 0), qui n'avance que sur les lettres.
 */
function encode(characters, key) {
    let rank = 0;
    return characters.map(character => {
        if (!key) return shiftLetter(character, CIPHER_SHIFT);
        if (!/[a-z]/i.test(character.normalize("NFD")[0])) return character;
        const shift = key.toUpperCase().charCodeAt(rank % key.length) - 65;
        rank += 1;
        return shiftLetter(character, shift);
    });
}


/*
 * Au survol de la carte, les lettres du mot data-cipher se chiffrent une à une ; en la quittant,
 * elles reviennent une à une. Le mot affiché passe par data-cipher-shown (motion.css) :
 * le texte de la page ne change jamais, lecteurs d'écran et annonce de la roue lisent toujours l'original.
 * Sans lettre chiffrée, l'attribut est retiré et le mot redevient ordinaire.
 * Un mot marqué data-cipher-off attend son tour : la démo du chiffrement choisit le mot selon la méthode
 * et prévient la carte par l'évènement cipherchange.
 */
function attachCipher(card) {
    const words = Array.from(card.querySelectorAll("[data-cipher]")).map(element => {
        const plain = Array.from(element.textContent);
        return { element, plain, coded: encode(plain, element.dataset.cipherVigenere) };
    });
    let count = 0;
    let target = 0;
    let timer = 0;

    const isOn = word => !word.element.hasAttribute("data-cipher-off");
    const length = () => Math.max(0, ...words.filter(isOn).map(word => word.plain.length));

    function render() {
        words.forEach(word => {
            const { element, plain, coded } = word;
            if (!count || !isOn(word)) element.removeAttribute("data-cipher-shown");
            else element.setAttribute("data-cipher-shown", coded.slice(0, count).join("") + plain.slice(count).join(""));
        });
    }

    function step() {
        count += Math.sign(target - count);
        render();
        if (count === target) {
            clearInterval(timer);
            timer = 0;
        }
    }

    function moveTo(value) {
        target = value;
        if (!timer && count !== target) timer = setInterval(step, CIPHER_STEP_MS);
    }

    card.addEventListener("pointerenter", event => {
        if (event.pointerType === "mouse" && !REDUCED_MOTION.matches) moveTo(length());
    });
    card.addEventListener("pointerleave", () => moveTo(0));

    /* Nouveau mot marqué : l'ancien redevient lisible, le nouveau se chiffre depuis le début si la souris est sur la carte */
    card.addEventListener("cipherchange", () => {
        count = 0;
        render();
        if (target) moveTo(length());
    });
}


/*
 * Le mot affiché est un ::after dont le texte de remplacement est vide (content: … / "") :
 * un navigateur qui ne connaît pas cette écriture lirait le mot chiffré, il garde donc le mot fixe.
 */
function initCiphers() {
    if (!FINE_HOVER.matches || !CSS.supports("content", "\"a\" / \"\"")) return;
    document.querySelectorAll('[data-hover="cipher"]').forEach(card => {
        if (card.querySelector("[data-cipher]")) attachCipher(card);
    });
}


/* -------------------- CHANGEMENT DE LANGUE AU SURVOL -------------------- */

/*
 * Au survol de la carte, le mot data-language passe d'une traduction à l'autre (liste séparée par des espaces
 * dans l'attribut), revient au mot d'origine et recommence tant que la souris reste sur la carte ;
 * en la quittant, il redevient aussitôt le mot d'origine. Même affichage que le chiffrement (data-language-shown, motion.css) :
 * le texte de la page ne change jamais.
 */
function attachLanguage(card) {
    const words = Array.from(card.querySelectorAll("[data-language]")).map(element => ({
        element,
        translations: element.dataset.language.split(" ").filter(Boolean)
    }));
    let index = 0;
    let timer = 0;

    /* Rang 0 : mot d'origine ; rang n : n-ième traduction, chaque mot bouclant sur sa propre liste */
    function render() {
        words.forEach(({ element, translations }) => {
            const rank = index % (translations.length + 1);
            if (!rank) element.removeAttribute("data-language-shown");
            else element.setAttribute("data-language-shown", translations[rank - 1]);
        });
    }

    function step() {
        index += 1;
        render();
    }

    card.addEventListener("pointerenter", event => {
        if (event.pointerType !== "mouse" || REDUCED_MOTION.matches || timer) return;
        step();
        timer = setInterval(step, LANGUAGE_STEP_MS);
    });
    card.addEventListener("pointerleave", () => {
        clearInterval(timer);
        timer = 0;
        index = 0;
        render();
    });
}


/* Même condition que le chiffrement : sans texte de remplacement vide, le mot reste fixe */
function initLanguages() {
    if (!FINE_HOVER.matches || !CSS.supports("content", "\"a\" / \"\"")) return;
    document.querySelectorAll('[data-hover="language"]').forEach(card => {
        if (card.querySelector("[data-language]")) attachLanguage(card);
    });
}


/*
 * Lance les finitions. À appeler après initReveal : la cascade s'appuie sur ses classes.
 * Le serpent, le bonhomme, le chat et la flèche (data-hover="snake", "hangman", "cat", "cursor") n'ont besoin que de motion.css.
 */
export function initMotion() {
    initStagger();
    initIndicator();
    initMagnets();
    initIntro();
    initTitles();
    initHalos();
    initTimelineDetails();
    initCiphers();
    initLanguages();
}
