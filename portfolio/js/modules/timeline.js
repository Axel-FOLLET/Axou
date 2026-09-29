/*
 * Chronologie de la page Compétences : la flèche descend au fil du défilement
 * et chaque étape apparaît quand la flèche l'atteint.
 * Sans JavaScript ou en mouvement réduit, tout reste affiché d'emblée.
 */


/*
 * Ligne de lecture placée à 80 % de la hauteur de l'écran : la pointe de la flèche
 * et l'apparition des étapes se calent sur elle.
 */
const READING_LINE = 0.8;


/*
 * Fait apparaître chaque étape quand son haut franchit la ligne de lecture.
 * Une étape affichée le reste : unobserve arrête de la surveiller.
 */
function revealSteps(timeline) {
    const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add("timeline__step--visible");
            observer.unobserve(entry.target);
        }
    }, { rootMargin: "0px 0px -" + (1 - READING_LINE) * 100 + "% 0px" });
    timeline.querySelectorAll(".timeline__step").forEach(step => observer.observe(step));
}


/*
 * Place la pointe de la flèche sur la ligne de lecture : --progress vaut 0 avant la chronologie,
 * 1 une fois celle-ci dépassée. requestAnimationFrame limite le calcul à une fois par image.
 */
function followScroll(timeline) {
    let frameId = null;
    function update() {
        frameId = null;
        const box = timeline.getBoundingClientRect();
        const progress = (window.innerHeight * READING_LINE - box.top) / box.height;
        timeline.style.setProperty("--progress", Math.min(Math.max(progress, 0), 1));
    }
    function requestUpdate() {
        if (frameId === null) frameId = requestAnimationFrame(update);
    }
    /*
     * passive: true promet au navigateur que l'écouteur ne bloque pas le défilement.
     */
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    update();
}


/*
 * La chronologie n'existe que sur la page Compétences : ailleurs, la fonction s'arrête.
 */
export function initTimeline() {
    const timeline = document.querySelector(".timeline");
    if (!timeline) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    timeline.classList.add("timeline--animated");
    revealSteps(timeline);
    followScroll(timeline);
}
