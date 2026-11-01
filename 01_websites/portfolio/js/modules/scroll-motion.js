/*
 * Mouvements liés au défilement et à la souris, communs au portfolio et au site CV (styles dans scroll.css) :
 * textes d'introduction qui s'allument mot par mot au fil du défilement, cubes de l'accueil qui suivent la souris.
 * Chaque partie vérifie que ses éléments existent : le fichier se copie tel quel d'un site à l'autre.
 * En mouvement réduit, rien ne bouge et les textes restent entiers.
 */

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)");

/* Survols réservés à la souris et au pavé tactile, comme dans motion.js */
const FINE_HOVER = window.matchMedia("(hover: hover) and (pointer: fine)");

/* Textes qui s'allument : les introductions de section */
const LIT_TEXTS = ".section__intro";

/* Part du chemin restant parcourue à chaque image par les cubes : ils suivent la souris avec un léger retard */
const PARALLAX_EASE = 0.08;


/* -------------------- TEXTE QUI S'ALLUME -------------------- */

/*
 * Range chaque mot dans un span ; --p (de 0 à 1) est sa place dans le texte, scroll.css en tire
 * le moment où il s'allume. Les espaces restent des nœuds texte : une espace insécable empêche toujours la coupure.
 * Les mots des liens et des passages en gras sont rangés aussi : TreeWalker parcourt tous les nœuds texte.
 */
function splitWords(text) {
    const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const words = [];
    nodes.forEach(node => {
        const parts = node.textContent.split(/(\s+)/);
        const fragment = document.createDocumentFragment();
        parts.forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) {
                fragment.append(part);
                return;
            }
            const word = document.createElement("span");
            word.className = "lit-word";
            word.textContent = part;
            fragment.append(word);
            words.push(word);
        });
        node.replaceWith(fragment);
    });
    words.forEach((word, index) => word.style.setProperty("--p", (index / Math.max(words.length - 1, 1)).toFixed(3)));
}


/*
 * Sans animation-timeline (Firefox par exemple), le texte reste entier : rien n'est découpé.
 */
export function initScrollWords() {
    if (REDUCED_MOTION.matches || !CSS.supports("animation-timeline: view()")) return;
    document.querySelectorAll(LIT_TEXTS).forEach(text => {
        splitWords(text);
        text.classList.add("lit-text");
    });
}


/* -------------------- CUBES QUI SUIVENT LA SOURIS -------------------- */

/*
 * --mx et --my vont de -1 à 1 selon la place de la souris dans l'accueil ; scroll.css déplace
 * chaque cube d'une distance différente : l'écart entre les plans donne la profondeur.
 * La boucle d'animation s'arrête une fois les cubes arrivés, et repart au mouvement suivant.
 */
export function initHeroParallax() {
    const hero = document.querySelector(".hero");
    const visual = hero?.querySelector(".hero__visual");
    if (!visual || REDUCED_MOTION.matches || !FINE_HOVER.matches) return;
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let frameId = null;

    function step() {
        current.x += (target.x - current.x) * PARALLAX_EASE;
        current.y += (target.y - current.y) * PARALLAX_EASE;
        visual.style.setProperty("--mx", current.x.toFixed(4));
        visual.style.setProperty("--my", current.y.toFixed(4));
        const settled = Math.abs(target.x - current.x) < 0.001 && Math.abs(target.y - current.y) < 0.001;
        frameId = settled ? null : requestAnimationFrame(step);
    }

    function follow(x, y) {
        target.x = x;
        target.y = y;
        if (frameId === null) frameId = requestAnimationFrame(step);
    }

    hero.addEventListener("pointermove", event => {
        if (event.pointerType !== "mouse") return;
        const box = hero.getBoundingClientRect();
        follow((event.clientX - box.left) / box.width * 2 - 1, (event.clientY - box.top) / box.height * 2 - 1);
    });
    /* La souris quitte l'accueil : les cubes reviennent à leur place */
    hero.addEventListener("pointerleave", () => follow(0, 0));
}
