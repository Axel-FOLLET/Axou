/*
 * Apparition au défilement : chaque partie de page, sauf la première,
 * apparaît en fondu en remontant de quelques pixels quand elle entre à l'écran.
 * Sans JavaScript ou en mouvement réduit, tout reste affiché d'emblée.
 */


/*
 * La partie apparaît quand son haut dépasse 90 % de la hauteur de l'écran.
 * Une partie affichée le reste : unobserve arrête de la surveiller.
 */
function revealOnScroll(parts) {
    const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add("reveal--visible");
            observer.unobserve(entry.target);
        }
    }, { rootMargin: "0px 0px -10% 0px" });
    parts.forEach(part => observer.observe(part));
}


/*
 * La première partie est déjà à l'écran à l'ouverture : elle n'est pas animée.
 */
export function initReveal() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const parts = document.querySelectorAll("main > section:not(:first-of-type)");
    parts.forEach(part => part.classList.add("reveal"));
    revealOnScroll(parts);
}
