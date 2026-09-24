#!/usr/bin/env python3
import random

def choisir_mot():
    # ouvre le dictionnaire français et lit tous les mots, un par ligne
    chemin_fichier = "mots_simples.txt"
    with open(chemin_fichier) as fichier:
        mots = fichier.readlines()
    if len(mots) == 0:
        # sécurité si le fichier est vide, pour éviter un plantage lors du choix aléatoire
        print("Error: empty file")
        exit()
    return random.choice(mots).strip()