/*
 * Point d'entrée de toutes les pages : chaque module vérifie lui-même
 * si les éléments dont il a besoin existent sur la page, sinon il ne fait rien.
 */
import { initNavigation } from "./modules/navigation.js";
import { initSkills } from "./modules/skills.js";
import { initContact } from "./modules/contact.js";
import { initLanguage } from "./modules/language.js";
import { initCubes } from "./modules/cubes/init-cubes.js";
import { initGameModal } from "./modules/game-modal.js";
import { initRepos } from "./modules/repos.js";

initNavigation();
initSkills();
initContact();
initLanguage();
initCubes();
initRepos();
initGameModal(document.documentElement.lang === "en" ? "en" : "fr");
