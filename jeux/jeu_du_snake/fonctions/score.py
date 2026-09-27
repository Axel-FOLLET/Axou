#!/usr/bin/env python3

import datetime

from fonctions.constantes import CHEMIN_SCORE


def lire_meilleur_score():
    #Lit le meilleur score dans le fichier, retourne 0 s'il n'existe pas ou s'il est mal formaté.
    try:
        with open(CHEMIN_SCORE) as fichier:
            return int(fichier.readline().split()[0])
    except (FileNotFoundError, ValueError, IndexError):
        return 0


def enregistrer_meilleur_score(score):
    #Enregistre le score et la date du jour (w écrase le fichier existant).
    date_aujourdhui = datetime.date.today()
    with open(CHEMIN_SCORE, "w") as fichier:
        fichier.write(str(score) + " " + str(date_aujourdhui))


def mettre_a_jour_meilleur_score(score):
    #Enregistre le score s'il bat le record, retourne True si c'est un nouveau record.
    if score > lire_meilleur_score():
        enregistrer_meilleur_score(score)
        return True
    return False
