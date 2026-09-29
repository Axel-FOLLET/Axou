import { translations } from "./data/translations.js";
import { initExperience } from "./modules/experience.js";
import { initLanguage } from "./modules/language.js";
import { initCubes } from "./modules/cubes/init-cubes.js";
import { initGameModal } from "./modules/game-modal.js";
import { initNavigationMenu } from "./modules/navigation-menu.js";
import { initContactForm } from "./modules/contact-form.js";
import { initSectionTracker } from "./modules/section-tracker.js";
import { initReveal } from "./modules/reveal.js";
import { initTimeline } from "./modules/timeline.js";

// Détermine la langue de la page à partir de l'attribut lang de la balise <html>.
// Si la page n'est pas explicitement en anglais, le français est utilisé par défaut.
const language = document.documentElement.lang === "en" ? "en" : "fr";

// Active le menu de navigation (écrans de petite taille) et l'en-tête compact au défilement.
initNavigationMenu();

// Fait apparaître les sections en fondu à leur arrivée à l'écran.
initReveal();

// Met en valeur dans le menu la section en cours de lecture.
initSectionTracker();

// Frise des expériences : flèche qui suit le défilement, étapes qui apparaissent, compétences dépliables.
initTimeline();
initExperience();

// Ajoute les compétences avec leurs informations traduites.

// Initialise le changement de langue de l'interface.
initLanguage();

// Initialise les cubes interactifs présents sur la page.
initCubes();

// Prépare la fenêtre modale des jeux et lui transmet la langue actuelle.
initGameModal(language);

// Envoie le formulaire de contact sans quitter la page et affiche son état.
initContactForm(translations[language].contact);
