/*
 * Interactions de la page : ce module expose ses fonctions d'initialisation.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
/*
 * Écoute le changement du sélecteur et navigue vers la page choisie.
 * La liste autorisée correspond aux deux pages locales du CV.
 */
export function initLanguage() {
    const select = document.querySelector(".language-switch__select");
    /*
     * ?. évite d'appeler la méthode si le sélecteur est absent de la page.
     */
    select?.addEventListener("change", () => {
        if (["index.html", "index-en.html"].includes(select.value)) {
            window.location.href = select.value;
        }
    });
}
