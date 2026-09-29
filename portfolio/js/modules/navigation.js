import { initNavigationMenu } from "./navigation-menu.js";

/*
 * Seuils de l'en-tête compact, en pixels défilés. L'écart entre les deux évite un clignotement :
 * en rétrécissant, l'en-tête fait remonter la page d'une vingtaine de pixels.
 */
const COMPACT_FROM = 80;
const EXPAND_UNDER = 20;


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
 * Active le menu mobile et l'en-tête compact, puis redirige les anciens liens de la version
 * à une seule page (index.html#projects) vers les pages qui les remplacent (pages/projects.html).
 */
export function initNavigation() {
    initNavigationMenu();
    const header = document.querySelector(".header");
    if (header) watchScroll(header);
    const page = location.pathname.split("/").pop() || "index.html";
    if (!["index.html", "index-en.html"].includes(page)) return;
    const section = location.hash.slice(1);
    if (["projects", "skills", "contact"].includes(section)) {
        const suffix = document.documentElement.lang === "en" ? "-en" : "";
        /*
         * replace ne garde pas l'ancienne adresse dans l'historique : le bouton Retour reste utile.
         */
        location.replace("pages/" + section + suffix + ".html");
    }
}
