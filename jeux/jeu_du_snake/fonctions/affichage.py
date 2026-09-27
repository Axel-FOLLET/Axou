#!/usr/bin/env python3

import pygame

from fonctions.constantes import (
    BLANC, GRIS, HAUTEUR_BANDEAU, LARGEUR_FENETRE, NOIR, ROUGE_POMME, VERT_FORET,
)
from fonctions.dessin import (
    dessiner_etoile, dessiner_grille, dessiner_logo_serpent, dessiner_pomme, dessiner_pomme_centree,
    dessiner_serpent,
)
from fonctions.feux_artifice import dessiner_particules


# -------------------- TEXTE --------------------

def afficher_texte(fenetre, texte, position, police, couleur=NOIR):
    #Affiche un texte à une position précise.
    fenetre.blit(police.render(texte, True, couleur), position)


def afficher_centre(fenetre, texte, y, police, couleur=NOIR):
    #Affiche un texte centré horizontalement.
    surface = police.render(texte, True, couleur)
    fenetre.blit(surface, ((fenetre.get_width() - surface.get_width()) // 2, y))


def afficher_lignes_centrees(fenetre, lignes, y_depart, police, ecart=38):
    #Affiche plusieurs lignes de texte centrées les unes sous les autres.
    for numero, ligne in enumerate(lignes):
        afficher_centre(fenetre, ligne, y_depart + numero * ecart, police)


def afficher_cadre_vert(fenetre, rectangle):
    #Dessine un cadre vert forêt aux angles arrondis.
    pygame.draw.rect(fenetre, VERT_FORET, rectangle, 4, border_radius=14)


# -------------------- BANDEAU DU SCORE --------------------

def afficher_pommes_mangees(fenetre, score, police):
    #Affiche l'emoji pomme suivi du nombre de pommes mangées.
    dessiner_pomme_centree(fenetre, (30, HAUTEUR_BANDEAU // 2 + 3), 12)
    afficher_texte(fenetre, "x " + str(score), (52, 20), police)


def afficher_meilleur_score(fenetre, meilleur_score, police):
    #Affiche l'étoile puis le meilleur score, alignés à droite du bandeau.
    surface = police.render("Meilleur score : " + str(meilleur_score), True, NOIR)
    x_texte = LARGEUR_FENETRE - surface.get_width() - 20
    fenetre.blit(surface, (x_texte, 20))
    dessiner_etoile(fenetre, (x_texte - 18, HAUTEUR_BANDEAU // 2), 11)


def afficher_bandeau(fenetre, score, meilleur_score, police):
    #Dessine le bandeau blanc du haut avec les pommes mangées et le meilleur score.
    pygame.draw.rect(fenetre, BLANC, (0, 0, LARGEUR_FENETRE, HAUTEUR_BANDEAU))
    pygame.draw.line(fenetre, VERT_FORET, (0, HAUTEUR_BANDEAU - 2), (LARGEUR_FENETRE, HAUTEUR_BANDEAU - 2), 4)
    afficher_pommes_mangees(fenetre, score, police)
    afficher_meilleur_score(fenetre, meilleur_score, police)


# -------------------- ÉCRANS --------------------

def afficher_jeu(fenetre, serpent, direction, pomme, score, meilleur_score, police):
    #Efface l'écran puis redessine tout l'état actuel du jeu.
    fenetre.fill(BLANC)
    dessiner_grille(fenetre)
    if pomme is not None:
        dessiner_pomme(fenetre, pomme)
    dessiner_serpent(fenetre, serpent, direction)
    afficher_bandeau(fenetre, score, meilleur_score, police)
    pygame.display.flip()


def afficher_accueil(fenetre, grande_police, police, police_regles, petite_police):
    #Affiche l'écran d'accueil : titre, règles dans un cadre vert, puis les touches.
    fenetre.fill(BLANC)
    dessiner_logo_serpent(fenetre, (LARGEUR_FENETRE // 2 - 14, 40))
    afficher_centre(fenetre, "BIENVENUE AU JEU DU SNAKE", 80, grande_police, VERT_FORET)
    afficher_cadre_vert(fenetre, pygame.Rect(50, 150, LARGEUR_FENETRE - 100, 270))
    afficher_lignes_centrees(fenetre, [
        "Guidez le serpent avec les flèches directionnelles.",
        "Mangez les pommes rouges pour grandir.",
        "Chaque pomme mangée vous rapporte 1 point.",
        "Le serpent accélère au fil des pommes.",
        "Toucher un mur ou votre propre corps = défaite.",
        "Le demi-tour est impossible.",
    ], 180, police_regles)
    afficher_centre(fenetre, "Appuyez sur ENTRÉE pour commencer.", 470, police, VERT_FORET)
    afficher_centre(fenetre, "ÉCHAP pour quitter.", 520, petite_police, GRIS)
    pygame.display.flip()


def texte_record(record_battu, meilleur_score):
    #Retourne le message correspondant au meilleur score.
    if record_battu:
        return "NOUVEAU MEILLEUR SCORE !"
    return "Meilleur score : " + str(meilleur_score)


def afficher_titre_fin(fenetre, victoire, grande_police, police):
    #Affiche le titre et la phrase de l'écran de fin selon victoire ou défaite.
    if victoire:
        afficher_centre(fenetre, "VICTOIRE !", 100, grande_police, VERT_FORET)
        afficher_centre(fenetre, "La grille est entièrement remplie.", 170, police)
    else:
        afficher_centre(fenetre, "PERDU !", 100, grande_police, ROUGE_POMME)
        afficher_centre(fenetre, "Le serpent s'est écrasé.", 170, police)


def afficher_fin(fenetre, victoire, score, meilleur_score, record_battu, particules, polices):
    #Affiche l'écran de fin, avec les feux d'artifice derrière le texte si le record est battu.
    grande_police, police, petite_police = polices
    fenetre.fill(BLANC)
    dessiner_particules(fenetre, particules)
    dessiner_logo_serpent(fenetre, (LARGEUR_FENETRE // 2 - 14, 45))
    afficher_titre_fin(fenetre, victoire, grande_police, police)
    afficher_centre(fenetre, "Pommes mangées : " + str(score), 250, police)
    afficher_centre(fenetre, texte_record(record_battu, meilleur_score), 300, police, VERT_FORET)
    afficher_centre(fenetre, "Appuyez sur ENTRÉE pour rejouer.", 420, police, VERT_FORET)
    afficher_centre(fenetre, "ÉCHAP pour quitter.", 470, petite_police, GRIS)
    pygame.display.flip()
