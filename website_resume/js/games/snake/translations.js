/*
 * Données de traduction : les clés restent les mêmes en français et en anglais.
 * Les fonctions présentes dans les textes insèrent les valeurs variables, comme le score.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
const params = new URLSearchParams(window.location.search);
export const language = params.get("lang") === "en" ? "en" : "fr";

const textes = {
    fr: {
        welcome: "BIENVENUE AU JEU DU SNAKE",
        rules: [
            "Guidez le serpent avec les flèches directionnelles.",
            "Mangez les pommes rouges pour grandir.",
            "Chaque pomme mangée vous rapporte 1 point.",
            "Le serpent accélère au fil des pommes.",
            "Toucher un mur ou votre propre corps = défaite.",
            "Le demi-tour est impossible."
        ],
        start: "Appuyez sur ENTRÉE pour commencer.",
        escapeMenu: "ÉCHAP pour le menu.",
        apples: (score) => `x ${score}`,
        best: (score) => `Meilleur score : ${score}`,
        pause: "PAUSE",
        victory: "VICTOIRE !",
        fullGrid: "La grille est entièrement remplie.",
        lost: "PERDU !",
        crashed: "Le serpent s'est écrasé.",
        applesEaten: (score) => `Pommes mangées : ${score}`,
        newBest: "NOUVEAU MEILLEUR SCORE !",
        replay: "Appuyez sur ENTRÉE pour rejouer.",
        controls: ""
    },
    en: {
        welcome: "WELCOME TO SNAKE",
        rules: [
            "Guide the snake with the arrow keys.",
            "Eat the red apples to grow.",
            "Each apple earns you 1 point.",
            "The snake gets faster as you collect apples.",
            "Hitting a wall or your own body = defeat.",
            "Turning directly backwards is impossible."
        ],
        start: "Press ENTER to start.",
        escapeMenu: "ESC for the menu.",
        apples: (score) => `x ${score}`,
        best: (score) => `Best score: ${score}`,
        pause: "PAUSE",
        victory: "VICTORY!",
        fullGrid: "The grid is completely filled.",
        lost: "GAME OVER!",
        crashed: "The snake crashed.",
        applesEaten: (score) => `Apples eaten: ${score}`,
        newBest: "NEW BEST SCORE!",
        replay: "Press ENTER to play again.",
        controls: ""
    }
};

export const t = textes[language];

document.documentElement.lang = language;
document.title = language === "en" ? "Snake" : "Jeu du Snake";
