/*
 * Rules and state changes of the game; the drawing is left to the other modules.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
import { MAX_PENALTIES } from "./constants.js";
import { state } from "./state.js";
import { bestScoreText } from "./storage.js";
import { t } from "./translations.js";
import { pickWord, isValidInput, cleanText } from "./words.js";

/*
 * Picks a new word and resets the values specific to this round.
 * Also keeps its original spelling for the end screen.
 */
export function prepareNewWord() {
    state.originalWord = pickWord();
    state.word = cleanText(state.originalWord);
    state.penalty = 0;
    state.attemptCount = 0;
    state.triedLetters = new Set();
    state.guessedLetters = new Set();
    state.input = "";
    state.message = "";
    state.messageEnd = 0;
    state.won = false;
    state.scoreText = "";
    state.lastGuess = "";
}

/*
 * Prepares a new word and selects the home screen.
 */
export function backToHome() {
    prepareNewWord();
    state.screen = "home";
}

/*
 * Starts with the word already prepared on the home screen and resets the attempts to zero.
 */
export function startGame() {
    state.penalty = 0;
    state.attemptCount = 0;
    state.triedLetters = new Set();
    state.guessedLetters = new Set();
    state.input = "";
    state.message = "";
    state.messageEnd = 0;
    state.won = false;
    state.scoreText = "";
    state.lastGuess = "";
    state.screen = "playing";
}

/*
 * Draws a new word and goes straight to the game screen.
 */
export function replay() {
    prepareNewWord();
    state.screen = "playing";
}

/*
 * Returns a string with the found letters in upper case and _ for the others.
 * The spread turns the word into an array; map transforms the letters and join gathers them.
 */
export function maskedWord() {
    return [...state.word]
        .map((letter) => state.guessedLetters.has(letter) ? letter.toUpperCase() : "_")
        .join(" ");
}

/*
 * Returns true if every distinct letter of the word has been guessed.
 * Set removes duplicates; every requires all the letters to pass the test.
 */
export function isWordFound() {
    return [...new Set(state.word)].every((letter) => state.guessedLetters.has(letter));
}

/*
 * Stores the text and its expiry date, three seconds after now.
 * The game screen checks this date on every draw. The text is also the latest spoken feedback (lastGuess).
 */
export function showTemporaryMessage(text) {
    state.message = text;
    state.messageEnd = performance.now() + 3000;
    state.lastGuess = text;
}

/*
 * Accepts a letter or a full word, after validation and normalisation.
 * Updates the attempts, penalties and the possible win or loss.
 */
export function handleGuess(rawGuess) {
    const trimmed = rawGuess.trim();

    if (!trimmed || !isValidInput(trimmed)) {
        showTemporaryMessage(t.invalid);
        return;
    }

    const guess = cleanText(trimmed);

    if (!guess) {
        showTemporaryMessage(t.invalid);
        return;
    }

    /*
     * The current behaviour also counts a repeated letter as an attempt, without adding a penalty.
     */
    state.attemptCount += 1;

    if (guess.length === 1) {
        if (state.triedLetters.has(guess)) {
            showTemporaryMessage(t.already);
            return;
        }

        state.triedLetters.add(guess);

        if (state.word.includes(guess)) {
            state.guessedLetters.add(guess);
            state.lastGuess = t.letterFound(guess.toUpperCase());
        } else {
            state.penalty += 1;
            state.lastGuess = t.letterMissed(guess.toUpperCase());
        }
    } else if (guess === state.word) {
        endGame(true);
        return;
    } else {
        state.penalty += 5;
        state.lastGuess = t.wordWrong(guess.toUpperCase());
    }

    if (isWordFound()) {
        endGame(true);
    } else if (state.penalty >= MAX_PENALTIES) {
        state.penalty = Math.min(state.penalty, MAX_PENALTIES);
        endGame(false);
    }
}

/*
 * won says whether the game is won.
 * Saves the result useful for the score then selects the end screen.
 */
export function endGame(won) {
    state.won = won;
    state.scoreText = bestScoreText(won);
    state.screen = "end";
    state.input = "";
    state.message = "";
}
