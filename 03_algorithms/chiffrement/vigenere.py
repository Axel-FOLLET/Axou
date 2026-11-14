#!/usr/bin/env python3

from caesar import ALPHABET, shift_letter, remove_accents


def is_valid_key(key):
    # A Vigenère key is a word: letters only, without accents.
    return key != "" and all(letter in ALPHABET for letter in key.lower())


def apply_vigenere(text, key, direction):
    # Each letter is shifted according to a letter of the key ("a" = 0, "b" = 1...), taken in turn.
    # The key only advances on letters: spaces and punctuation do not consume it.
    # direction is 1 to encrypt, -1 to decrypt.
    shifts = [ALPHABET.index(letter) for letter in key.lower()]
    result = ""
    position = 0
    for char in remove_accents(text):
        if char.lower() in ALPHABET:
            result += shift_letter(char, direction * shifts[position % len(shifts)])
            position += 1
        else:
            result += char
    return result


def encrypt_vigenere(text, key):
    return apply_vigenere(text, key, 1)


def decrypt_vigenere(text, key):
    return apply_vigenere(text, key, -1)
