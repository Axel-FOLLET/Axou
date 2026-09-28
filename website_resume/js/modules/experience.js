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
 * Relie chaque carte aux compétences écrites dans son verso (HTML).
 * Une seule source pour les deux langues : la page contient déjà le texte traduit.
 * Les écouteurs sont installés une fois ; les listes sont créées seulement au clic.
 */
/*
 * Marque la carte affichée dans la bulle et retire la marque des autres.
 * aria-current indique aux lecteurs d'écran l'élément en cours ; le CSS lui donne un style.
 */
function selectCard(selected, cards) {
    for (const card of cards) {
        if (card === selected) card.setAttribute("aria-current", "true");
        else card.removeAttribute("aria-current");
    }
}
export function initExperience() {
    const panel = document.querySelector(".experience__skills");
    if (!panel) return;
    const cards = document.querySelectorAll(".experience-card");
    for (const card of cards) {
        /*
         * Le spread convertit la NodeList en tableau ; map garde seulement le texte de chaque élément.
         */
        const skills = [...card.querySelectorAll(".experience-card__back li")].map(item => item.textContent.trim());
        /*
         * Même action pour le clic et le clavier : afficher les compétences et marquer la carte.
         */
        const activate = () => {
            showExperience(card, panel, skills);
            selectCard(card, cards);
        };
        card.addEventListener("click", activate);
        /*
         * Au clavier, Entrée et Espace activent la carte comme un bouton.
         * preventDefault empêche Espace de faire défiler la page.
         */
        card.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                activate();
            }
        });
    }
}
