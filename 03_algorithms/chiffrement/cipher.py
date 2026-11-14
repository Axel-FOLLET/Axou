#!/usr/bin/env python3

from caesar import encrypt_caesar, decrypt_caesar, find_caesar_key
from vigenere import encrypt_vigenere, is_valid_key, decrypt_vigenere


MENU = """
1. César : chiffrer
2. César : déchiffrer avec la clef
3. César : retrouver la clef (texte en français)
4. Vigenère : chiffrer
5. Vigenère : déchiffrer
q. Quitter"""


def ask_caesar_key():
    # Asks again until the input is an integer.
    while True:
        user_input = input("Clef (nombre entier) : ")
        try:
            return int(user_input)
        except ValueError:
            print("La clef de César doit être un nombre entier.")


def ask_vigenere_key():
    # Asks again while the key contains anything other than letters.
    while True:
        key = input("Clef (un mot, lettres sans accents) : ")
        if is_valid_key(key):
            return key
        print("La clef de Vigenère doit être un mot sans accents, espaces ni chiffres.")


def main():
    while True:
        print(MENU)
        choice = input("Votre choix : ").strip().lower()
        if choice == "q":
            break
        if choice not in ("1", "2", "3", "4", "5"):
            print("Choix inconnu.")
            continue
        text = input("Texte : ")
        if choice == "1":
            print(encrypt_caesar(text, ask_caesar_key()))
        elif choice == "2":
            print(decrypt_caesar(text, ask_caesar_key()))
        elif choice == "3":
            key = find_caesar_key(text)
            print("Clef trouvée : " + str(key))
            print(decrypt_caesar(text, key))
        elif choice == "4":
            print(encrypt_vigenere(text, ask_vigenere_key()))
        else:
            print(decrypt_vigenere(text, ask_vigenere_key()))


if __name__ == "__main__":
    main()
