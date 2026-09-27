#!/usr/bin/env python3

from fonctions.constantes import DROITE, POMMES_PAR_PALIER, VITESSE_DEPART, VITESSE_MAX
from fonctions.collisions import a_mange_pomme, partie_perdue
from fonctions.pomme import placer_pomme
from fonctions.serpent import avancer_serpent, calculer_nouvelle_tete, creer_serpent


def nouvelle_partie():
    #Prépare une partie : serpent, direction de départ, première pomme et score à zéro.
    serpent = creer_serpent()
    return serpent, DROITE, placer_pomme(serpent), 0


def calculer_vitesse(score):
    #Le serpent accélère toutes les quelques pommes, jusqu'à une vitesse maximale.
    return min(VITESSE_MAX, VITESSE_DEPART + score // POMMES_PAR_PALIER)


def pas_ecoule(dernier_pas, maintenant, score):
    #Vérifie que le délai entre deux déplacements est écoulé (en millisecondes).
    return maintenant - dernier_pas >= 1000 // calculer_vitesse(score)


def faire_avancer_partie(serpent, direction, pomme, score):
    #Fait un pas de jeu, retourne le nouveau serpent, la pomme, le score et si la partie est finie.
    mange = a_mange_pomme(calculer_nouvelle_tete(serpent, direction), pomme)
    serpent = avancer_serpent(serpent, direction, mange)
    if partie_perdue(serpent):
        return serpent, pomme, score, True
    if mange:
        return gerer_pomme_mangee(serpent, score)
    return serpent, pomme, score, False


def gerer_pomme_mangee(serpent, score):
    #Ajoute un point et replace une pomme, s'il n'y a plus de place la grille est pleine : victoire.
    nouvelle_pomme = placer_pomme(serpent)
    return serpent, nouvelle_pomme, score + 1, nouvelle_pomme is None
