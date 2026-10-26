/*
 * Point d'entrée des deux langues : chaque module vérifie lui-même
 * si les éléments dont il a besoin existent sur la page, sinon il ne fait rien.
 * Les textes propres à une langue sont dans le HTML (attributs data-*) ou suivent l'attribut lang de <html>.
 */
import { initNavigation } from "./modules/navigation.js";
import { initReveal } from "./modules/reveal.js";
import { initContact } from "./modules/contact.js";
import { initCubes } from "./modules/cubes/init-cubes.js";
import { initTimeline } from "./modules/timeline.js";
import { initMotion } from "./modules/motion.js";

// Menu mobile, en-tête compact au défilement et section affichée marquée dans le menu
initNavigation();

// Sections qui apparaissent en fondu à leur arrivée à l'écran
initReveal();

// Finitions communes avec le portfolio : cascade, trait du menu, entrée de l'accueil, survols des cartes (après initReveal)
initMotion();

// Formulaire de contact : validation, fenêtre anti-robot à l'envoi, envoi sans quitter la page
initContact();

// Cubes 3D de toute la page
initCubes();

// Frise des expériences : trait qui suit le défilement, étapes qui apparaissent
initTimeline();
