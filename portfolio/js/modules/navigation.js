import { initNavigationMenu } from "./navigation-menu.js";

export function initNavigation() {
    initNavigationMenu();
    const navLinks = document.querySelectorAll(".header__link");

/*
    IntersectionObserver prévient quand une section entre
    dans la zone centrale de l'écran. Le lien correspondant
    reçoit alors aria-current="page" : le visiteur sait
    toujours où il se trouve.
*/
const observedSections = document.querySelectorAll("#home, #projects, #skills, #contact");

const sectionObserver = new IntersectionObserver(function(entries) {

    entries.forEach(function(entry) {

        if (entry.isIntersecting) {

            navLinks.forEach(function(link) {

                if (link.getAttribute("href") === "#" + entry.target.id) {

                    link.setAttribute("aria-current", "page");

                } else {

                    link.removeAttribute("aria-current");

                }

            });

        }

    });

}, { rootMargin: "-40% 0px -55% 0px" });

observedSections.forEach(function(section) {

    sectionObserver.observe(section);

});

}
