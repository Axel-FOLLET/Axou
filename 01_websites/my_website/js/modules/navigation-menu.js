/*
 * Page interactions: this module exposes its initialisation functions.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
/*
 * Installs the interactions of the mobile menu: click, choice of a link, Escape, focus leaving and click elsewhere.
 * The classes drive the CSS; the ARIA attributes describe the same state to screen readers.
 */
export function initNavigationMenu() {
    const navigation = document.querySelector(".header__nav");
    const toggle = document.querySelector(".header__toggle");
    const links = document.querySelector(".header__links");

    if (!navigation || !toggle || !links) {
        return;
    }

    const isEnglish = document.documentElement.lang === "en";

    /*
     * isOpen is a boolean: true opens the menu, false closes it.
     * The second argument of toggle imposes that state instead of simply inverting it.
     */
    function setMenuOpen(isOpen) {
        navigation.classList.toggle("header__nav--open", isOpen);
        /*
         * ARIA expects text: String converts the boolean into "true" or "false".
         */
        toggle.setAttribute("aria-expanded", String(isOpen));
        toggle.setAttribute(
            "aria-label",
            isOpen
                ? (isEnglish ? "Close navigation menu" : "Fermer le menu de navigation")
                : (isEnglish ? "Open navigation menu" : "Ouvrir le menu de navigation")
        );
    }

    toggle.addEventListener("click", function() {
        setMenuOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    links.addEventListener("click", function(event) {
        /*
         * closest also finds the link if the click hits one of its child elements.
         */
        if (event.target.closest("a")) {
            setMenuOpen(false);
        }
    });

    document.addEventListener("keydown", function(event) {
        if (event.key === "Escape" && isMenuOpen()) {
            setMenuOpen(false);
            toggle.focus();
        }
    });

    /*
     * The open menu is made of the button and the links. In the HTML, the identity (Home, language)
     * sits between the two: Tab on the button leads straight to the first link,
     * Shift+Tab on the first link goes back to the button.
     */
    function isMenuOpen() {
        return navigation.classList.contains("header__nav--open");
    }

    function isInMenu(node) {
        return node instanceof Node && (toggle.contains(node) || links.contains(node));
    }

    toggle.addEventListener("keydown", function(event) {
        const firstLink = links.querySelector("a");
        if (event.key === "Tab" && !event.shiftKey && isMenuOpen() && firstLink) {
            event.preventDefault();
            firstLink.focus();
        }
    });

    links.addEventListener("keydown", function(event) {
        if (event.key === "Tab" && event.shiftKey && isMenuOpen() && event.target === links.querySelector("a")) {
            event.preventDefault();
            toggle.focus();
        }
    });

    /*
     * The focus leaves the menu (Tab after the last link, Shift+Tab before the button, focus set elsewhere): the menu closes.
     * relatedTarget is the element receiving the focus; it is null when the focus goes nowhere
     * (for example when clicking a link in Safari, which does not give it focus): that case is left to the click.
     */
    navigation.addEventListener("focusout", function(event) {
        if (isMenuOpen() && event.relatedTarget && !isInMenu(event.relatedTarget)) {
            setMenuOpen(false);
        }
    });

    /*
     * A press (mouse, finger, stylus) outside the button and the links closes the menu.
     */
    document.addEventListener("pointerdown", function(event) {
        if (isMenuOpen() && !isInMenu(event.target)) {
            setMenuOpen(false);
        }
    });

    /*
     * Listens to the crossing of the breakpoint, not to every pixel of resizing.
     */
    window.matchMedia("(max-width: 1024px)").addEventListener("change", function(event) {
        if (!event.matches) {
            setMenuOpen(false);
        }
    });
}