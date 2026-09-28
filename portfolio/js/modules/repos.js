/*
 * Dépôts GitHub : ajoute à chaque carte la date de dernière mise à jour et les langages,
 * lus en direct sur l'API publique de GitHub. Sans réseau, les cartes gardent leur lien et leur texte.
 */


const API = "https://api.github.com/repos/";

/*
 * Au-delà de trois langages, les pourcentages deviennent trop petits pour être utiles.
 */
const MAX_LANGUAGES = 3;


/*
 * Lit une adresse de l'API et renvoie le JSON, ou null en cas d'échec.
 * sessionStorage garde la réponse le temps de la visite : changer de page ne relance pas la requête
 * (l'API limite le nombre d'appels par heure). try/catch : le stockage peut être bloqué par le navigateur.
 */
async function fetchJson(url) {
    try {
        const saved = sessionStorage.getItem(url);
        if (saved) return JSON.parse(saved);
    } catch {
        // Stockage indisponible : on interroge simplement l'API.
    }
    try {
        const response = await fetch(url, { headers: { "Accept": "application/vnd.github+json" } });
        if (!response.ok) return null;
        const data = await response.json();
        try {
            sessionStorage.setItem(url, JSON.stringify(data));
        } catch {
            // Stockage plein ou bloqué : la donnée reste utilisable pour cet affichage.
        }
        return data;
    } catch {
        return null;
    }
}


/*
 * Transforme { JavaScript: 5200, CSS: 3100, ... } (octets de code) en "JavaScript 55 %, CSS 33 %".
 * Object.entries donne des paires [nom, octets] ; sort les classe du plus au moins présent.
 */
function formatLanguages(languages, locale) {
    const entries = Object.entries(languages).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0);
    if (!total) return "";
    const percent = new Intl.NumberFormat(locale, { style: "percent" });
    return entries.slice(0, MAX_LANGUAGES)
        .map(([name, bytes]) => name + " " + percent.format(bytes / total))
        .join(", ");
}


/*
 * Récupère les deux informations d'un dépôt en parallèle (Promise.all), puis ajoute la ligne sous la carte.
 */
async function fillCard(card, labels) {
    const [repo, languages] = await Promise.all([
        fetchJson(API + card.dataset.repo),
        fetchJson(API + card.dataset.repo + "/languages")
    ]);
    if (!repo) return;
    const date = new Intl.DateTimeFormat(labels.locale, { dateStyle: "long" }).format(new Date(repo.pushed_at));
    const parts = [labels.updated + " " + date];
    const languageText = languages ? formatLanguages(languages, labels.locale) : "";
    /*
     * Le libellé contient déjà sa ponctuation : "Langages :" en français, "Languages:" en anglais.
     */
    if (languageText) parts.push(labels.languages + " " + languageText);
    const meta = document.createElement("p");
    meta.className = "repo-card__meta";
    meta.textContent = parts.join(" · ");
    card.append(meta);
}


/*
 * La liste n'existe que sur la page Projets : ailleurs, la fonction s'arrête.
 * Les libellés et la langue des dates viennent du HTML : un seul script pour FR et EN.
 */
export function initRepos() {
    const list = document.querySelector(".repo-list");
    if (!list) return;
    const labels = {
        locale: list.dataset.locale,
        updated: list.dataset.labelUpdated,
        languages: list.dataset.labelLanguages
    };
    for (const card of list.querySelectorAll("[data-repo]")) {
        fillCard(card, labels);
    }
}
