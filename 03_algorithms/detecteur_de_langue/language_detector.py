#!/usr/bin/env python3

import unicodedata

from frequencies import LANGUAGE_FREQUENCIES


ALPHABET = "abcdefghijklmnopqrstuvwxyz"

# Letters without a separable accent: NFD does not decompose them, so they are replaced by hand.
SPECIAL_LETTERS = str.maketrans({"ı": "i", "ł": "l", "ø": "o", "ß": "ss", "æ": "ae", "œ": "oe"})


def normalize(text):
    # Keeps only the letters a to z, in lowercase: "Été !" becomes "ete".
    # NFD splits each letter from its accent, which is then no longer a letter of the alphabet.
    decomposed_text = unicodedata.normalize("NFD", text.lower().translate(SPECIAL_LETTERS))
    return "".join(char for char in decomposed_text if char in ALPHABET)


def compute_frequencies(letters):
    # Returns the percentage of each letter of the alphabet in the text, absent ones included (0 %).
    return {letter: letters.count(letter) / len(letters) * 100 for letter in ALPHABET}


def compute_gap(text_frequencies, language_frequencies):
    # Adds up the letter-by-letter differences: the smaller the gap, the more alike the profiles.
    return sum(abs(text_frequencies[letter] - language_frequencies[letter]) for letter in ALPHABET)


def rank_languages(text):
    # Returns the languages sorted from the most to the least likely, with their gap.
    # Empty list if the text contains no letter.
    letters = normalize(text)
    if not letters:
        return []
    text_frequencies = compute_frequencies(letters)
    gaps = [(language, compute_gap(text_frequencies, frequencies))
            for language, frequencies in LANGUAGE_FREQUENCIES.items()]
    return sorted(gaps, key=lambda language_and_gap: language_and_gap[1])


def main():
    text = input("Donnez un texte (plusieurs phrases pour un résultat fiable) : ")
    ranking = rank_languages(text)
    if not ranking:
        print("Le texte ne contient aucune lettre à analyser.")
        return
    print("La langue est probablement : " + ranking[0][0])
    print("Classement (écart avec chaque langue, le plus petit gagne) :")
    for language, gap in ranking[:3]:
        print("  " + language + " : " + str(round(gap, 1)))


if __name__ == "__main__":
    main()
