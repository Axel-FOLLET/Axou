/*
 * État partagé de la partie : les autres modules lisent et modifient ce même objet.
 * const empêche de remplacer l'objet, mais n'empêche pas de modifier ses propriétés.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
import { DROITE } from "./constants.js";

export const state = {
    /*
     * Tableau de cases [colonne, ligne] ; indice 0 = tête.
     */
    serpent: [],
    /*
     * Direction appliquée au dernier déplacement.
     */
    direction: DROITE,
    /*
     * Direction reçue au clavier, appliquée au prochain déplacement.
     */
    directionDemandee: DROITE,
    /*
     * Case de la pomme, ou null quand aucune place ne reste.
     */
    pomme: null,
    /*
     * Nombre de pommes mangées pendant cette manche.
     */
    score: 0,
    /*
     * Record lu depuis le stockage local.
     */
    meilleurScore: 0,
    /*
     * Déclenche les effets décoratifs si le record vient d’être dépassé.
     */
    recordBattu: false,
    /*
     * Résultat de la dernière fin de partie.
     */
    victoire: false,
    /*
     * Horodatage du dernier déplacement du serpent.
     */
    dernierPas: 0,
    /*
     * Écran courant : accueil, jeu ou fin.
     */
    etat: "accueil",
    /*
     * Interrompt les déplacements sans supprimer la partie.
     */
    pause: false,
    /*
     * Particules actives du feu d’artifice.
     */
    particules: [],
    /*
     * Horodatage de la dernière image pour calculer le temps écoulé.
     */
    tempsPrecedent: performance.now()
};
