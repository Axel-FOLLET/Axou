/*
 * État partagé de la partie : les autres modules lisent et modifient ce même objet.
 * const empêche de remplacer l'objet, mais n'empêche pas de modifier ses propriétés.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
export const state = {
    /*
     * Orthographe conservée pour afficher le mot à la fin.
     */
    motOriginal: "",
    /*
     * Version normalisée utilisée pour les comparaisons.
     */
    mot: "",
    /*
     * Total des pénalités de la manche.
     */
    penalite: 0,
    /*
     * Nombre de propositions comptabilisées.
     */
    nombreTentatives: 0,
    /*
     * Set des lettres essayées : chaque lettre apparaît au plus une fois.
     */
    lettresTentees: new Set(),
    /*
     * Set des lettres trouvées dans le mot.
     */
    lettresDevinees: new Set(),
    /*
     * Texte en cours de frappe, avant validation.
     */
    saisie: "",
    /*
     * Retour temporaire au joueur.
     */
    message: "",
    /*
     * Horodatage en millisecondes auquel ce message expire.
     */
    finMessage: 0,
    /*
     * Écran courant : accueil, jeu ou fin.
     */
    etat: "accueil",
    /*
     * Résultat de la dernière fin de partie.
     */
    victoire: false,
    /*
     * Message de record préparé pour la fin de partie.
     */
    texteScore: "",
    /*
     * Rectangles cliquables du clavier dessiné.
     */
    zonesTouches: []
};
