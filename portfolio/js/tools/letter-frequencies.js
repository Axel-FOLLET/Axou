/*
 * Fréquences des lettres : outils communs au détecteur de langue et au cassage de César.
 * Même méthode que les programmes Python de la piscine, portée en JavaScript pour la démo.
 */


export const ALPHABET = "abcdefghijklmnopqrstuvwxyz";

/*
 * Fréquence de chaque lettre (en %) dans un texte courant de chaque langue.
 * Source : Wikipédia (en), « Letter frequency ». Les accents étant retirés avant l'analyse,
 * chaque table est recalculée pour que ses 26 lettres totalisent 100 %.
 */
export const LANGUAGE_FREQUENCIES = {
    fr: { a: 7.78, b: 0.92, c: 3.32, d: 3.74, e: 14.98, f: 1.09, g: 0.88, h: 0.95, i: 7.67, j: 0.83, k: 0.08, l: 5.56, m: 3.02, n: 7.22, o: 5.9, p: 2.57, q: 1.39, r: 6.82, s: 8.09, t: 7.38, u: 6.43, v: 1.87, w: 0.05, x: 0.43, y: 0.72, z: 0.33 },
    en: { a: 8.17, b: 1.49, c: 2.78, d: 4.25, e: 12.7, f: 2.23, g: 2.02, h: 6.09, i: 6.97, j: 0.15, k: 0.77, l: 4.03, m: 2.41, n: 6.75, o: 7.51, p: 1.93, q: 0.1, r: 5.99, s: 6.33, t: 9.06, u: 2.76, v: 0.98, w: 2.36, x: 0.15, y: 1.97, z: 0.07 },
    es: { a: 11.35, b: 2.18, c: 3.96, d: 4.93, e: 13.49, f: 0.68, g: 1.74, h: 1.94, i: 6.15, j: 0.49, k: 0.03, l: 4.89, m: 3.11, n: 6.61, o: 8.55, p: 2.47, q: 0.86, r: 6.77, s: 7.85, t: 4.56, u: 3.87, v: 1.12, w: 0.03, x: 0.51, y: 1.41, z: 0.46 },
    pt: { a: 15.07, b: 1.07, c: 4.0, d: 5.14, e: 13.49, f: 1.05, g: 1.34, h: 1.32, i: 6.37, j: 0.39, k: 0.02, l: 2.86, m: 4.88, n: 4.58, o: 10.02, p: 2.6, q: 1.24, r: 6.72, s: 7.01, t: 4.46, u: 3.75, v: 1.62, w: 0.04, x: 0.47, y: 0.01, z: 0.48 },
    it: { a: 11.96, b: 0.94, c: 4.58, d: 3.8, e: 12.01, f: 1.17, g: 1.67, h: 0.14, i: 10.33, j: 0.01, k: 0.01, l: 6.63, m: 2.56, n: 7.01, o: 10.01, p: 3.11, q: 0.51, r: 6.48, s: 5.07, t: 5.73, u: 2.86, v: 2.14, w: 0.03, x: 0.01, y: 0.02, z: 1.2 },
    de: { a: 6.67, b: 1.93, c: 2.8, d: 5.2, e: 16.79, f: 1.7, g: 3.08, h: 4.69, i: 6.71, j: 0.27, k: 1.45, l: 3.52, m: 2.59, n: 10.01, o: 2.66, p: 0.69, q: 0.02, r: 7.17, s: 7.44, t: 6.3, u: 4.26, v: 0.87, w: 1.97, x: 0.03, y: 0.04, z: 1.16 },
    nl: { a: 7.48, b: 1.58, c: 1.24, d: 5.92, e: 18.88, f: 0.81, g: 3.39, h: 2.38, i: 6.49, j: 1.46, k: 2.25, l: 3.56, m: 2.21, n: 10.01, o: 6.05, p: 1.57, q: 0.01, r: 6.4, s: 3.72, t: 6.78, u: 1.99, v: 2.85, w: 1.52, x: 0.04, y: 0.03, z: 1.39 },
    sv: { a: 9.82, b: 1.61, c: 1.56, d: 4.92, e: 10.62, f: 2.12, g: 3.0, h: 2.19, i: 6.09, j: 0.64, k: 3.29, l: 5.52, m: 3.63, n: 8.94, o: 4.69, p: 1.92, q: 0.02, r: 8.82, s: 6.9, t: 8.05, u: 2.01, v: 2.53, w: 0.15, x: 0.17, y: 0.74, z: 0.07 },
    pl: { a: 9.64, b: 1.59, c: 4.29, d: 3.54, e: 8.52, f: 0.34, g: 1.48, h: 1.15, i: 8.91, j: 2.52, k: 3.67, l: 2.3, m: 3.13, n: 6.02, o: 8.16, p: 3.33, q: 0.0, r: 4.91, s: 4.58, t: 4.26, u: 2.52, v: 0.04, w: 4.89, x: 0.02, y: 4.15, z: 6.04 },
    tr: { a: 13.52, b: 3.22, c: 1.09, d: 5.34, e: 10.11, f: 0.52, g: 1.42, h: 1.37, i: 9.75, j: 0.04, k: 5.31, l: 6.71, m: 4.25, n: 8.49, o: 2.81, p: 1.0, q: 0.0, r: 7.62, s: 3.42, t: 3.76, u: 3.67, v: 1.09, w: 0.0, x: 0.0, y: 3.78, z: 1.7 }
};

/*
 * Lettres sans accent séparable : NFD ne les décompose pas, on les remplace à la main.
 */
const SPECIAL_LETTERS = { "ı": "i", "ł": "l", "ø": "o", "ß": "ss", "æ": "ae", "œ": "oe" };


/*
 * Retire les accents : NFD sépare chaque lettre de son accent (é → e + ´), puis l'accent est supprimé.
 * \p{M} désigne ces signes diacritiques ; le drapeau u active les classes Unicode.
 */
export function removeAccents(text) {
    return text.normalize("NFD").replace(/\p{M}/gu, "");
}


/*
 * Garde uniquement les lettres a à z, en minuscules : "Été !" devient "ete".
 */
export function normalize(text) {
    const lowered = [...text.toLowerCase()].map(char => SPECIAL_LETTERS[char] ?? char).join("");
    return [...removeAccents(lowered)].filter(char => ALPHABET.includes(char)).join("");
}


/*
 * Pourcentage de chaque lettre de l'alphabet dans un texte déjà normalisé, absentes comprises (0 %).
 */
export function letterFrequencies(letters) {
    const counts = Object.fromEntries([...ALPHABET].map(letter => [letter, 0]));
    for (const letter of letters) counts[letter]++;
    for (const letter of ALPHABET) counts[letter] = counts[letter] / letters.length * 100;
    return counts;
}


/*
 * Somme des différences lettre par lettre : plus l'écart est petit, plus les profils se ressemblent.
 */
export function frequencyGap(textFrequencies, languageFrequencies) {
    let gap = 0;
    for (const letter of ALPHABET) gap += Math.abs(textFrequencies[letter] - languageFrequencies[letter]);
    return gap;
}
