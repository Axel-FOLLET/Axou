/*
 * Choix de la langue : le menu déroulant mène à la même page dans l'autre langue.
 * Seules les pages connues du site sont acceptées comme destination.
 */
export function initLanguage() {
    const pages = ["index", "projects", "skills", "contact"];
    /*
     * flatMap crée les deux noms de chaque page : "projects.html" et "projects-en.html".
     */
    const allowed = pages.flatMap(page => [page + ".html", page + "-en.html"]);
    document.querySelector(".language-select")?.addEventListener("change", event => {
        if (allowed.includes(event.target.value)) location.href = event.target.value;
    });
}
