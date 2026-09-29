/*
 * Filtre de la page Projets : des boutons au-dessus de la bande mettent en avant
 * les projets qui utilisent une technologie ; les autres s'estompent sans disparaître.
 * Les boutons sont construits à partir des étiquettes des cartes : rien à mettre à jour
 * à la main quand un projet est ajouté.
 */

const LABELS = {
    fr: { legend: "Filtrer", all: "Tous" },
    en: { legend: "Filter", all: "All" }
};

/*
 * Une technologie présente sur un seul projet ne filtrerait rien : elle n'a pas de bouton.
 */
const MIN_PROJECTS = 2;


/*
 * « JavaScript (démo) » compte comme « JavaScript ».
 */
function technologyName(tag) {
    return tag.textContent.replace(/\s*\((démo|demo)\)\s*$/i, "").trim();
}


/*
 * Associe chaque technologie aux cartes qui l'utilisent, de la plus répandue à la moins répandue.
 */
function collectTechnologies(cards) {
    const technologies = new Map();
    cards.forEach(card => {
        card.querySelectorAll(".tag").forEach(tag => {
            const name = technologyName(tag);
            if (!technologies.has(name)) technologies.set(name, new Set());
            technologies.get(name).add(card);
        });
    });
    return [...technologies]
        .filter(([, matches]) => matches.size >= MIN_PROJECTS)
        .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]));
}


function createButton(label, name) {
    const button = document.createElement("button");
    button.className = "showcase__filter";
    button.type = "button";
    button.textContent = label;
    button.dataset.technology = name;
    return button;
}


/*
 * onSelect reçoit la première carte correspondante : la bande la rend active et la fait défiler.
 * aria-pressed indique le bouton choisi aux lecteurs d'écran.
 */
export function initProjectFilter(showcase, cards, language, onSelect) {
    const technologies = collectTechnologies(cards);
    if (!technologies.length) return;
    const labels = LABELS[language] || LABELS.fr;
    const upcoming = [...showcase.querySelectorAll(".project-card--upcoming")];

    const bar = document.createElement("div");
    bar.className = "showcase__filters";
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", labels.legend);
    const legend = document.createElement("span");
    legend.className = "showcase__filters-label";
    legend.setAttribute("aria-hidden", "true");
    legend.textContent = labels.legend;
    const buttons = [createButton(labels.all, ""), ...technologies.map(([name]) => createButton(name, name))];
    bar.append(legend, ...buttons);
    showcase.prepend(bar);

    function apply(name) {
        const matches = new Set(technologies.find(([technology]) => technology === name)?.[1] || []);
        cards.forEach(card => card.classList.toggle("project-card--dimmed", Boolean(name) && !matches.has(card)));
        upcoming.forEach(card => card.classList.toggle("project-card--dimmed", Boolean(name)));
        buttons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.technology === name)));
        const first = cards.find(card => matches.has(card));
        if (first) onSelect(first);
    }

    buttons.forEach(button => button.addEventListener("click", () => apply(button.dataset.technology)));
    /*
     * Un clic sur une carte estompée montre que le visiteur s'intéresse à un autre projet :
     * le filtre repasse à « Tous ».
     */
    [...cards, ...upcoming].forEach(card => card.addEventListener("click", () => {
        if (card.classList.contains("project-card--dimmed")) apply("");
    }));
    apply("");
}
