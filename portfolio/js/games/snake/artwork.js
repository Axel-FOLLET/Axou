/*
 * Dessins propres au jeu, construits avec les primitives du canvas.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
import { ctx } from "./canvas.js";
import { BLANC, BORDEAUX_PASTEL, CONTOUR_SERPENT, FOND, HAUTEUR_BANDEAU, JAUNE_ETOILE, LARGEUR_FENETRE, MARRON, NOIR, NOMBRE_CASES, ROSE_PASTEL, ROUGE_LANGUE, ROUGE_POMME, TAILLE_CASE, VERT_FORET, VERT_SERPENT, VERT_TETE } from "./constants.js";
import { rectangleArrondi, texte } from "./drawing.js";
import { centreCase, perpendiculaire, pointDecale, rectangleCase } from "./geometry.js";
import { state } from "./state.js";
import { t } from "./translations.js";

/*
 * Dessine le damier ; la parité de colonne + ligne alterne les deux couleurs.
 */
export function dessinerGrille() {
    for (let colonne = 0; colonne < NOMBRE_CASES; colonne += 1) {
        for (let ligne = 0; ligne < NOMBRE_CASES; ligne += 1) {
            ctx.fillStyle = (colonne + ligne) % 2 === 0 ? ROSE_PASTEL : BORDEAUX_PASTEL;
            ctx.fillRect(
                colonne * TAILLE_CASE,
                HAUTEUR_BANDEAU + ligne * TAILLE_CASE,
                TAILLE_CASE,
                TAILLE_CASE
            );
        }
    }
}

/*
 * Construit dix sommets alternant rayon extérieur et intérieur pour dessiner cinq branches.
 */
export function dessinerEtoile(centre, rayon) {
    const points = [];

    for (let numero = 0; numero < 10; numero += 1) {
        const angle = -Math.PI / 2 + numero * Math.PI / 5;
        const distance = numero % 2 === 0 ? rayon : rayon * 0.45;

        points.push([
            centre[0] + distance * Math.cos(angle),
            centre[1] + distance * Math.sin(angle)
        ]);
    }

    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);

    points.slice(1).forEach((point) => ctx.lineTo(point[0], point[1]));

    ctx.closePath();
    ctx.fillStyle = JAUNE_ETOILE;
    ctx.fill();
    ctx.strokeStyle = NOIR;
    ctx.lineWidth = 1;
    ctx.stroke();
}

/*
 * Dessine le serpent décoratif de l'accueil avec des points suivant une sinusoïde.
 */
export function dessinerLogoSerpent(centre, largeur = 170) {
    const nombre = 24;
    const amplitude = Math.floor(largeur / 8);
    const points = [];

    for (let numero = 0; numero < nombre; numero += 1) {
        const progression = numero / (nombre - 1);
        const x = centre[0] - largeur / 2 + progression * largeur;
        const y = centre[1] + amplitude * Math.sin(progression * 3 * Math.PI);
        const rayon = 4 + 6 * progression;
        points.push([x, y, rayon]);
    }

    points.forEach(([x, y, rayon]) => {
        ctx.beginPath();
        ctx.arc(x, y, rayon, 0, Math.PI * 2);
        ctx.fillStyle = VERT_SERPENT;
        ctx.fill();
        ctx.strokeStyle = CONTOUR_SERPENT;
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    const dernier = points[points.length - 1];
    const tete = [dernier[0] + 4, dernier[1]];

    ctx.strokeStyle = ROUGE_LANGUE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tete[0] + 10, tete[1]);
    ctx.lineTo(tete[0] + 22, tete[1]);
    ctx.stroke();

    [-1, 1].forEach((cote) => {
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tete[0] + 22, tete[1]);
        ctx.lineTo(tete[0] + 28, tete[1] + cote * 4);
        ctx.stroke();
    });

    ctx.beginPath();
    ctx.arc(tete[0], tete[1], 13, 0, Math.PI * 2);
    ctx.fillStyle = VERT_TETE;
    ctx.fill();
    ctx.strokeStyle = CONTOUR_SERPENT;
    ctx.lineWidth = 2;
    ctx.stroke();

    [-1, 1].forEach((cote) => {
        const oeil = [tete[0] + 3, tete[1] + cote * 6];

        ctx.beginPath();
        ctx.arc(oeil[0], oeil[1], 4, 0, Math.PI * 2);
        ctx.fillStyle = BLANC;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(oeil[0] + 1, oeil[1], 2, 0, Math.PI * 2);
        ctx.fillStyle = NOIR;
        ctx.fill();
    });
}

/*
 * Dessine une pomme autour du point centre [x, y], avec le rayon demandé.
 */
