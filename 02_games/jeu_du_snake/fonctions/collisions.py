#!/usr/bin/env python3

from fonctions.constantes import NOMBRE_CASES


def est_hors_grille(case):
    #Vérifie qu'une case dépasse de la grille (le serpent a touché un mur).
    colonne, ligne = case
    return not (0 <= colonne < NOMBRE_CASES and 0 <= ligne < NOMBRE_CASES)


def se_mord(serpent):
    #Vérifie que la tête est sur une case du corps.
    return serpent[0] in serpent[1:]


def a_mange_pomme(case_tete, pomme):
    #Vérifie que la tête est sur la pomme.
    return case_tete == pomme


def partie_perdue(serpent):
    #La partie est perdue si le serpent touche un mur ou son propre corps.
    return est_hors_grille(serpent[0]) or se_mord(serpent)
