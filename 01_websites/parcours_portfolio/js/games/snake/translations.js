/*
 * Translation data: the keys are the same in French and in English.
 * The functions inside the texts insert the variable values, such as the score.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
const params = new URLSearchParams(window.location.search);
export const language = params.get("lang") === "en" ? "en" : "fr";

const texts = {
    fr: {
        welcome: "BIENVENUE AU JEU DU SNAKE",
        rules: [
            "Guidez le serpent avec les flèches ou ZQSD.",
            "Mangez les pommes rouges pour grandir.",
            "Chaque pomme mangée vous rapporte 1 point.",
            "Le serpent accélère au fil des pommes.",
            "Toucher un mur ou votre propre corps = défaite.",
            "Le demi-tour est impossible."
        ],
        start: "Appuyez sur ENTRÉE pour commencer.",
        keyboardOnly: "Ce jeu se joue avec un clavier.",
        escapeMenu: "ÉCHAP pour le menu, ESPACE pour la pause.",
        apples: (score) => `x ${score}`,
        best: (score) => `Meilleur score : ${score}`,
        pause: "PAUSE",
        resume: "ESPACE ou clic pour reprendre.",
        victory: "VICTOIRE !",
        fullGrid: "La grille est entièrement remplie.",
        lost: "PERDU !",
        crashed: "Le serpent s'est écrasé.",
        applesEaten: (score) => `Pommes mangées : ${score}`,
        newBest: "NOUVEAU MEILLEUR SCORE !",
        replay: "Appuyez sur ENTRÉE pour rejouer."
    },
    en: {
        welcome: "WELCOME TO SNAKE",
        rules: [
            "Guide the snake with the arrow keys or WASD.",
            "Eat the red apples to grow.",
            "Each apple earns you 1 point.",
            "The snake gets faster as you collect apples.",
            "Hitting a wall or your own body = defeat.",
            "Turning directly backwards is impossible."
        ],
        start: "Press ENTER to start.",
        keyboardOnly: "This game needs a keyboard.",
        escapeMenu: "ESC for the menu, SPACE to pause.",
        apples: (score) => `x ${score}`,
        best: (score) => `Best score: ${score}`,
        pause: "PAUSE",
        resume: "SPACE or click to resume.",
        victory: "VICTORY!",
        fullGrid: "The grid is completely filled.",
        lost: "GAME OVER!",
        crashed: "The snake crashed.",
        applesEaten: (score) => `Apples eaten: ${score}`,
        newBest: "NEW BEST SCORE!",
        replay: "Press ENTER to play again."
    }
};

export const t = texts[language];

document.documentElement.lang = language;
document.title = language === "en" ? "Snake" : "Jeu du Snake";
/* Hidden page title (h1 read by screen readers): same text as the tab, in the language of the game */
document.querySelector("h1").textContent = document.title;
/* Skip link: same labels as the pages of the site */
document.querySelector(".skip-link").textContent = language === "en" ? "Skip to content" : "Aller au contenu";
