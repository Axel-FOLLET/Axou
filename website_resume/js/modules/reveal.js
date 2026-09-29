/*
 * Apparition au défilement, comme sur le portfolio : chaque section, sauf l'accueil,
 * apparaît en fondu en remontant de quelques pixels quand elle entre à l'écran.
 * Sans JavaScript ou en mouvement réduit, tout reste affiché d'emblée.
 */


/*
 * La section apparaît quand son haut dépasse 90 % de la hauteur de l'écran.
 * Une section affichée le reste : unobserve arrête de la surveiller.
 */
function revealOnScroll(sections) {
    const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add("reveal--visible");
            observer.unobserve(entry.target);
        }
    }, { rootMargin: "0px 0px -10% 0px" });

    sections.forEach(section => observer.observe(section));
}


/*
 * L'accueil est déjà à l'écran à l'ouverture : il n'est pas animé.
 */
export function initReveal() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const sections = document.querySelectorAll("main > section:not(:first-of-type)");
    sections.forEach(section => section.classList.add("reveal"));
    revealOnScroll(sections);
}
