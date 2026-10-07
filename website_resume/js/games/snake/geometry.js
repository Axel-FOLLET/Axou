/*
 * Conversions et calculs de positions. Une case est un tableau [colonne, ligne].
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
import { HAUTEUR_BANDEAU, NOMBRE_CASES, TAILLE_CASE } from "./constants.js";

/*
 * Vérifie si chaque composante de a est l'opposée de celle de b.
 */
export function sensOppose(a, b) {
    return a[0] === -b[0] && a[1] === -b[1];
}

/*
 * Renvoie la direction demandée, sauf si elle provoquerait un demi-tour immédiat.
 */
export function choisirDirection(directionActuelle, nouvelleDirection) {
    if (sensOppose(directionActuelle, nouvelleDirection)) {
        return directionActuelle;
    }

    return nouvelleDirection;
}

/*
 * Crée trois cases alignées au milieu de la grille ; la tête est à l'indice 0.
 */
export function creerSerpent() {
    const milieu = Math.floor(NOMBRE_CASES / 2);

    return [0, 1, 2].map((decalage) => [milieu - decalage, milieu]);
}

/*
 * Transforme une case [colonne, ligne] en clé texte pour comparer les positions par valeur.
 */
export function cleCase(caseGrille) {
    return `${caseGrille[0]}:${caseGrille[1]}`;
}

/*
 * Parcourt la grille en excluant les positions occupées par le serpent.
 * Un Set de clés permet de rechercher une case sans reparcourir tout le serpent.
 */
export function listerCasesLibres(serpentActuel) {
    const occupees = new Set(serpentActuel.map(cleCase));
    const cases = [];

    for (let colonne = 0; colonne < NOMBRE_CASES; colonne += 1) {
        for (let ligne = 0; ligne < NOMBRE_CASES; ligne += 1) {
            if (!occupees.has(`${colonne}:${ligne}`)) {
                cases.push([colonne, ligne]);
            }
        }
    }

    return cases;
}

/*
 * Tire au hasard une case libre ; renvoie null si la grille est entièrement occupée.
 */
export function placerPomme(serpentActuel) {
    const casesLibres = listerCasesLibres(serpentActuel);

    if (casesLibres.length === 0) {
        return null;
    }

    return casesLibres[Math.floor(Math.random() * casesLibres.length)];
}

/*
 * Vérifie les limites de la grille : les indices vont de 0 à NOMBRE_CASES - 1.
 */
export function estHorsGrille(caseGrille) {
    return caseGrille[0] < 0
        || caseGrille[0] >= NOMBRE_CASES
        || caseGrille[1] < 0
        || caseGrille[1] >= NOMBRE_CASES;
}

/*
 * Compare la tête aux autres cases du serpent.
 * slice(1) exclut la tête ; some suffit dès qu'une case correspond.
 */
export function seMord(serpentActuel) {
    const tete = cleCase(serpentActuel[0]);
    return serpentActuel.slice(1).some((caseGrille) => cleCase(caseGrille) === tete);
}

/*
 * Compare les coordonnées si les deux cases existent.
 * Le court-circuit de && évite de lire les coordonnées d'une pomme absente.
 */
export function casesEgales(a, b) {
    return a && b && a[0] === b[0] && a[1] === b[1];
}

/*
 * Convertit une case logique en rectangle de pixels.
 * La coordonnée y inclut la hauteur du bandeau au-dessus de la grille.
 */
export function rectangleCase(caseGrille) {
    return {
        x: caseGrille[0] * TAILLE_CASE,
        y: HAUTEUR_BANDEAU + caseGrille[1] * TAILLE_CASE,
        largeur: TAILLE_CASE,
        hauteur: TAILLE_CASE
    };
}

/*
 * Renvoie le point central du rectangle associé à une case.
 */
export function centreCase(caseGrille) {
    const rect = rectangleCase(caseGrille);
    return [rect.x + rect.largeur / 2, rect.y + rect.hauteur / 2];
}

/*
 * Tourne la direction d'un quart de tour pour placer les détails de part et d'autre de la tête.
 */
export function perpendiculaire(directionActuelle) {
    return [-directionActuelle[1], directionActuelle[0]];
}

/*
 * Renvoie un point décalé depuis centre, selon une direction et une distance en pixels.
 */
export function pointDecale(centre, directionActuelle, distance) {
    return [
        centre[0] + directionActuelle[0] * distance,
        centre[1] + directionActuelle[1] * distance
    ];
}
