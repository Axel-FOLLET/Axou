/*
 * Composition des écrans : chaque image est redessinée à partir de l'état courant.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
import { dessinerBarrePenalites, dessinerHomme, dessinerLogoPendu, dessinerPotence } from "./artwork.js";
import { canvas, ctx } from "./canvas.js";
import { ACCENT, BLEU, CLAVIER_LARGEUR, COULEUR_POTENCE, FOND, FOND_CLAIR, FOND_DEFAITE, FOND_MESSAGE, FOND_VICTOIRE, MAX_PENALITES, TEXTE, TEXTE_DISCRET } from "./constants.js";
import { ligne, rectangleArrondi, texte, texteCentre } from "./drawing.js";
import { dessinerClavier } from "./keyboard.js";
import { motAffiche } from "./rules.js";
import { state } from "./state.js";
import { t } from "./translations.js";

/*
 * Compose l'écran d'accueil : fond, illustration, règles et commande pour démarrer.
 */
export function afficherAccueil() {
    ctx.fillStyle = FOND;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    dessinerLogoPendu(canvas.width / 2, 25);
    texteCentre(t.title, 120, 50, TEXTE);
    texteCentre(t.subtitle, 190, 30, TEXTE);

    rectangleArrondi(300, 245, 600, 205, 14, null, COULEUR_POTENCE, 4);
    texteCentre(t.penaltiesAllowed, 270, 30, TEXTE);
    texteCentre(t.badLetter, 320, 30, TEXTE);
    texteCentre(t.badWord, 360, 30, TEXTE);
    texteCentre(t.wordLength(state.mot.length), 410, 30, TEXTE);
    texteCentre(t.start, 520, 30, ACCENT);
    texteCentre(t.escapeWelcome, 570, 24, TEXTE_DISCRET);
}

/*
 * Redessine la partie à partir de state ; les règles du jeu sont gérées dans rules.js.
 */
export function afficherJeu() {
    ctx.fillStyle = FOND;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    dessinerPotence();
    dessinerHomme();
    dessinerClavier();

    texte(t.penalties(state.penalite), 620, 50, 30, TEXTE);
    dessinerBarrePenalites(620, 85, CLAVIER_LARGEUR, 26);
    texte(t.chances(Math.max(MAX_PENALITES - state.penalite, 0)), 620, 130, 30, TEXTE);
    texte(t.attempts(state.nombreTentatives), 620, 165, 30, TEXTE_DISCRET);

    texte(t.word(motAffiche()), 50, 612, 46, TEXTE);
    ctx.font = "30px Avenir, 'Avenir Next', sans-serif";
    const xBoite = Math.max(260, 50 + ctx.measureText(t.proposal).width + 20);

    texte(t.proposal, 50, 708, 30, TEXTE);

    rectangleArrondi(xBoite, 695, 400, 42, 8, FOND_CLAIR, COULEUR_POTENCE, 3);
    texte(state.saisie.toUpperCase(), xBoite + 12, 704, 30, TEXTE);

    /*
     * Alterne toutes les 500 ms pour faire clignoter le curseur de saisie.
     */
    if (Math.floor(performance.now() / 500) % 2 === 0) {
        ctx.font = "30px Avenir, 'Avenir Next', sans-serif";
        const largeurSaisie = ctx.measureText(state.saisie.toUpperCase()).width;
        const xCurseur = xBoite + 14 + largeurSaisie;
        ligne([xCurseur, 703], [xCurseur, 729], TEXTE, 2);
    }

    if (state.message && performance.now() <= state.finMessage) {
        ctx.font = "30px Avenir, 'Avenir Next', sans-serif";
        const largeur = ctx.measureText(state.message).width;
        const cadreLargeur = largeur + 40;
        const cadreX = (canvas.width - cadreLargeur) / 2;

        rectangleArrondi(cadreX, 540, cadreLargeur, 50, 10, FOND_MESSAGE, BLEU, 2);
        texteCentre(state.message, 550, 30, TEXTE);
    } else if (state.message) {
        state.message = "";
    }
}

/*
 * Compose l'écran de victoire ou de défaite avec le résultat et les commandes de reprise.
 */
export function afficherFin() {
    ctx.fillStyle = state.victoire ? FOND_VICTOIRE : FOND_DEFAITE;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    /*
     * Mémorise les réglages du contexte avant une transformation locale ; restore les rétablit ensuite.
     */
    ctx.save();
    ctx.translate(-100, 130);
    dessinerPotence();
    dessinerHomme();
    ctx.restore();

    if (state.victoire) {
        texteCentre(t.victory, 150, 50, ACCENT);
        texteCentre(t.survive, 230, 30, TEXTE);
        texteCentre(state.texteScore, 310, 30, TEXTE);
    } else {
        texteCentre(t.defeat, 150, 50, TEXTE);
        texteCentre(t.badLuck, 230, 30, TEXTE);
        texteCentre(t.hanged, 280, 30, TEXTE);
        texteCentre(state.texteScore, 350, 30, TEXTE);
    }

    texteCentre(t.wordWas(state.motOriginal.toUpperCase()), 450, 30, TEXTE);
    texteCentre(t.replay, 535, 30, ACCENT);
    texteCentre(t.escapeEnd, 585, 24, TEXTE_DISCRET);
}

/*
 * Choisit l'écran à dessiner selon state.etat : accueil, jeu ou fin.
 */
export function dessiner() {
    if (state.etat === "accueil") {
        afficherAccueil();
    } else if (state.etat === "jeu") {
        afficherJeu();
    } else {
        afficherFin();
    }
}
