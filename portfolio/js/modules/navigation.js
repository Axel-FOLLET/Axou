import { initNavigationMenu } from "./navigation-menu.js";

/*
 * Active le menu mobile, puis redirige les anciens liens de la version à une seule page
 * (index.html#projects) vers les pages qui les remplacent (pages/projects.html).
 */
export function initNavigation() {
    initNavigationMenu();
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
