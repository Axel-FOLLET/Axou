#!/usr/bin/env python3

from cesar import chiffrer_cesar, dechiffrer_cesar, trouver_clef_cesar
from vigenere import chiffrer_vigenere, clef_valide, dechiffrer_vigenere


MENU = """
1. César : chiffrer
2. César : déchiffrer avec la clef
3. César : retrouver la clef (texte en français)
4. Vigenère : chiffrer
5. Vigenère : déchiffrer
q. Quitter"""


def demander_clef_cesar():
    #Redemande tant que la saisie n'est pas un nombre entier.
    while True:
        saisie = input("Clef (nombre entier) : ")
        try:
            return int(saisie)
        except ValueError:
            print("La clef de César doit être un nombre entier.")


def demander_clef_vigenere():
    #Redemande tant que la clef contient autre chose que des lettres.
    while True:
        clef = input("Clef (un mot, lettres sans accents) : ")
        if clef_valide(clef):
            return clef
        print("La clef de Vigenère doit être un mot sans accents, espaces ni chiffres.")


def main():
    while True:
        print(MENU)
        choix = input("Votre choix : ").strip().lower()
        if choix == "q":
            break
        if choix not in ("1", "2", "3", "4", "5"):
            print("Choix inconnu.")
            continue
        texte = input("Texte : ")
        if choix == "1":
            print(chiffrer_cesar(texte, demander_clef_cesar()))
        elif choix == "2":
            print(dechiffrer_cesar(texte, demander_clef_cesar()))
        elif choix == "3":
            clef = trouver_clef_cesar(texte)
            print("Clef trouvée : " + str(clef))
            print(dechiffrer_cesar(texte, clef))
        elif choix == "4":
            print(chiffrer_vigenere(texte, demander_clef_vigenere()))
        else:
            print(dechiffrer_vigenere(texte, demander_clef_vigenere()))


if __name__ == "__main__":
    main()
