/*
 * Persistance du record dans ce navigateur et pour cette origine HTTP.
 * try/catch laisse le jeu fonctionner si le stockage est interdit ou invalide.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
import { SCORE_KEY } from "./constants.js";
import { state } from "./state.js";
import { t } from "./translations.js";

/*
 * Lit le JSON enregistré dans localStorage et vérifie les champs attendus.
 * Une donnée absente, corrompue ou inaccessible renvoie la valeur de repli du jeu.
 */
export function lireMeilleurScore() {
    try {
        const contenu = localStorage.getItem(SCORE_KEY);

        if (!contenu) {
            return null;
        }

        const score = JSON.parse(contenu);

        if (!Number.isInteger(score.tentatives) || !score.date) {
            return null;
        }

        return score;
    } catch (error) {
        return null;
    }
}

/*
 * Enregistre le nombre de tentatives et la date UTC au format AAAA-MM-JJ.
 * Si le stockage est refusé, renvoie quand même la date pour laisser le jeu fonctionner.
 */
export function enregistrerScore() {
    try {
        const date = new Date().toISOString().slice(0, 10);
        localStorage.setItem(
            SCORE_KEY,
            JSON.stringify({ tentatives: state.nombreTentatives, date: date })
        );
        return date;
    } catch (error) {
        return new Date().toISOString().slice(0, 10);
    }
}

/*
 * Renvoie le message de score dans la langue choisie.
 * Au Pendu, un record correspond à une victoire avec moins de tentatives.
 */
export function texteMeilleurScore(gagne) {
    const ancien = lireMeilleurScore();

    if (gagne && (!ancien || state.nombreTentatives < ancien.tentatives)) {
        enregistrerScore();
        return t.newBest;
    }

    if (!ancien) {
        return t.noBest;
    }

    return t.best(ancien.tentatives, ancien.date);
}
