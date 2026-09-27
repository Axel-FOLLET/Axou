/*
 * Interactions de la page : ce module expose ses fonctions d'initialisation.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
/*
 * Relie chaque bouton data-skill à son texte dans descriptions.
 * Le même code sert pour les deux langues : seules les données changent.
 */
export function initSkills(descriptions) {
    const panel = document.querySelector(".skills__description");
    if (!panel) return;
    for (const button of document.querySelectorAll("[data-skill]")) {
        button.addEventListener("click", () => {
            /*
             * data-skill dans le HTML devient dataset.skill ; sa valeur sert de clé de recherche.
             */
            const description = descriptions[button.dataset.skill];
            if (description) panel.textContent = description;
        });
    }
}
