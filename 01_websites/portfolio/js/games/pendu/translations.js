/*
 * Données de traduction : les clés restent les mêmes en français et en anglais.
 * Les fonctions présentes dans les textes insèrent les valeurs variables, comme le score.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
const params = new URLSearchParams(window.location.search);
export const language = params.get("lang") === "en" ? "en" : "fr";

const textes = {
    fr: {
        title: "BIENVENUE AU JEU DU PENDU",
        subtitle: "Trouvez le mot secret pour survivre !",
        penaltiesAllowed: "Vous avez droit à 12 pénalités.",
        badLetter: "Une mauvaise lettre coûte 1 pénalité.",
        badWord: "Un mot complet incorrect coûte 5 pénalités.",
        wordLength: (n) => `Le mot contient ${n} lettre(s).`,
        start: "Appuyez sur ENTRÉE pour commencer.",
        escapeWelcome: "ÉCHAP pour recommencer.",
        penalties: (n) => `Pénalités : ${n}/12`,
        chances: (n) => `Chances restantes : ${n}`,
        attempts: (n) => `Tentatives : ${n}`,
        word: (value) => `Mot : ${value}`,
        proposal: "Votre proposition :",
        invalid: "ENTRÉE INVALIDE. ENTREZ UNE LETTRE OU UN MOT.",
        already: "CETTE LETTRE A DÉJÀ ÉTÉ TENTÉE.",
        victory: "VOUS REMPORTEZ LA PARTIE !",
        survive: "Vous obtenez le droit de survivre.",
        defeat: "DÉFAITE",
        badLuck: "Le sort vous a été défavorable.",
        hanged: "Vous allez être pendu.",
        wordWas: (value) => `Le mot était : ${value}`,
        replay: "Appuyez sur ENTRÉE ou cliquez pour REJOUER.",
        escapeEnd: "ÉCHAP pour revenir à l'accueil.",
        newBest: "FÉLICITATIONS ! NOUVEAU MEILLEUR SCORE !",
        noBest: "Aucun meilleur score enregistré.",
        best: (score, date) => `Meilleur score : ${score} tentative(s) le ${date}.`
    },
    en: {
        title: "WELCOME TO HANGMAN",
        subtitle: "Find the secret word to survive!",
        penaltiesAllowed: "You are allowed 12 penalties.",
        badLetter: "A wrong letter costs 1 penalty.",
        badWord: "A wrong full word costs 5 penalties.",
        wordLength: (n) => `The word contains ${n} letter(s).`,
        start: "Press ENTER to start.",
        escapeWelcome: "ESC to restart.",
        penalties: (n) => `Penalties: ${n}/12`,
        chances: (n) => `Chances remaining: ${n}`,
        attempts: (n) => `Attempts: ${n}`,
        word: (value) => `Word: ${value}`,
        proposal: "Your guess:",
        invalid: "INVALID ENTRY. ENTER A LETTER OR A WORD.",
        already: "THIS LETTER HAS ALREADY BEEN TRIED.",
        victory: "YOU WIN!",
        survive: "You earn the right to survive.",
        defeat: "DEFEAT",
        badLuck: "Luck was not on your side.",
        hanged: "You are going to be hanged.",
        wordWas: (value) => `The word was: ${value}`,
        replay: "Press ENTER or click to PLAY AGAIN.",
        escapeEnd: "ESC to return to the home screen.",
        newBest: "CONGRATULATIONS! NEW BEST SCORE!",
        noBest: "No best score recorded yet.",
        best: (score, date) => `Best score: ${score} attempt(s) on ${date}.`
    }
};

export const t = textes[language];

document.documentElement.lang = language;
document.title = language === "en" ? "Hangman" : "Jeu du Pendu";
