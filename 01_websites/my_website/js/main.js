/*
 * Single entry point of the site pages (home, My background, My portfolio, Contact me, 404 page).
 * The games (pages/games/) have their own entry point.
 *
 * Two kinds of modules:
 * - imported upfront: those of every page and the cubes, visible from the first paint.
 *   blocking="render" (in <head>) holds the first paint until they have run;
 * - downloaded on demand (import()): those of a single page, only if it contains their element.
 *   The first paint does not wait for them: none of them touches the top of its page (measured in mission T04, CLS = 0).
 * Each module still checks its own elements and does nothing if they are missing.
 */
import { initNavigation } from "./modules/navigation.js";
import { initReveal } from "./modules/reveal.js";
import { initMotion } from "./modules/motion.js";
import { initScrollWords, initHeroParallax } from "./modules/scroll-motion.js";
import { initCubes } from "./modules/cubes/init-cubes.js";

// True if the page contains at least one element matching the selector
const has = selector => document.querySelector(selector) !== null;

// Single-page modules, all requested at the same time from the start (null when the page does not need them)
const pageModules = Promise.all([
    has("#contact-form") ? import("./modules/contact.js") : null,
    has(".cat-figure") ? import("./modules/cat.js") : null,
    has(".timeline") ? import("./modules/timeline.js") : null,
    has(".showcase") ? import("./modules/project-showcase.js") : null,
    has(".demo--language, .demo--cipher") ? import("./modules/project-demos.js") : null,
    has(".showcase") ? import("./modules/card-scenes.js") : null,
    has(".postman") ? import("./modules/postman-cube.js") : null,
    has("#career-change") ? import("./modules/career-shift.js") : null,
]);

// Mobile menu, header that shrinks on scroll and name of the page tab in the mobile header
initNavigation();

// Sections that fade in when they reach the screen
initReveal();

// Shared finishing touches: cascade, home entrance, card hovers (after initReveal)
initMotion();

// Introduction texts that light up word by word while scrolling (scroll.css)
initScrollWords();

// 3D cubes of the page
initCubes();

// Home cubes that follow the mouse, each at its own distance: depth effect (scroll.css)
initHeroParallax();

// Top-level await: the rest starts once the page modules have arrived, in the same order as before
const [contact, cat, timeline, showcase, demos, scenes, postman, careerShift] = await pageModules;

// Contact form: validation, anti-robot window on sending, sending without leaving the page
contact?.initContact();

// Postman cube of the Contact me page: one face per filled field, it leaves with the message
postman?.initPostmanCube();

// Career change scene of the My background page: the HR words give way to the IT words
careerShift?.initCareerShift();

// Faceted cat of the Lost card (My portfolio page): it turns with a finger or the mouse, then comes back to face us
cat?.initCat();

// Experience timeline: thread drawn by the scroll down to the career-change banner, blue cube at its head, steps that light up
timeline?.initTimeline();

// Language of the page, read on <html lang>, for the texts written by the project modules
const language = document.documentElement.lang === "en" ? "en" : "fr";

// Animated scenes of the project cards: listening before the wheel starts, which sends its first centre card
scenes?.initCardScenes(language);

// Project wheel: cards in perspective, filters, "Play" and "Try it" that widen the centre card
showcase?.initProjectShowcase(language);

// Project demos: computing the results of the tools opened by "Try it"
demos?.initProjectDemos(language);
