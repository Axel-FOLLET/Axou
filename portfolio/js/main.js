/*
 * Point d'entrée de toutes les pages : chaque module vérifie lui-même
 * si les éléments dont il a besoin existent sur la page, sinon il ne fait rien.
 */
import { initNavigation } from "./modules/navigation.js";
import { initSkills } from "./modules/skills.js";
import { initContact } from "./modules/contact.js";
import { initLanguage } from "./modules/language.js";
import { initCubes } from "./modules/cubes/init-cubes.js";
import { initProjectShowcase } from "./modules/project-showcase.js";
import { initRepos } from "./modules/repos.js";
import { initTimeline } from "./modules/timeline.js";
import { initProjectDemos } from "./modules/project-demos.js";
import { initReveal } from "./modules/reveal.js";
import { initHumanCheck } from "./modules/human-check.js";

initHumanCheck();
initNavigation();
initReveal();
initSkills();
initContact();
initLanguage();
initCubes();
initRepos();
initTimeline();
const language = document.documentElement.lang === "en" ? "en" : "fr";
initProjectShowcase(language);
initProjectDemos(language);
