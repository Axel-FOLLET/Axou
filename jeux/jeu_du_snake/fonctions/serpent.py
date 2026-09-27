#!/usr/bin/env python3

from fonctions.constantes import NOMBRE_CASES, TOUCHES_DIRECTIONS


def creer_serpent():
    #Crée un serpent de 3 cases au milieu de la grille, la tête est la première case de la liste.
    milieu = NOMBRE_CASES // 2
    return [(milieu - decalage, milieu) for decalage in range(3)]


def direction_de_la_touche(touche):
    #Retourne la direction associée à une flèche, ou None si la touche n'est pas une flèche.
    return TOUCHES_DIRECTIONS.get(touche)


def sens_oppose(direction_a, direction_b):
    #Vérifie que deux directions vont dans des sens contraires.
    return direction_a[0] == -direction_b[0] and direction_a[1] == -direction_b[1]


def choisir_direction(direction_actuelle, direction_demandee):
    #Refuse le demi-tour, le serpent se mordrait immédiatement.
    if sens_oppose(direction_actuelle, direction_demandee):
        return direction_actuelle
    return direction_demandee


def calculer_nouvelle_tete(serpent, direction):
    #Calcule la case que la tête va occuper au prochain pas.
    colonne, ligne = serpent[0]
    return (colonne + direction[0], ligne + direction[1])


def avancer_serpent(serpent, direction, grandit):
    #Ajoute une tête devant, et retire la queue sauf si le serpent vient de manger.
    nouveau_serpent = [calculer_nouvelle_tete(serpent, direction)] + serpent
    if not grandit:
        nouveau_serpent.pop()
    return nouveau_serpent
