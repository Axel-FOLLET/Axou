#!/usr/bin/env python3

import random

from fonctions.constantes import NOMBRE_CASES


def lister_cases_libres(serpent):
    #Liste toutes les cases de la grille qui ne sont pas occupées par le serpent.
    return [
        (colonne, ligne)
        for colonne in range(NOMBRE_CASES)
        for ligne in range(NOMBRE_CASES)
        if (colonne, ligne) not in serpent
    ]


def placer_pomme(serpent):
    #Choisit une case libre au hasard, retourne None si la grille est pleine.
    cases_libres = lister_cases_libres(serpent)
    if len(cases_libres) == 0:
        return None
    return random.choice(cases_libres)
