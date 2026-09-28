export function initSkills() {
// -------------------- COMPÉTENCES (SECTION COMPÉTENCES) --------------------

// On récupère tous les boutons qui possèdent la classe "skill".
const skills = document.querySelectorAll(".skill");

/*
    On récupère la zone qui affichera
    l'explication de la compétence sélectionnée.
    Elle n'existe que dans la section Compétences.
*/
const skillDescription = document.getElementById("skill-description");

skills.forEach(function(skill) {

    // Pour chaque bouton, on écoute le clic.
    skill.addEventListener("click", function() {

        // Tous les boutons repassent à "non sélectionné".
        skills.forEach(function(otherSkill) {

            otherSkill.setAttribute("aria-pressed", "false");

        });

        // Seul le bouton cliqué est sélectionné.
        skill.setAttribute("aria-pressed", "true");

        /*
            Le contenu de chaque compétence est écrit dans le HTML
            (attributs data-...) : le même script sert donc
            pour la version française et la version anglaise.
        */
        skillDescription.textContent = "";

        // Titre de la compétence
        const detailTitle = document.createElement("h4");
        detailTitle.classList.add("skill-detail__title");
        detailTitle.textContent = skill.textContent;
        skillDescription.appendChild(detailTitle);

        // Description générale
        const detailText = document.createElement("p");
        detailText.classList.add("skill-detail__text");
        detailText.textContent = skill.dataset.description;
        skillDescription.appendChild(detailText);

        // Mise en avant éventuelle (ex. : le plus gros projet géré)
        if (skill.dataset.highlight) {

            const detailHighlight = document.createElement("p");
            detailHighlight.classList.add("skill-detail__highlight");
            detailHighlight.textContent = skill.dataset.highlight;
            skillDescription.appendChild(detailHighlight);

        }

        // Liste de ce qui est mis en œuvre (séparée par "|" dans le HTML)
        const detailListLabel = document.createElement("p");
        detailListLabel.classList.add("skill-detail__label");
        detailListLabel.textContent = skillDescription.dataset.labelList;
        skillDescription.appendChild(detailListLabel);

        const detailList = document.createElement("ul");
        detailList.classList.add("skill-detail__list");

        skill.dataset.list.split("|").forEach(function(item) {

            const listItem = document.createElement("li");
            listItem.textContent = item;
            detailList.appendChild(listItem);

        });

        skillDescription.appendChild(detailList);

        // Projets où la compétence est utilisée
        const detailProjects = document.createElement("p");
        detailProjects.classList.add("skill-detail__projects");
        detailProjects.textContent =
            skillDescription.dataset.labelProjects + " : " + skill.dataset.projects;
        skillDescription.appendChild(detailProjects);

    });

});



}
