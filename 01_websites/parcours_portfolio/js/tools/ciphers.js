/*
 * Caesar and Vigenere ciphers: each letter is shifted in the alphabet.
 * Accents are removed, case is kept, other characters stay as they are.
 */
import { ALPHABET, LANGUAGE_FREQUENCIES, frequencyGap, letterFrequencies, normalize, removeAccents } from "./letter-frequencies.js";


/*
 * Shifts a letter while keeping its case. The double modulo also brings negative shifts
 * back between 0 and 25: in JavaScript, -1 % 26 is -1 (in Python, it would be 25).
 */
function shiftLetter(char, shift) {
    const index = ALPHABET.indexOf(char.toLowerCase());
    if (index === -1) return char;
    const shifted = ALPHABET[((index + shift) % 26 + 26) % 26];
    return char === char.toUpperCase() ? shifted.toUpperCase() : shifted;
}


export function caesar(text, key, direction) {
    return [...removeAccents(text)].map(char => shiftLetter(char, direction * key)).join("");
}


/*
 * A Vigenere key is a word: letters only, no accents.
 */
export function isValidVigenereKey(key) {
    return /^[a-z]+$/i.test(key);
}


/*
 * Each letter is shifted according to a letter of the key ("a" = 0, "b" = 1...), taken in turn.
 * The key only advances on letters: spaces and punctuation do not consume it.
 * direction is 1 to encrypt, -1 to decrypt.
 */
export function vigenere(text, key, direction) {
    const shifts = [...key.toLowerCase()].map(letter => ALPHABET.indexOf(letter));
    let position = 0;
    return [...removeAccents(text)].map(char => {
        if (!ALPHABET.includes(char.toLowerCase())) return char;
        const shift = shifts[position % shifts.length];
        position++;
        return shiftLetter(char, direction * shift);
    }).join("");
}


/*
 * Tries the 26 keys and keeps the one whose result looks most like the expected language (French by default).
 */
export function findCaesarKey(encryptedText, language = "fr") {
    let bestKey = 0;
    let bestGap = Infinity;
    for (let key = 0; key < 26; key++) {
        const letters = normalize(caesar(encryptedText, key, -1));
        if (!letters) return 0;
        const gap = frequencyGap(letterFrequencies(letters), LANGUAGE_FREQUENCIES[language]);
        if (gap < bestGap) {
            bestGap = gap;
            bestKey = key;
        }
    }
    return bestKey;
}
