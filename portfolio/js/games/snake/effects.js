/*
 * Animation décorative du record : position, vitesse, gravité et durée de vie des particules.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
import { ctx } from "./canvas.js";
import { CHANCE_EXPLOSION, COULEURS_FEUX, DUREE_PARTICULE, GRAVITE_PARTICULE, LARGEUR_FENETRE, PARTICULES_PAR_EXPLOSION } from "./constants.js";
import { state } from "./state.js";

/*
 * Renvoie une particule avec sa position, sa vitesse et sa durée de vie.
 * sin et cos répartissent sa vitesse sur les axes x et y.
 */
export function creerParticule(x, y, couleur) {
    const angle = Math.random() * 2 * Math.PI;
    const vitesse = 1 + Math.random() * 3;

    return {
        x: x,
        y: y,
        vx: Math.cos(angle) * vitesse,
        vy: Math.sin(angle) * vitesse,
        vie: DUREE_PARTICULE,
        couleur: couleur
    };
}

/*
 * Crée les particules d'une explosion autour du point x, y et renvoie leur tableau.
 */
export function creerExplosion(x, y) {
    const couleur = COULEURS_FEUX[Math.floor(Math.random() * COULEURS_FEUX.length)];
    const nouvelles = [];

    for (let i = 0; i < PARTICULES_PAR_EXPLOSION; i += 1) {
        nouvelles.push(creerParticule(x, y, couleur));
    }

    return nouvelles;
}

/*
 * Met à jour les particules selon deltaFrames, exprimé en images équivalentes à 60 Hz.
 * Applique la gravité et retire les particules dont la durée de vie est écoulée.
 */
export function animerFeuxArtifice(deltaFrames) {
    if (Math.random() < CHANCE_EXPLOSION * deltaFrames) {
        const x = 80 + Math.random() * (LARGEUR_FENETRE - 160);
        const y = 80 + Math.random() * 220;
        state.particules.push(...creerExplosion(x, y));
    }

    state.particules.forEach((particule) => {
        particule.x += particule.vx * deltaFrames;
        particule.y += particule.vy * deltaFrames;
        particule.vy += GRAVITE_PARTICULE * deltaFrames;
        particule.vie -= deltaFrames;
    });

    /*
     * filter produit un nouveau tableau contenant uniquement les particules encore vivantes.
     */
    state.particules = state.particules.filter((particule) => particule.vie > 0);
}

/*
 * Dessine chaque particule encore présente ; son rayon diminue avec sa durée de vie.
 */
export function dessinerParticules() {
    state.particules.forEach((particule) => {
        const rayon = 2 + 2 * particule.vie / DUREE_PARTICULE;

        ctx.beginPath();
        ctx.arc(particule.x, particule.y, Math.max(1, rayon), 0, Math.PI * 2);
        ctx.fillStyle = particule.couleur;
        ctx.fill();
    });
}
