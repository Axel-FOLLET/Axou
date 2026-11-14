/*
 * Header of the multi-page site: mobile menu, compact header on scroll,
 * name of the current tab copied into the mobile header.
 * The current tab (aria-current="page") and the language link to the equivalent page
 * are written in the HTML of each page: no section tracking here.
 */
import { initNavigationMenu } from "./navigation-menu.js";

/*
 * Thresholds of the compact header, in scrolled pixels. The gap between the two avoids flickering:
 * by shrinking, the header makes the page move up by about twenty pixels.
 */
const COMPACT_FROM = 80;
const EXPAND_UNDER = 20;


/*
 * Makes the header compact when the page scrolls, gives it back its size when returning to the top.
 * passive: true promises the browser that the listener does not block scrolling.
 */
function watchScroll(header) {
    function update() {
        if (window.scrollY > COMPACT_FROM) header.classList.add("header--compact");
        else if (window.scrollY < EXPAND_UNDER) header.classList.remove("header--compact");
    }
    window.addEventListener("scroll", update, { passive: true });
    update();
}


/*
 * Copies the name of the current tab into the mobile header, if the HTML left it empty.
 */
function showCurrentTab(header) {
    const current = header.querySelector(".header__current");
    const link = header.querySelector('.header__link[aria-current="page"]');
    if (current && link && !current.textContent.trim()) current.textContent = link.textContent;
}


/*
 * Enables the mobile menu, the compact header and the name of the current tab.
 */
export function initNavigation() {
    initNavigationMenu();
    const header = document.querySelector(".header");
    if (!header) return;
    watchScroll(header);
    showCurrentTab(header);
}
