/*
 * Chiffres de César et de Vigenère : chaque lettre est décalée dans l'alphabet.
 * Les accents sont retirés, la casse est conservée, les autres caractères restent tels quels.
 */
import { ALPHABET, LANGUAGE_FREQUENCIES, frequencyGap, letterFrequencies, normalize, removeAccents } from "./letter-frequencies.js";


/*
 * Décale une lettre en gardant sa casse. Le double modulo ramène aussi les décalages négatifs
 * entre 0 et 25 : en JavaScript, -1 % 26 vaut -1 (en Python, il vaudrait 25).
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
 * Une clef de Vigenère est un mot : uniquement des lettres, sans accents.
 */
export function isValidVigenereKey(key) {
    return /^[a-z]+$/i.test(key);
}


/*
 * Chaque lettre est décalée selon une lettre de la clef ("a" = 0, "b" = 1...), prise tour à tour.
 * La clef n'avance que sur les lettres : espaces et ponctuation ne la consomment pas.
 * direction vaut 1 pour chiffrer, -1 pour déchiffrer.
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
 * Essaie les 26 clefs et garde celle dont le résultat ressemble le plus à la langue attendue (français par défaut).
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
