#!/usr/bin/env python3

from cesar import ALPHABET, decaler_lettre, enlever_accents


def clef_valide(clef):
    #Une clef de Vigenère est un mot : uniquement des lettres, sans accents.
    return clef != "" and all(lettre in ALPHABET for lettre in clef.lower())


def appliquer_vigenere(texte, clef, sens):
    #Chaque lettre est décalée selon une lettre de la clef ("a" = 0, "b" = 1...), prise tour à tour.
    #La clef n'avance que sur les lettres : espaces et ponctuation ne la consomment pas.
    #sens vaut 1 pour chiffrer, -1 pour déchiffrer.
    decalages = [ALPHABET.index(lettre) for lettre in clef.lower()]
    resultat = ""
    position = 0
    for caractere in enlever_accents(texte):
        if caractere.lower() in ALPHABET:
            resultat += decaler_lettre(caractere, sens * decalages[position % len(decalages)])
            position += 1
        else:
            resultat += caractere
    return resultat


def chiffrer_vigenere(texte, clef):
    return appliquer_vigenere(texte, clef, 1)


def dechiffrer_vigenere(texte, clef):
    return appliquer_vigenere(texte, clef, -1)
