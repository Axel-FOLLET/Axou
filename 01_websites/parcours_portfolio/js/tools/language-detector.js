/*
 * Language detector: compares the letter distribution of a text with that of ten languages.
 */
import { LANGUAGE_FREQUENCIES, frequencyGap, letterFrequencies, normalize } from "./letter-frequencies.js";


/*
 * Below this number of letters, frequencies vary too much from one sentence to the next.
 */
export const RELIABLE_LENGTH = 80;


/*
 * Returns the number of letters analysed and the languages sorted from the most to the least probable.
 * Empty list if the text contains no letter.
 */
export function rankLanguages(text) {
    const letters = normalize(text);
    if (!letters) return { letterCount: 0, ranking: [] };
    const textFrequencies = letterFrequencies(letters);
    const ranking = Object.entries(LANGUAGE_FREQUENCIES)
        .map(([code, frequencies]) => ({ code, gap: frequencyGap(textFrequencies, frequencies) }))
        .sort((first, second) => first.gap - second.gap);
    return { letterCount: letters.length, ranking };
}
