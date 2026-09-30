/*
 * Réglages fixes : dimensions, couleurs et limites. Les distances de dessin sont en pixels.
 * Les couleurs sont nommées selon leur rôle dans le jeu ; leurs valeurs reprennent le thème du site.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
// -------------------- CONSTANTES --------------------

export const TEXTE = "rgb(255,255,255)";
export const TEXTE_DISCRET = "rgba(255,255,255,0.6)";
export const COULEUR_POTENCE = "rgba(255,255,255,0.85)";
export const BLEU = "#0D0A9B";
export const ACCENT = "rgb(255,255,255)";
export const BARRE_MOYENNE = "rgba(255,255,255,0.6)";
export const TOUCHE_TROUVEE = "rgba(255,255,255,0.35)";
export const TOUCHE_RATEE = "rgba(13,10,155,0.75)";
export const FOND_MESSAGE = "#E1001A";
export const FOND = "#E1001A";
export const FOND_CLAIR = "rgba(255,255,255,0.10)";
export const FOND_VICTOIRE = "#E1001A";
export const FOND_DEFAITE = "#E1001A";

export const MAX_PENALITES = 12;
export const LIGNES_CLAVIER = ["AZERTYUIOP", "QSDFGHJKLM", "WXCVBN"];
export const TOUCHE_LARGEUR = 46;
export const TOUCHE_HAUTEUR = 50;
export const TOUCHE_ECART = 8;
export const CLAVIER_X = 620;
export const CLAVIER_LARGEUR = 532;
export const CLAVIER_Y = 250;
export const SCORE_KEY = "pendu_meilleur_score";
