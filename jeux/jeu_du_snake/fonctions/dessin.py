#!/usr/bin/env python3

import math

import pygame

from fonctions.constantes import (
    BLANC, BORDEAUX_PASTEL, CONTOUR_SERPENT, HAUTEUR_BANDEAU, JAUNE_ETOILE, MARRON, NOIR,
    NOMBRE_CASES, ROSE_PASTEL, ROUGE_LANGUE, ROUGE_POMME, TAILLE_CASE, VERT_SERPENT, VERT_TETE,
)


# -------------------- POSITIONS --------------------

def rectangle_case(case):
    #Convertit une case (colonne, ligne) en rectangle en pixels, sous le bandeau du score.
    colonne, ligne = case
    return pygame.Rect(colonne * TAILLE_CASE, HAUTEUR_BANDEAU + ligne * TAILLE_CASE, TAILLE_CASE, TAILLE_CASE)


def centre_case(case):
    #Retourne le centre en pixels d'une case.
    return rectangle_case(case).center


def perpendiculaire(direction):
    #Retourne la direction à angle droit, pour placer les yeux et fourcher la langue.
    return (-direction[1], direction[0])


def point_decale(centre, direction, distance):
    #Retourne le point situé à une certaine distance du centre, dans une direction.
    return (centre[0] + direction[0] * distance, centre[1] + direction[1] * distance)


# -------------------- GRILLE --------------------

def couleur_case(colonne, ligne):
    #Alterne rose pastel et rouge bordeaux pastel comme un damier.
    if (colonne + ligne) % 2 == 0:
        return ROSE_PASTEL
    return BORDEAUX_PASTEL


def dessiner_grille(fenetre):
    #Dessine les 20 par 20 cases du terrain.
    for colonne in range(NOMBRE_CASES):
        for ligne in range(NOMBRE_CASES):
            pygame.draw.rect(fenetre, couleur_case(colonne, ligne), rectangle_case((colonne, ligne)))


# -------------------- ÉTOILE --------------------

def dessiner_etoile(fenetre, centre, rayon):
    #Dessine une étoile jaune à cinq branches autour d'un centre.
    points = []
    for numero in range(10):
        angle = -math.pi / 2 + numero * math.pi / 5
        distance = rayon if numero % 2 == 0 else rayon * 0.45
        points.append((centre[0] + distance * math.cos(angle), centre[1] + distance * math.sin(angle)))
    pygame.draw.polygon(fenetre, JAUNE_ETOILE, points)
    pygame.draw.polygon(fenetre, NOIR, points, 1)


# -------------------- LOGO --------------------

def dessiner_logo_serpent(fenetre, centre, largeur=170):
    #Dessine un serpent ondulant (tête à droite) pour les écrans d'accueil et de fin.
    nombre = 24
    amplitude = largeur // 8
    points = []
    for numero in range(nombre):
        t = numero / (nombre - 1)
        x = centre[0] - largeur // 2 + t * largeur
        y = centre[1] + amplitude * math.sin(t * 3 * math.pi)
        points.append((x, y, 4 + 6 * t))
    for x, y, rayon in points:
        pygame.draw.circle(fenetre, VERT_SERPENT, (x, y), rayon)
        pygame.draw.circle(fenetre, CONTOUR_SERPENT, (x, y), rayon, 2)
    x, y, _ = points[-1]
    tete = (x + 4, y)
    pygame.draw.line(fenetre, ROUGE_LANGUE, (tete[0] + 10, tete[1]), (tete[0] + 22, tete[1]), 3)
    for cote in (-1, 1):
        pygame.draw.line(fenetre, ROUGE_LANGUE, (tete[0] + 22, tete[1]), (tete[0] + 28, tete[1] + cote * 4), 2)
    pygame.draw.circle(fenetre, VERT_TETE, tete, 13)
    pygame.draw.circle(fenetre, CONTOUR_SERPENT, tete, 13, 2)
    for cote in (-1, 1):
        oeil = (tete[0] + 3, tete[1] + cote * 6)
        pygame.draw.circle(fenetre, BLANC, oeil, 4)
        pygame.draw.circle(fenetre, NOIR, (oeil[0] + 1, oeil[1]), 2)


# -------------------- POMME --------------------

def dessiner_pomme_centree(fenetre, centre, rayon):
    #Dessine une pomme rouge vif avec sa tige et sa feuille, autour d'un centre.
    pygame.draw.circle(fenetre, ROUGE_POMME, centre, rayon)
    pygame.draw.circle(fenetre, NOIR, centre, rayon, 1)
    haut = (centre[0], centre[1] - rayon)
    pygame.draw.line(fenetre, MARRON, haut, (haut[0] + 1, haut[1] - rayon // 2), 2)
    pygame.draw.circle(fenetre, VERT_SERPENT, (haut[0] + rayon // 3, haut[1] - rayon // 3), max(2, rayon // 4))


def dessiner_pomme(fenetre, case):
    #Dessine la pomme sur sa case.
    dessiner_pomme_centree(fenetre, centre_case(case), TAILLE_CASE // 2 - 4)


# -------------------- SERPENT --------------------

def dessiner_segment(fenetre, case, couleur):
    #Dessine une case du serpent avec un contour sombre pour le distinguer de la grille.
    rectangle = rectangle_case(case).inflate(-4, -4)
    pygame.draw.rect(fenetre, couleur, rectangle, border_radius=8)
    pygame.draw.rect(fenetre, CONTOUR_SERPENT, rectangle, 2, border_radius=8)


def dessiner_yeux(fenetre, case, direction):
    #Dessine deux yeux blancs à pupille noire vers l'avant de la tête.
    lateral = perpendiculaire(direction)
    avant = point_decale(centre_case(case), direction, 4)
    for cote in (-1, 1):
        oeil = point_decale(avant, lateral, cote * 6)
        pygame.draw.circle(fenetre, BLANC, oeil, 4)
        pygame.draw.circle(fenetre, NOIR, point_decale(oeil, direction, 1), 2)


def dessiner_langue(fenetre, case, direction):
    #Dessine une langue rouge fourchue qui sort de la bouche.
    lateral = perpendiculaire(direction)
    base = point_decale(centre_case(case), direction, TAILLE_CASE // 2 - 2)
    pointe = point_decale(base, direction, 10)
    pygame.draw.line(fenetre, ROUGE_LANGUE, base, pointe, 3)
    for cote in (-1, 1):
        bout = point_decale(point_decale(pointe, direction, 5), lateral, cote * 4)
        pygame.draw.line(fenetre, ROUGE_LANGUE, pointe, bout, 2)


def dessiner_tete(fenetre, case, direction):
    #Dessine la tête : le segment, les yeux et la langue rouge.
    dessiner_langue(fenetre, case, direction)
    dessiner_segment(fenetre, case, VERT_TETE)
    dessiner_yeux(fenetre, case, direction)


def dessiner_serpent(fenetre, serpent, direction):
    #Dessine le corps de la queue vers la tête, puis la tête par-dessus.
    for case in reversed(serpent[1:]):
        dessiner_segment(fenetre, case, VERT_SERPENT)
    dessiner_tete(fenetre, serpent[0], direction)
