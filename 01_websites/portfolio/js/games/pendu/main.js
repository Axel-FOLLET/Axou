/*
 * Point d'entrée : relie les modules puis démarre les interactions dans l'ordre indiqué.
 * export rend une valeur utilisable ailleurs ; import récupère uniquement les noms nécessaires.
 */
import { animation } from "./animation.js";
import { canvas } from "./canvas.js";
import { initControls } from "./controls.js";
import { preparerNouveauMot } from "./rules.js";

preparerNouveauMot();
initControls();
requestAnimationFrame(animation);
/*
 * Programme le focus après le travail synchrone de démarrage, une fois le canvas ajouté.
 */
setTimeout(() => canvas.focus(), 0);
