#!/usr/bin/env python3

import unicodedata


ALPHABET = "abcdefghijklmnopqrstuvwxyz"

#Fréquence de chaque lettre (en %) dans un texte français, sans accents.
#Source : Wikipédia (en), « Letter frequency », recalculée pour totaliser 100 % sur 26 lettres.
FREQUENCES_FRANCAIS = {"a": 7.78, "b": 0.92, "c": 3.32, "d": 3.74, "e": 14.98, "f": 1.09, "g": 0.88, "h": 0.95, "i": 7.67, "j": 0.83, "k": 0.08, "l": 5.56, "m": 3.02, "n": 7.22, "o": 5.9, "p": 2.57, "q": 1.39, "r": 6.82, "s": 8.09, "t": 7.38, "u": 6.43, "v": 1.87, "w": 0.05, "x": 0.43, "y": 0.72, "z": 0.33}


def enlever_accents(texte):
    #"Été" devient "Ete" : seules les 26 lettres de base peuvent être décalées.
    texte_decompose = unicodedata.normalize("NFD", texte)
    return "".join(caractere for caractere in texte_decompose if unicodedata.category(caractere) != "Mn")


def decaler_lettre(caractere, decalage):
    #Décale une lettre dans l'alphabet en gardant sa casse ; % 26 fait repartir de "a" après "z".
    #Les autres caractères (espaces, chiffres, ponctuation) sont rendus tels quels.
    minuscule = caractere.lower()
    if minuscule not in ALPHABET:
        return caractere
    lettre_decalee = ALPHABET[(ALPHABET.index(minuscule) + decalage) % 26]
    return lettre_decalee.upper() if caractere.isupper() else lettre_decalee


def chiffrer_cesar(texte, clef):
    return "".join(decaler_lettre(caractere, clef) for caractere in enlever_accents(texte))


def dechiffrer_cesar(texte, clef):
    #Déchiffrer revient à décaler dans l'autre sens.
    return chiffrer_cesar(texte, -clef)


def calculer_ecart_francais(texte):
    #Compare la répartition des lettres du texte à celle du français : plus c'est petit, plus il ressemble à du français.
    lettres = [caractere for caractere in texte.lower() if caractere in ALPHABET]
    if not lettres:
        return 0
    return sum(abs(lettres.count(lettre) / len(lettres) * 100 - FREQUENCES_FRANCAIS[lettre]) for lettre in ALPHABET)


def trouver_clef_cesar(texte_chiffre):
    #Essaie les 26 clefs et garde celle dont le résultat ressemble le plus à du français.
    return min(range(26), key=lambda clef: calculer_ecart_francais(dechiffrer_cesar(texte_chiffre, clef)))
