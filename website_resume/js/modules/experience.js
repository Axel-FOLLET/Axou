/*
 * Interactions de la page : ce module expose ses fonctions d'initialisation.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
/*
 * card est la carte cliquée, panel la bulle et skills la liste des compétences.
 * La classe BEM retourne la carte sur petit écran ; la bulle reçoit une nouvelle liste.
 */
export function showExperience(card, panel, skills) {
    /*
     * toggle ajoute ou retire le modificateur BEM ; les styles déterminent l'effet visuel.
     */
    card.classList.toggle("experience-card--flipped");
    /*
     * La liste est construite en mémoire avant de remplacer le contenu affiché.
     */
    const list = document.createElement("ul");
    for (const skill of skills) {
        const item = document.createElement("li");
        /*
         * textContent insère du texte, sans l'interpréter comme du HTML.
         */
        item.textContent = skill;
        list.append(item);
    }
    /*
     * Remplace les anciens enfants en une opération, sans cumuler les listes.
     */
    panel.replaceChildren(list);
}
/*
 * Relie chaque entreprise aux compétences de la langue choisie.
 * Les écouteurs sont installés une fois ; les listes sont créées seulement au clic.
 */
export function initExperience(translations) {
    const panel = document.querySelector(".experience__skills");
    if (!panel) return;
    /*
     * Object.entries fournit les paires clé/valeur ; la déstructuration leur donne deux noms.
     */
    for (const [company, skills] of Object.entries(translations)) {
        const card = document.getElementById("experience-" + company);
        if (card) card.addEventListener("click", () => showExperience(card, panel, skills));
    }
}