export function dessinerPommeCentree(centre, rayon) {
    ctx.beginPath();
    ctx.arc(centre[0], centre[1], rayon, 0, Math.PI * 2);
    ctx.fillStyle = ROUGE_POMME;
    ctx.fill();
    ctx.strokeStyle = NOIR;
    ctx.lineWidth = 1;
    ctx.stroke();

    const haut = [centre[0], centre[1] - rayon];

    ctx.beginPath();
    ctx.moveTo(haut[0], haut[1]);
    ctx.lineTo(haut[0] + 1, haut[1] - rayon / 2);
    ctx.strokeStyle = MARRON;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(
        haut[0] + rayon / 3,
        haut[1] - rayon / 3,
        Math.max(2, rayon / 4),
        0,
        Math.PI * 2
    );
    ctx.fillStyle = VERT_SERPENT;
    ctx.fill();
}

/*
 * Convertit la case de la pomme en centre de pixels avant de réutiliser son dessin.
 */
export function dessinerPomme(caseGrille) {
    dessinerPommeCentree(centreCase(caseGrille), TAILLE_CASE / 2 - 4);
}

/*
 * Dessine un segment à l'intérieur d'une case avec une petite marge.
 */
export function dessinerSegment(caseGrille, couleur) {
    const rect = rectangleCase(caseGrille);

    rectangleArrondi(
        rect.x + 2,
        rect.y + 2,
        rect.largeur - 4,
        rect.hauteur - 4,
        8,
        couleur,
        CONTOUR_SERPENT,
        2
    );
}

/*
 * Place les yeux latéralement et les pupilles vers la direction du déplacement.
 */
export function dessinerYeux(caseGrille, directionActuelle) {
    const lateral = perpendiculaire(directionActuelle);
    const avant = pointDecale(centreCase(caseGrille), directionActuelle, 4);

    [-1, 1].forEach((cote) => {
        const oeil = pointDecale(avant, lateral, cote * 6);
        const pupille = pointDecale(oeil, directionActuelle, 1);

        ctx.beginPath();
        ctx.arc(oeil[0], oeil[1], 4, 0, Math.PI * 2);
        ctx.fillStyle = BLANC;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(pupille[0], pupille[1], 2, 0, Math.PI * 2);
        ctx.fillStyle = NOIR;
        ctx.fill();
    });
}

/*
 * Dessine la langue devant la tête, puis ses deux branches latérales.
 */
export function dessinerLangue(caseGrille, directionActuelle) {
    const lateral = perpendiculaire(directionActuelle);
    const base = pointDecale(centreCase(caseGrille), directionActuelle, TAILLE_CASE / 2 - 2);
    const pointe = pointDecale(base, directionActuelle, 10);

    ctx.beginPath();
    ctx.moveTo(base[0], base[1]);
    ctx.lineTo(pointe[0], pointe[1]);
    ctx.strokeStyle = ROUGE_LANGUE;
    ctx.lineWidth = 3;
    ctx.stroke();

    [-1, 1].forEach((cote) => {
        const bout = pointDecale(pointDecale(pointe, directionActuelle, 5), lateral, cote * 4);

        ctx.beginPath();
        ctx.moveTo(pointe[0], pointe[1]);
        ctx.lineTo(bout[0], bout[1]);
        ctx.strokeStyle = ROUGE_LANGUE;
        ctx.lineWidth = 2;
        ctx.stroke();
    });
}

/*
 * Dessine le corps depuis la queue, puis la langue, la tête et les yeux.
 * slice crée une copie avant reverse pour ne pas inverser le serpent réel.
 */
export function dessinerSerpent() {
    state.serpent.slice(1).reverse().forEach((caseGrille) => {
        dessinerSegment(caseGrille, VERT_SERPENT);
    });

    dessinerLangue(state.serpent[0], state.direction);
    dessinerSegment(state.serpent[0], VERT_TETE);
    dessinerYeux(state.serpent[0], state.direction);
}

/*
 * Affiche le score et le record ; measureText calcule la place nécessaire au texte.
 */
export function dessinerBandeau() {
    ctx.fillStyle = FOND;
    ctx.fillRect(0, 0, LARGEUR_FENETRE, HAUTEUR_BANDEAU);

    ctx.strokeStyle = VERT_FORET;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, HAUTEUR_BANDEAU - 2);
    ctx.lineTo(LARGEUR_FENETRE, HAUTEUR_BANDEAU - 2);
    ctx.stroke();

    dessinerPommeCentree([30, HAUTEUR_BANDEAU / 2 + 3], 12);
    texte(t.apples(state.score), 52, 20, 30, BLANC);

    ctx.font = "30px Avenir, 'Avenir Next', sans-serif";
    const libelle = t.best(state.meilleurScore);
    const largeur = ctx.measureText(libelle).width;
    const xTexte = LARGEUR_FENETRE - largeur - 20;

    texte(libelle, xTexte, 20, 30, BLANC);
    dessinerEtoile([xTexte - 18, HAUTEUR_BANDEAU / 2], 11);
}
