/*
 * Shared state of the game: the other modules read and modify this same object.
 * const prevents replacing the object, but not modifying its properties.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
export const state = {
    /*
     * Spelling kept to display the word at the end.
     */
    originalWord: "",
    /*
     * Normalised version used for comparisons.
     */
    word: "",
    /*
     * Total penalties of the round.
     */
    penalty: 0,
    /*
     * Number of guesses counted.
     */
    attemptCount: 0,
    /*
     * Set of the letters tried: each letter appears at most once.
     */
    triedLetters: new Set(),
    /*
     * Set of the letters found in the word.
     */
    guessedLetters: new Set(),
    /*
     * Text being typed, before validation.
     */
    input: "",
    /*
     * Temporary feedback to the player.
     */
    message: "",
    /*
     * Timestamp in milliseconds at which this message expires.
     */
    messageEnd: 0,
    /*
     * Current screen: home, playing or end.
     */
    screen: "home",
    /*
     * Result of the last game end.
     */
    won: false,
    /*
     * Record message prepared for the end of the game.
     */
    scoreText: "",
    /*
     * Latest spoken feedback (live region of screens.js): result of the last letter or word played,
     * or the last temporary message (invalid entry, letter already tried).
     */
    lastGuess: "",
    /*
     * Clickable rectangles of the drawn keyboard.
     */
    keyZones: []
};
