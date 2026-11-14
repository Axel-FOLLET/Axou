#!/usr/bin/env python3

import unicodedata


ALPHABET = "abcdefghijklmnopqrstuvwxyz"

# Frequency of each letter (in %) in a French text, without accents.
# Source: Wikipedia (en), "Letter frequency", recomputed so that the 26 letters total 100 %.
FRENCH_FREQUENCIES = {"a": 7.78, "b": 0.92, "c": 3.32, "d": 3.74, "e": 14.98, "f": 1.09, "g": 0.88, "h": 0.95, "i": 7.67, "j": 0.83, "k": 0.08, "l": 5.56, "m": 3.02, "n": 7.22, "o": 5.9, "p": 2.57, "q": 1.39, "r": 6.82, "s": 8.09, "t": 7.38, "u": 6.43, "v": 1.87, "w": 0.05, "x": 0.43, "y": 0.72, "z": 0.33}


def remove_accents(text):
    # "Été" becomes "Ete": only the 26 base letters can be shifted.
    decomposed_text = unicodedata.normalize("NFD", text)
    return "".join(char for char in decomposed_text if unicodedata.category(char) != "Mn")


def shift_letter(char, shift):
    # Shifts a letter in the alphabet keeping its case; % 26 wraps around to "a" after "z".
    # Other characters (spaces, digits, punctuation) are returned unchanged.
    lowercase = char.lower()
    if lowercase not in ALPHABET:
        return char
    shifted_letter = ALPHABET[(ALPHABET.index(lowercase) + shift) % 26]
    return shifted_letter.upper() if char.isupper() else shifted_letter


def encrypt_caesar(text, key):
    return "".join(shift_letter(char, key) for char in remove_accents(text))


def decrypt_caesar(text, key):
    # Decrypting means shifting the other way.
    return encrypt_caesar(text, -key)


def compute_french_gap(text):
    # Compares the letter distribution of the text with the French one: the smaller, the more it looks like French.
    letters = [char for char in text.lower() if char in ALPHABET]
    if not letters:
        return 0
    return sum(abs(letters.count(letter) / len(letters) * 100 - FRENCH_FREQUENCIES[letter]) for letter in ALPHABET)


def find_caesar_key(encrypted_text):
    # Tries the 26 keys and keeps the one whose result looks the most like French.
    return min(range(26), key=lambda key: compute_french_gap(decrypt_caesar(encrypted_text, key)))
