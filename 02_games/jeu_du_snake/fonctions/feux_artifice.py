#!/usr/bin/env python3

import math
import random
import pygame

from fonctions.constantes import (
    CHANCE_EXPLOSION, COULEURS_FEUX, DUREE_PARTICULE, GRAVITE_PARTICULE,
    LARGEUR_FENETRE, PARTICULES_PAR_EXPLOSION,
)


def creer_particule(x, y, couleur):
    #Crée une particule qui part dans une direction et à une vitesse aléatoires.
    angle = random.uniform(0, 2 * math.pi)
    vitesse = random.uniform(1, 4)
    return {
        "x": x, "y": y,
        "vx": math.cos(angle) * vitesse, "vy": math.sin(angle) * vitesse,
        "vie": DUREE_PARTICULE, "couleur": couleur,
    }


def creer_explosion(x, y):
    #Crée toutes les particules d'une explosion d'une même couleur.
    couleur = random.choice(COULEURS_FEUX)
    return [creer_particule(x, y, couleur) for _ in range(PARTICULES_PAR_EXPLOSION)]


def lancer_explosion_aleatoire(particules):
    #Ajoute une explosion à un endroit aléatoire du haut de la fenêtre.
    x = random.randint(80, LARGEUR_FENETRE - 80)
    y = random.randint(80, 300)
    return particules + creer_explosion(x, y)


def deplacer_particule(particule):
    #Déplace la particule, la gravité la fait retomber et sa vie diminue.
    particule["x"] += particule["vx"]
    particule["y"] += particule["vy"]
    particule["vy"] += GRAVITE_PARTICULE
    particule["vie"] -= 1


def animer_feux_artifice(particules):
    #Fait avancer l'animation d'un pas : nouvelle explosion possible, particules mortes retirées.
    if random.random() < CHANCE_EXPLOSION:
        particules = lancer_explosion_aleatoire(particules)
    for particule in particules:
        deplacer_particule(particule)
    return [particule for particule in particules if particule["vie"] > 0]


def dessiner_particules(fenetre, particules):
    #Dessine chaque particule, elle rétrécit en fin de vie.
    for particule in particules:
        rayon = 2 + 2 * particule["vie"] // DUREE_PARTICULE
        pygame.draw.circle(fenetre, particule["couleur"], (int(particule["x"]), int(particule["y"])), rayon)
