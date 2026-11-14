/*
 * Translation data: the keys stay the same in French and in English.
 * The functions present in the texts insert the variable values, such as the score.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
const params = new URLSearchParams(window.location.search);
export const language = params.get("lang") === "en" ? "en" : "fr";

const texts = {
    fr: {
        title: "BIENVENUE AU JEU DU PENDU",
        subtitle: "Trouvez le mot secret pour survivre !",
        penaltiesAllowed: "Vous avez droit à 12 pénalités.",
        badLetter: "Une mauvaise lettre coûte 1 pénalité.",
        badWord: "Un mot complet incorrect coûte 5 pénalités.",
        wordLength: (n) => `Le mot contient ${n} lettre(s).`,
        start: "Appuyez sur ENTRÉE pour commencer.",
        startTouch: "Touchez l'écran pour commencer.",
        escapeWelcome: "ÉCHAP pour recommencer.",
        chances: (n) => `Chances restantes : ${n}`,
        attempts: (n) => `Tentatives : ${n}`,
        word: (value) => `Mot : ${value}`,
        proposal: "Votre proposition :",
        invalid: "ENTRÉE INVALIDE. ENTREZ UNE LETTRE OU UN MOT.",
        already: "CETTE LETTRE A DÉJÀ ÉTÉ TENTÉE.",
        victory: "VOUS REMPORTEZ LA PARTIE !",
        survive: "Vous obtenez le droit de survivre.",
        defeat: "DÉFAITE",
        badLuck: "Le sort vous a été défavorable.",
        hanged: "Vous allez être pendu.",
        wordWas: (value) => `Le mot était : ${value}`,
        replay: "Appuyez sur ENTRÉE ou cliquez pour REJOUER.",
        replayTouch: "Touchez l'écran pour REJOUER.",
        escapeEnd: "ÉCHAP pour revenir à l'accueil.",
        newBest: "FÉLICITATIONS ! NOUVEAU MEILLEUR SCORE !",
        noBest: "Aucun meilleur score enregistré.",
        best: (score, date) => `Meilleur score : ${score} tentative(s) le ${date}.`,
        /* Spoken only (live region read by screen readers, screens.js) */
        hidden: "tiret",
        typeGuess: "Tapez une lettre ou un mot, puis ENTRÉE.",
        letterFound: (letter) => `Lettre ${letter} : présente.`,
        letterMissed: (letter) => `Lettre ${letter} : absente.`,
        wordWrong: (word) => `Mot ${word} : incorrect.`
    },
    en: {
        title: "WELCOME TO HANGMAN",
        subtitle: "Find the secret word to survive!",
        penaltiesAllowed: "You are allowed 12 penalties.",
        badLetter: "A wrong letter costs 1 penalty.",
        badWord: "A wrong full word costs 5 penalties.",
        wordLength: (n) => `The word contains ${n} letter(s).`,
        start: "Press ENTER to start.",
        startTouch: "Tap the screen to start.",
        escapeWelcome: "ESC to restart.",
        chances: (n) => `Chances left: ${n}`,
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
        replayTouch: "Tap the screen to PLAY AGAIN.",
        escapeEnd: "ESC to return to the home screen.",
        newBest: "CONGRATULATIONS! NEW BEST SCORE!",
        noBest: "No best score recorded yet.",
        best: (score, date) => `Best score: ${score} attempt(s) on ${date}.`,
        /* Spoken only (live region read by screen readers, screens.js) */
        hidden: "blank",
        typeGuess: "Type a letter or a word, then ENTER.",
        letterFound: (letter) => `Letter ${letter}: in the word.`,
        letterMissed: (letter) => `Letter ${letter}: not in the word.`,
        wordWrong: (word) => `Word ${word}: wrong.`
    }
};

export const t = texts[language];

document.documentElement.lang = language;
document.title = language === "en" ? "Hangman" : "Jeu du Pendu";
/* Hidden title of the page (h1 read by screen readers): same text as the tab, in the language of the game */
document.querySelector("h1").textContent = document.title;
/* Skip link: same labels as the pages of the site */
document.querySelector(".skip-link").textContent = language === "en" ? "Skip to content" : "Aller au contenu";
