/*
 * Réglages fixes : dimensions, couleurs et limites. Les distances de dessin sont en pixels.
 * Les couleurs sont nommées selon leur rôle dans le jeu ; leurs valeurs reprennent le thème du site.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
// -------------------- CONSTANTES --------------------

export const TAILLE_CASE = 30;
export const NOMBRE_CASES = 20;
export const HAUTEUR_BANDEAU = 60;
export const LARGEUR_FENETRE = 600;
export const HAUTEUR_FENETRE = 660;

export const BLANC = "rgb(255,255,255)";
export const FOND = "#E1001A";
export const ROUGE = "#E1001A";
export const TEXTE_DISCRET = "rgba(255,255,255,0.6)";
export const CASE_CLAIRE = "rgba(255,255,255,0.10)";
export const CASE_FONCEE = "rgba(255,255,255,0.04)";
export const ACCENT = "rgb(255,255,255)";
export const CORPS_SERPENT = "rgba(255,255,255,0.85)";
export const TETE_SERPENT = "#0D0A9B";
export const CONTOUR_SERPENT = "#E1001A";
export const COULEUR_POMME = "#0D0A9B";
export const COULEUR_LANGUE = "#0D0A9B";
export const QUEUE_POMME = "rgba(255,255,255,0.7)";
export const COULEUR_ETOILE = "rgb(255,255,255)";

export const COULEURS_FEUX = [
    "#0D0A9B",
    "rgb(255,255,255)",
    "rgba(255,255,255,0.6)"
];

export const PARTICULES_PAR_EXPLOSION = 40;
export const DUREE_PARTICULE = 60;
export const GRAVITE_PARTICULE = 0.08;
export const CHANCE_EXPLOSION = 0.04;

export const HAUT = [0, -1];
export const BAS = [0, 1];
export const GAUCHE = [-1, 0];
export const DROITE = [1, 0];

export const VITESSE_DEPART = 6;
export const VITESSE_MAX = 15;
export const POMMES_PAR_PALIER = 3;
export const SCORE_KEY = "snake_meilleur_score";

export const DIRECTIONS_TOUCHES = {
    ArrowUp: HAUT,
    ArrowDown: BAS,
    ArrowLeft: GAUCHE,
    ArrowRight: DROITE,
    z: HAUT,
    Z: HAUT,
    w: HAUT,
    W: HAUT,
    s: BAS,
    S: BAS,
    q: GAUCHE,
    Q: GAUCHE,
    a: GAUCHE,
    A: GAUCHE,
    d: DROITE,
    D: DROITE
};
