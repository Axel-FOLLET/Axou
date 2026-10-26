/*
 * Filtre de la section Projets : une ligne de boutons par domaine (Web, Jeux…).
 * Les cartes d'un autre domaine sortent de la roue ; les technologies restent écrites sur les cartes.
 * Les domaines viennent de l'attribut data-domain des cartes : un domaine absent des cartes n'a pas de bouton.
 */

const LABELS = {
    fr: {
        domains: "Domaine", all: "Tous",
        count: (shown, total) => shown === total ? `${total} projets` : `${shown} projet${shown > 1 ? "s" : ""} sur ${total}`
    },
    en: {
        domains: "Field", all: "All",
        count: (shown, total) => shown === total ? `${total} projects` : `${shown} project${shown > 1 ? "s" : ""} out of ${total}`
    }
};

/*
 * Ordre et nom affiché des domaines. Les projets en cours gardent leur badge « Prochainement » sans bouton à part.
 */
const DOMAINS = {
    fr: { web: "Web", games: "Jeux", algorithms: "Algorithmique" },
    en: { web: "Web", games: "Games", algorithms: "Algorithms" }
};


function cardDomains(card) {
    return (card.dataset.domain || "").split(/\s+/).filter(Boolean);
}


/*
 * onChange reçoit les cartes qui restent : la roue se reconstruit avec elles.
 * aria-pressed indique le domaine choisi aux lecteurs d'écran ; le nombre de projets affichés leur est annoncé (aria-live).
 */
export function initProjectFilter(showcase, cards, language, onChange) {
    const labels = LABELS[language] || LABELS.fr;
    const names = DOMAINS[language] || DOMAINS.fr;
    const present = new Set(cards.flatMap(cardDomains));

    const buttons = ["", ...Object.keys(names).filter(domain => present.has(domain))].map(domain => {
        const button = document.createElement("button");
        button.className = "showcase__filter";
        button.type = "button";
        button.dataset.value = domain;
        button.textContent = domain ? names[domain] : labels.all;
        return button;
    });

    const status = document.createElement("span");
    status.className = "showcase__filters-status";
    status.setAttribute("aria-live", "polite");

    const bar = document.createElement("div");
    bar.className = "showcase__filters";
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", labels.domains);
    bar.append(...buttons, status);
    showcase.prepend(bar);

    function apply(domain) {
        const visible = cards.filter(card => !domain || cardDomains(card).includes(domain));
        cards.forEach(card => card.classList.toggle("project-card--filtered", !visible.includes(card)));
        buttons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.value === domain)));
        status.textContent = labels.count(visible.length, cards.length);
        onChange(visible);
    }

    buttons.forEach(button => button.addEventListener("click", () => apply(button.dataset.value)));
    apply("");
}
