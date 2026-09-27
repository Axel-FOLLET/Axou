/*
 * Réglages fixes : dimensions, couleurs et limites. Les distances de dessin sont en pixels.
 * Certains noms de couleur viennent du jeu initial ; leur valeur a été adaptée au thème du CV.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
// -------------------- CONSTANTES --------------------

export const BLANC = "rgb(255,255,255)";
export const NOIR = "rgb(255,255,255)";
export const GRIS = "rgba(255,255,255,0.6)";
export const MARRON = "rgba(255,255,255,0.85)";
export const ROUGE = "#E1001A";
export const VERT = "rgb(255,255,255)";
export const ORANGE = "rgba(255,255,255,0.6)";
export const VERT_CLAIR = "rgba(255,255,255,0.35)";
export const ROUGE_CLAIR = "rgba(225,0,26,0.75)";
export const FOND_MESSAGE = "#0D0A9B";
export const FOND = "#0D0A9B";
export const FOND_CLAIR = "rgba(255,255,255,0.10)";
export const FOND_VICTOIRE = "#0D0A9B";
export const FOND_DEFAITE = "#0D0A9B";

export const MAX_PENALITES = 12;
export const LIGNES_CLAVIER = ["AZERTYUIOP", "QSDFGHJKLM", "WXCVBN"];
export const TOUCHE_LARGEUR = 46;
export const TOUCHE_HAUTEUR = 50;
export const TOUCHE_ECART = 8;
export const CLAVIER_X = 620;
export const CLAVIER_LARGEUR = 532;
export const CLAVIER_Y = 250;
export const SCORE_KEY = "pendu_meilleur_score";
