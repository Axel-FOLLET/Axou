/*
 * Settings shared by both games, taken from the site: font, colours, reduced motion, touch screen.
 * Colours come from css/base/tokens.css (the Snake greens included, section "Games"), loaded
 * by the page before this module: the games follow the site.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */

/* Site text font, declared by css/components/game-player.css; sans-serif is used if it is missing */
export const FONT_FAMILY = "Manrope, sans-serif";

/*
 * Reads a site colour variable (form #RRGGBB) and returns its value, with the requested opacity.
 * getComputedStyle gives the value computed by the browser, here the one on :root.
 * A value that is not a #RRGGBB colour (an rgba() token for example) is returned as it is.
 */
const styles = getComputedStyle(document.documentElement);

export function siteColor(variable, opacity = 1) {
    const value = styles.getPropertyValue(variable).trim();
    const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);

    if (!hex || opacity === 1) {
        return value;
    }

    const [red, green, blue] = hex.slice(1).map((pair) => parseInt(pair, 16));
    return `rgba(${red},${green},${blue},${opacity})`;
}

/* System "reduce motion" setting: decorative effects stop moving */
export const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/* Touch screen without hover: instructions talk about touching the screen instead of keyboard keys */
export const touchScreen = window.matchMedia("(hover: none) and (pointer: coarse)");

/*
 * Waits for Manrope before the first drawing: the canvas does not always trigger its download,
 * and it measures and draws texts with the font ready at that moment (otherwise the fallback font).
 * After 3 s, or if the file is missing, the game starts anyway with the fallback font.
 */
export function waitForFont() {
    const loading = document.fonts.load(`30px ${FONT_FAMILY}`).catch(() => []);
    const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
    return Promise.race([loading, timeout]);
}
