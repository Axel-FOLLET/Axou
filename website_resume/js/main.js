import { translations } from "./data/translations.js";
import { initExperience } from "./modules/experience.js";
import { initSkills } from "./modules/skills.js";
import { initLanguage } from "./modules/language.js";
import { initCubes } from "./modules/cubes/init-cubes.js";
import { initGameModal } from "./modules/game-modal.js";
import { initNavigationMenu } from "./modules/navigation-menu.js";

// Détermine la langue de la page à partir de l'attribut lang de la balise <html>.
// Si la page n'est pas explicitement en anglais, le français est utilisé par défaut.
const language = document.documentElement.lang === "en" ? "en" : "fr";

// Active le menu de navigation, notamment sur les écrans de petite taille.
initNavigationMenu();

// Ajoute les expériences dans la page avec les textes de la langue sélectionnée.
initExperience(translations[language].experience);

// Ajoute les compétences avec leurs informations traduites.
initSkills(translations[language].skills);

// Initialise le changement de langue de l'interface.
initLanguage();

// Initialise les cubes interactifs présents sur la page.
initCubes();

// Prépare la fenêtre modale des jeux et lui transmet la langue actuelle.
initGameModal(language);
