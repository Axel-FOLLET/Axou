/*
 * Détecteur de langue : compare la répartition des lettres d'un texte à celle de dix langues.
 */
import { LANGUAGE_FREQUENCIES, frequencyGap, letterFrequencies, normalize } from "./letter-frequencies.js";


/*
 * En dessous de ce nombre de lettres, les fréquences varient trop d'une phrase à l'autre.
 */
export const RELIABLE_LENGTH = 80;


/*
 * Retourne le nombre de lettres analysées et les langues triées de la plus probable à la moins probable.
 * Liste vide si le texte ne contient aucune lettre.
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
