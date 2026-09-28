/*
 * Interactions de la page : ce module expose ses fonctions d'initialisation.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
/*
 * Met en valeur, dans le menu, le lien de la section en cours de lecture.
 * aria-current="location" l'annonce aussi aux lecteurs d'écran.
 */
export function initSectionTracker() {
    /*
     * Map associe l'id de chaque section au lien du menu qui y mène.
     */
    const linksById = new Map();
    for (const link of document.querySelectorAll('.navigation__links a[href^="#"]')) {
        const id = link.getAttribute("href").slice(1);
        if (document.getElementById(id)) linksById.set(id, link);
    }
    if (!linksById.size) return;
    /*
     * Un seul lien porte aria-current ; un id sans lien (l'accueil) les efface tous.
     */
    function setCurrent(id) {
        for (const [sectionId, link] of linksById) {
            if (sectionId === id) link.setAttribute("aria-current", "location");
            else link.removeAttribute("aria-current");
        }
    }
    /*
     * rootMargin réduit la zone observée à une bande située entre 30 % et 35 % de la hauteur :
     * la section qui traverse cette bande est celle que l'on est en train de lire.
     */
    const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
            if (entry.isIntersecting) setCurrent(entry.target.id);
        }
    }, { rootMargin: "-30% 0px -65% 0px" });
    /*
     * L'accueil est observé aussi : en remontant en haut de page, aucun lien n'est mis en valeur.
     */
    const ids = [...linksById.keys(), "home"];
    for (const id of ids) {
        const section = document.getElementById(id);
        if (section) observer.observe(section);
    }
}
