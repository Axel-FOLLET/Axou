/*
 * Filter of the Projects section: one row of buttons per field (Web, Games...).
 * Cards of another field leave the wheel; the technologies stay written on the cards.
 * The fields come from the data-domain attribute of the cards: a field absent from the cards has no button.
 */

const LABELS = {
    fr: {
        domains: "Domaine", all: "Tous",
        count: (shown, total) => shown === total ? "Tous les projets affichés" : `${shown} projet${shown > 1 ? "s" : ""} affiché${shown > 1 ? "s" : ""}`
    },
    en: {
        domains: "Field", all: "All",
        count: (shown, total) => shown === total ? "All projects shown" : `${shown} project${shown > 1 ? "s" : ""} shown`
    }
};

/*
 * Order and displayed name of the fields. Projects in progress keep their "Coming soon" badge without a button of their own.
 */
const DOMAINS = {
    fr: { web: "Web", games: "Jeux", algorithms: "Algorithmique" },
    en: { web: "Web", games: "Games", algorithms: "Algorithms" }
};


function cardDomains(card) {
    return (card.dataset.domain || "").split(/\s+/).filter(Boolean);
}


/*
 * onChange receives the cards that remain: the wheel is rebuilt with them.
 * aria-pressed tells screen readers which field is chosen; the number of projects shown is announced to them (aria-live), with no visible counter or total.
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
    status.className = "showcase__filters-status visually-hidden";
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
