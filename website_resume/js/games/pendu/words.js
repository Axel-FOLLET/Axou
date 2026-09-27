/*
 * Choix et normalisation des mots ; la validation de saisie précède le nettoyage.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
import { MOTS, MOTS_EN } from "./word-list.js";
import { language } from "./translations.js";

/*
 * Renvoie une version comparable du texte : lettres minuscules sans accents.
 * NFD sépare les accents des lettres ; les expressions régulières retirent les marques et caractères restants.
 */
export function nettoyage(texte) {
    return texte
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z]/g, "");
}

/*
 * Vérifie que la saisie contient uniquement des lettres, éventuellement accentuées.
 * Les ancres ^ et $ imposent que toute la chaîne respecte le motif ; + exige au moins une lettre.
 */
export function entreeValide(texte) {
    return /^[A-Za-zÀ-ÖØ-öø-ÿ]+$/u.test(texte);
}

/*
 * Choisit la liste française ou anglaise et renvoie un mot au hasard.
 * Math.random produit une valeur entre 0 inclus et 1 exclu ; floor fournit un indice entier.
 */
export function choisirMot() {
    const liste = language === "en" ? MOTS_EN : MOTS;

    return liste[Math.floor(Math.random() * liste.length)];
}
