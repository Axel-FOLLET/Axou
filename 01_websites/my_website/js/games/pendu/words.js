/*
 * Choice and normalisation of the words; input validation comes before the cleaning.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
import { WORDS_FR, WORDS_EN } from "./word-list.js";
import { language } from "./translations.js";

/*
 * Returns a comparable version of the text: lower-case letters without accents.
 * NFD separates the accents from the letters; the regular expressions remove the marks and the remaining characters.
 */
export function cleanText(text) {
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z]/g, "");
}

/*
 * Checks that the input contains only letters, possibly accented.
 * The anchors ^ and $ require the whole string to match the pattern; + requires at least one letter.
 */
export function isValidInput(text) {
    return /^[A-Za-zÀ-ÖØ-öø-ÿ]+$/u.test(text);
}

/*
 * Chooses the French or English list and returns a random word.
 * Math.random produces a value from 0 inclusive to 1 exclusive; floor gives an integer index.
 */
export function pickWord() {
    const list = language === "en" ? WORDS_EN : WORDS_FR;

    return list[Math.floor(Math.random() * list.length)];
}
