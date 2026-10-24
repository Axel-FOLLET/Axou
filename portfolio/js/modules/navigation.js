import { initNavigationMenu } from "./navigation-menu.js";

/*
 * Seuils de l'en-tête compact, en pixels défilés. L'écart entre les deux évite un clignotement :
 * en rétrécissant, l'en-tête fait remonter la page d'une vingtaine de pixels.
 */
const COMPACT_FROM = 80;
const EXPAND_UNDER = 20;

/*
 * Une section devient la section affichée quand son haut passe au-dessus du premier tiers de l'écran.
 */
const ACTIVE_LINE = 1 / 3;


/*
 * Compacte l'en-tête quand la page défile, le rend à sa taille en revenant en haut.
 * passive: true promet au navigateur que l'écouteur ne bloque pas le défilement.
 */
function watchScroll(header) {
    function update() {
        if (window.scrollY > COMPACT_FROM) header.classList.add("header--compact");
        else if (window.scrollY < EXPAND_UNDER) header.classList.remove("header--compact");
    }
    window.addEventListener("scroll", update, { passive: true });
    update();
}


/*
 * Marque dans le menu la section affichée (aria-current), recopie son nom dans l'en-tête mobile
 * et ajoute son ancre au lien de langue : changer de langue garde la même section.
 */
function watchSections() {
    const links = Array.from(document.querySelectorAll('.header__link[href^="#"]'));
    const sections = links.map(link => document.getElementById(link.hash.slice(1)));
    const current = document.querySelector(".header__current");
    const language = document.querySelector("a.language-switch__option");
    if (!links.length || sections.includes(null)) return;
    const languagePage = language ? language.getAttribute("href").split("#")[0] : "";
    let active = null;

    /*
     * index vaut -1 tant qu'aucune section du menu n'a atteint la ligne (accueil du CV, absent du menu) :
     * aucun lien n'est alors marqué.
     */
    function update() {
        const line = window.innerHeight * ACTIVE_LINE;
        let index = -1;
        sections.forEach((section, i) => {
            if (section.getBoundingClientRect().top <= line) index = i;
        });
        /*
         * En bas de page, la dernière section peut être trop courte pour atteindre la ligne : on la force.
         */
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
            index = sections.length - 1;
        }
        if (index === active) return;
        active = index;
        links.forEach((link, i) => {
            if (i === index) link.setAttribute("aria-current", "true");
            else link.removeAttribute("aria-current");
        });
        if (current) current.textContent = index < 0 ? "" : links[index].textContent;
        // Sur l'accueil, le lien de langue reste sans ancre
        const hash = index < 0 || links[index].hash === "#home" ? "" : links[index].hash;
        if (language) language.href = languagePage + hash;
    }
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
}


/*
 * Active le menu mobile, l'en-tête compact et le repérage de la section affichée.
 */
export function initNavigation() {
    initNavigationMenu();
    const header = document.querySelector(".header");
    if (header) watchScroll(header);
    watchSections();
}
