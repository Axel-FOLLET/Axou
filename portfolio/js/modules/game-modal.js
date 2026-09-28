/*
 * Interactions de la page : ce module expose ses fonctions d'initialisation.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
/*
 * Prépare la fenêtre commune aux jeux et garde en mémoire le bouton de lancement.
 * Les fonctions internes partagent ces éléments sans variables globales.
 */
export function initGameModal(language) {
    const modal = document.querySelector(".game-modal");
    const frame = document.querySelector(".game-modal__frame");
    const title = document.getElementById("game-modal-title");
    const closeButton = document.querySelector(".game-modal__close");
    const dialog = document.querySelector(".game-modal__dialog");
    if (!modal || !frame || !title || !closeButton || !dialog) return;
    let trigger = null;
    /*
     * Place le point d'origine de l'animation au centre du bouton, dans le repère de la fenêtre.
     * offsetLeft/offsetTop ignorent le scale() en cours, contrairement à getBoundingClientRect.
     */
    function setOriginFrom(button) {
        const buttonBox = button.getBoundingClientRect();
        const x = buttonBox.left + buttonBox.width / 2 - dialog.offsetLeft;
        const y = buttonBox.top + buttonBox.height / 2 - dialog.offsetTop;
        dialog.style.transformOrigin = x + "px " + y + "px";
    }
    /*
     * Masque la fenêtre, rétablit le défilement et décharge le jeu.
     * Le focus retourne au bouton qui l'avait ouvert.
     */
    function closeGame() {
        if (!modal.classList.contains("game-modal--open")) return;
        modal.classList.remove("game-modal--open");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("page--game-open");
        /*
         * Changer de document décharge le jeu et arrête sa boucle d'animation dans l'iframe.
         */
        frame.src = "about:blank";
        document.querySelectorAll("[data-game-inert]").forEach(element => {
            element.inert = false;
            delete element.dataset.gameInert;
        });
        /*
         * Le focus revient au lanceur sans déplacer la page ; ?. accepte l'absence de lanceur.
         */
        trigger?.focus({ preventScroll: true });
    }
    /*
     * Lit data-game et data-game-title sur le bouton.
     * Charge le jeu autorisé dans une iframe locale, uniquement au-dessus de 1024 px.
     */
    function openGame(button) {
        const game = button.dataset.game;
        if (window.innerWidth <= 1024 || !["pendu", "snake"].includes(game)) return;
        trigger = button;
        setOriginFrom(button);
        title.textContent = button.dataset.gameTitle || (language === "en" ? "Game" : "Jeu");
        frame.src = "games/" + game + ".html?lang=" + language;
        modal.classList.add("game-modal--open");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("page--game-open");
        document.querySelectorAll("body > .skip-link, body > header, body > main, body > footer").forEach(element => {
            if (!element.inert) { element.inert = true; element.dataset.gameInert = ""; }
        });
        closeButton.focus();
    }
    document.querySelectorAll("[data-game]").forEach(button => {
        button.addEventListener("click", () => openGame(button));
    });
    document.querySelectorAll("[data-game-close]").forEach(button => {
        button.addEventListener("click", closeGame);
    });
    window.addEventListener("resize", () => {
        if (window.innerWidth <= 1024) closeGame();
    });
    // Dans l'iframe, Echap garde son role : retour au menu du jeu.
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeGame();
    });
}
