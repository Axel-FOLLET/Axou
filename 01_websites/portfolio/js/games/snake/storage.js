/*
 * Persistance du record dans ce navigateur et pour cette origine HTTP.
 * try/catch laisse le jeu fonctionner si le stockage est interdit ou invalide.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
import { SCORE_KEY } from "./constants.js";

/*
 * Lit le JSON enregistré dans localStorage et vérifie les champs attendus.
 * Une donnée absente, corrompue ou inaccessible renvoie la valeur de repli du jeu.
 */
export function lireMeilleurScore() {
    try {
        const contenu = localStorage.getItem(SCORE_KEY);

        if (!contenu) {
            return 0;
        }

        const donnees = JSON.parse(contenu);

        if (!Number.isInteger(donnees.score)) {
            return 0;
        }

        return donnees.score;
    } catch (error) {
        return 0;
    }
}

/*
 * Enregistre nouveauScore et sa date sous la clé propre à Snake.
 * JSON.stringify transforme l'objet en texte, format attendu par localStorage.
 */
export function enregistrerMeilleurScore(nouveauScore) {
    try {
        localStorage.setItem(
            SCORE_KEY,
            JSON.stringify({
                score: nouveauScore,
                date: new Date().toISOString().slice(0, 10)
            })
        );
    } catch (error) {
        // En mode privé, le jeu reste jouable même si localStorage est refusé.
    }
}

/*
 * Enregistre uniquement un score supérieur au record et renvoie true s'il est battu.
 */
export function mettreAJourMeilleurScore(nouveauScore) {
    const ancienScore = lireMeilleurScore();

    if (nouveauScore > ancienScore) {
        enregistrerMeilleurScore(nouveauScore);
        return true;
    }

    return false;
}
