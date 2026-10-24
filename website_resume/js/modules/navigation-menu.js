/*
 * Interactions de la page : ce module expose ses fonctions d'initialisation.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
/*
 * Installe les interactions du menu mobile : clic, choix d'un lien et Échap.
 * Les classes pilotent le CSS ; les attributs ARIA décrivent le même état aux lecteurs d'écran.
 */
export function initNavigationMenu() {
    const navigation = document.querySelector(".header__nav");
    const toggle = document.querySelector(".header__toggle");
    const links = document.querySelector(".header__links");

    if (!navigation || !toggle || !links) {
        return;
    }

    const isEnglish = document.documentElement.lang === "en";

    /*
     * isOpen est un booléen : true ouvre le menu, false le ferme.
     * Le second argument de toggle impose cet état au lieu de simplement l'inverser.
     */
    function setMenuOpen(isOpen) {
        navigation.classList.toggle("header__nav--open", isOpen);
        /*
         * ARIA attend du texte : String convertit le booléen en "true" ou "false".
         */
        toggle.setAttribute("aria-expanded", String(isOpen));
        toggle.setAttribute(
            "aria-label",
            isOpen
                ? (isEnglish ? "Close navigation menu" : "Fermer le menu de navigation")
                : (isEnglish ? "Open navigation menu" : "Ouvrir le menu de navigation")
        );
    }

    toggle.addEventListener("click", function() {
        setMenuOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    links.addEventListener("click", function(event) {
        /*
         * closest retrouve aussi le lien si le clic touche un de ses éléments enfants.
         */
        if (event.target.closest("a")) {
            setMenuOpen(false);
        }
    });

    document.addEventListener("keydown", function(event) {
        if (event.key === "Escape" && navigation.classList.contains("header__nav--open")) {
            setMenuOpen(false);
            toggle.focus();
        }
    });

    /*
     * Écoute le franchissement du breakpoint, pas chaque pixel de redimensionnement.
     */
    window.matchMedia("(max-width: 1024px)").addEventListener("change", function(event) {
        if (!event.matches) {
            setMenuOpen(false);
        }
    });
}