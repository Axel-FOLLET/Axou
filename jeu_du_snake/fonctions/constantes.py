#!/usr/bin/env python3

import os
import pygame


# -------------------- GRILLE --------------------

TAILLE_CASE = 30
NOMBRE_CASES = 20
HAUTEUR_BANDEAU = 60
LARGEUR_FENETRE = TAILLE_CASE * NOMBRE_CASES
HAUTEUR_FENETRE = LARGEUR_FENETRE + HAUTEUR_BANDEAU


# -------------------- COULEURS --------------------

BLANC = (255, 255, 255)
NOIR = (0, 0, 0)
GRIS = (200, 200, 200)
ROSE_PASTEL = (255, 209, 220)
BORDEAUX_PASTEL = (176, 98, 116)
VERT_FORET = (34, 110, 45)
VERT_SERPENT = (0, 175, 120)
VERT_TETE = (0, 125, 85)
CONTOUR_SERPENT = (0, 70, 45)
ROUGE_POMME = (255, 20, 20)
ROUGE_LANGUE = (230, 0, 40)
MARRON = (101, 67, 33)
JAUNE_ETOILE = (255, 200, 0)
COULEURS_FEUX = [(255, 20, 20), (255, 200, 0), (255, 120, 0), (0, 175, 120), (30, 110, 255), (200, 40, 220)]


# -------------------- FEUX D'ARTIFICE --------------------

PARTICULES_PAR_EXPLOSION = 40
DUREE_PARTICULE = 60
GRAVITE_PARTICULE = 0.08
CHANCE_EXPLOSION = 0.04


# -------------------- DIRECTIONS --------------------

HAUT = (0, -1)
BAS = (0, 1)
GAUCHE = (-1, 0)
DROITE = (1, 0)

TOUCHES_DIRECTIONS = {
    pygame.K_UP: HAUT,
    pygame.K_DOWN: BAS,
    pygame.K_LEFT: GAUCHE,
    pygame.K_RIGHT: DROITE,
}


# -------------------- VITESSE --------------------

VITESSE_DEPART = 6
VITESSE_MAX = 15
POMMES_PAR_PALIER = 3


# -------------------- SCORE --------------------

CHEMIN_SCORE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "meilleur_score.txt")
