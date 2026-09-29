/*
 * Interactions de la page : ce module expose ses fonctions d'initialisation.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
/*
 * Chaque étape de la frise a un bouton « Compétences & outils » qui déplie ou replie
 * la liste désignée par son aria-controls. hidden masque la liste pour tous, lecteurs d'écran compris ;
 * aria-expanded annonce l'état du bouton.
 */
function toggleSkills(button) {
    const list = document.getElementById(button.getAttribute("aria-controls"));
    if (!list) return;
    const isOpen = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!isOpen));
    list.hidden = isOpen;
    /*
     * --index décale l'apparition de chaque étiquette (experience.css) : elles arrivent l'une après l'autre.
     */
    if (!isOpen) {
        [...list.children].forEach((item, index) => item.style.setProperty("--index", index));
    }
}


export function initExperience() {
    document.querySelectorAll(".timeline__toggle").forEach(button => {
        button.addEventListener("click", () => toggleSkills(button));
    });
}
