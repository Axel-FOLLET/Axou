/*
 * Compétences : un clic sur un bouton affiche son détail dans la zone de description.
 * Le contenu est écrit dans le HTML (attributs data-*) : un seul script pour FR et EN.
 */


/*
 * Crée un élément avec sa classe BEM et son texte.
 * textContent insère du texte, sans l'interpréter comme du HTML.
 */
function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
}


/*
 * Construit la liste de ce qui est mis en œuvre (éléments séparés par "|" dans le HTML).
 */
function createList(items) {
    const list = document.createElement("ul");
    list.className = "skill-detail__list";
    for (const item of items.split("|")) {
        list.append(createElement("li", "", item));
    }
    return list;
}


/*
 * Remplace le contenu de la zone par le détail de la compétence choisie.
 * Les libellés communs (liste, projets) sont lus sur la zone elle-même.
 */
function showSkill(skill, panel) {
    const parts = [
        createElement("h4", "skill-detail__title", skill.textContent),
        createElement("p", "skill-detail__text", skill.dataset.description)
    ];
    /*
     * La mise en avant (ex. : le plus gros projet géré) est facultative.
     */
    if (skill.dataset.highlight) {
        parts.push(createElement("p", "skill-detail__highlight", skill.dataset.highlight));
    }
    parts.push(
        createElement("p", "skill-detail__label", panel.dataset.labelList),
        createList(skill.dataset.list),
        createElement("p", "skill-detail__projects", panel.dataset.labelProjects + " : " + skill.dataset.projects)
    );
    /*
     * replaceChildren remplace l'ancien contenu en une seule opération.
     */
    panel.replaceChildren(...parts);
    /*
     * Fondu court du nouveau texte : le changement se remarque sans rien déplacer.
     * animate() n'ajoute pas de classe : un nouveau clic relance simplement le fondu.
     */
    panel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "ease-out" });
}


/*
 * aria-pressed indique le bouton affiché : "true" pour lui, "false" pour les autres.
 */
function selectSkill(selected, skills) {
    for (const skill of skills) {
        skill.setAttribute("aria-pressed", String(skill === selected));
    }
}


/*
 * La zone de description n'existe que sur la page Compétences : ailleurs, la fonction s'arrête.
 */
export function initSkills() {
    const skills = document.querySelectorAll(".skill");
    const panel = document.getElementById("skill-description");
    if (!panel) return;
    for (const skill of skills) {
        skill.addEventListener("click", () => {
            selectSkill(skill, skills);
            showSkill(skill, panel);
        });
    }
}
