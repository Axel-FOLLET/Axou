#!/usr/bin/env python3

import unicodedata

from frequences import FREQUENCES_LANGUES


ALPHABET = "abcdefghijklmnopqrstuvwxyz"

#Lettres sans accent séparable : NFD ne les décompose pas, on les remplace à la main.
LETTRES_SPECIALES = str.maketrans({"ı": "i", "ł": "l", "ø": "o", "ß": "ss", "æ": "ae", "œ": "oe"})


def normaliser(texte):
    #Garde uniquement les lettres a à z, en minuscules : "Été !" devient "ete".
    #NFD sépare chaque lettre de son accent, qui n'est alors plus une lettre de l'alphabet.
    texte_decompose = unicodedata.normalize("NFD", texte.lower().translate(LETTRES_SPECIALES))
    return "".join(caractere for caractere in texte_decompose if caractere in ALPHABET)


def calculer_frequences(lettres):
    #Retourne le pourcentage de chaque lettre de l'alphabet dans le texte, y compris les absentes (0 %).
    return {lettre: lettres.count(lettre) / len(lettres) * 100 for lettre in ALPHABET}


def calculer_ecart(frequences_texte, frequences_langue):
    #Additionne les différences lettre par lettre : plus l'écart est petit, plus les profils se ressemblent.
    return sum(abs(frequences_texte[lettre] - frequences_langue[lettre]) for lettre in ALPHABET)


def classer_langues(texte):
    #Retourne les langues triées de la plus probable à la moins probable, avec leur écart.
    #Liste vide si le texte ne contient aucune lettre.
    lettres = normaliser(texte)
    if not lettres:
        return []
    frequences_texte = calculer_frequences(lettres)
    ecarts = [(langue, calculer_ecart(frequences_texte, frequences))
              for langue, frequences in FREQUENCES_LANGUES.items()]
    return sorted(ecarts, key=lambda langue_et_ecart: langue_et_ecart[1])


def main():
    texte = input("Donnez un texte (plusieurs phrases pour un résultat fiable) : ")
    classement = classer_langues(texte)
    if not classement:
        print("Le texte ne contient aucune lettre à analyser.")
        return
    print("La langue est probablement : " + classement[0][0])
    print("Classement (écart avec chaque langue, le plus petit gagne) :")
    for langue, ecart in classement[:3]:
        print("  " + langue + " : " + str(round(ecart, 1)))


if __name__ == "__main__":
    main()
