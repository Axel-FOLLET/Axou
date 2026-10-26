/*
 * Règles et changements d'état de la partie ; le dessin est confié aux autres modules.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
import { MAX_PENALITES } from "./constants.js";
import { state } from "./state.js";
import { texteMeilleurScore } from "./storage.js";
import { t } from "./translations.js";
import { choisirMot, entreeValide, nettoyage } from "./words.js";

/*
 * Choisit un nouveau mot et remet à zéro les valeurs propres à cette manche.
 * Conserve aussi son orthographe originale pour l'écran de fin.
 */
export function preparerNouveauMot() {
    state.motOriginal = choisirMot();
    state.mot = nettoyage(state.motOriginal);
    state.penalite = 0;
    state.nombreTentatives = 0;
    state.lettresTentees = new Set();
    state.lettresDevinees = new Set();
    state.saisie = "";
    state.message = "";
    state.finMessage = 0;
    state.victoire = false;
    state.texteScore = "";
}

/*
 * Prépare un nouveau mot et sélectionne l'écran d'accueil.
 */
export function retourAccueil() {
    preparerNouveauMot();
    state.etat = "accueil";
}

/*
 * Commence avec le mot déjà préparé à l'accueil et remet les tentatives à zéro.
 */
export function demarrerPartie() {
    state.penalite = 0;
    state.nombreTentatives = 0;
    state.lettresTentees = new Set();
    state.lettresDevinees = new Set();
    state.saisie = "";
    state.message = "";
    state.finMessage = 0;
    state.victoire = false;
    state.texteScore = "";
    state.etat = "jeu";
}

/*
 * Tire un nouveau mot et passe directement à l'écran de jeu.
 */
export function rejouer() {
    preparerNouveauMot();
    state.etat = "jeu";
}

/*
 * Renvoie une chaîne avec les lettres trouvées en majuscules et des _ pour les autres.
 * Le spread transforme le mot en tableau ; map transforme les lettres et join les rassemble.
 */
export function motAffiche() {
    return [...state.mot]
        .map((lettre) => state.lettresDevinees.has(lettre) ? lettre.toUpperCase() : "_")
        .join(" ");
}

/*
 * Renvoie true si chaque lettre distincte du mot a été devinée.
 * Set élimine les doublons ; every exige que toutes les lettres passent le test.
 */
export function motTrouve() {
    return [...new Set(state.mot)].every((lettre) => state.lettresDevinees.has(lettre));
}

/*
 * Mémorise le texte et sa date d'expiration, trois secondes après maintenant.
 * L'écran de jeu vérifie cette date à chaque dessin.
 */
export function afficherMessageTemporaire(texte) {
    state.message = texte;
    state.finMessage = performance.now() + 3000;
}

/*
 * Accepte une lettre ou un mot complet, après validation et normalisation.
 * Met à jour les tentatives, pénalités et éventuelle victoire ou défaite.
 */
export function traiterTentative(tentativeBrute) {
    const brute = tentativeBrute.trim();

    if (!brute || !entreeValide(brute)) {
        afficherMessageTemporaire(t.invalid);
        return;
    }

    const tentative = nettoyage(brute);

    if (!tentative) {
        afficherMessageTemporaire(t.invalid);
        return;
    }

    /*
     * Le comportement actuel compte aussi une lettre répétée comme tentative, sans ajouter de pénalité.
     */
    state.nombreTentatives += 1;

    if (tentative.length === 1) {
        if (state.lettresTentees.has(tentative)) {
            afficherMessageTemporaire(t.already);
            return;
        }

        state.lettresTentees.add(tentative);

        if (state.mot.includes(tentative)) {
            state.lettresDevinees.add(tentative);
        } else {
            state.penalite += 1;
        }
    } else if (tentative === state.mot) {
        terminerPartie(true);
        return;
    } else {
        state.penalite += 5;
    }

    if (motTrouve()) {
        terminerPartie(true);
    } else if (state.penalite >= MAX_PENALITES) {
        state.penalite = Math.min(state.penalite, MAX_PENALITES);
        terminerPartie(false);
    }
}

/*
 * gagne indique si la partie est gagnée.
 * Enregistre le résultat utile au score puis sélectionne l'écran de fin.
 */
export function terminerPartie(gagne) {
    state.victoire = gagne;
    state.texteScore = texteMeilleurScore(gagne);
    state.etat = "fin";
    state.saisie = "";
    state.message = "";
}
