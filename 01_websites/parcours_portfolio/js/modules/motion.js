/*
 * Motion finishing touches shared by the pages of the site (styles in motion.css):
 * cascade reveal, magnetic buttons,
 * entrance of the opening, reveal of the large titles, bars of the method, details of the timeline,
 * encryption of the data-hover="cipher" cards and language switch of the data-hover="language" cards.
 * Each part checks that its elements exist: the file works as is on every page.
 * With reduced motion: no cascade, no magnetism, no entrance, no reveal of the titles, no bars,
 * no encryption, no language switch.
 */

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)");

/*
 * Repeated sets that appear one after the other: timeline steps, link cards and tags.
 * The practices of the method and the rows of the fields have their own entrance (bars of the method). The cards of the project wheel are not included:
 * project-showcase.js already places and filters them, a second animation would get in their way.
 */
const STAGGER_ITEMS = ".timeline__step, .link-list > li, .tag";

/* Maximum move of a magnetic button, and share of the remaining way covered at each frame */
const MAGNET_MAX = 6;
const MAGNET_EASE = 0.18;

/* Hovers kept for the mouse and the touchpad: with a finger, a hover never really ends */
const FINE_HOVER = window.matchMedia("(hover: hover) and (pointer: fine)");

/* Caesar cipher: shift of 3 letters, like the historical example, one letter every 45 ms */
const CIPHER_SHIFT = 3;
const CIPHER_STEP_MS = 45;

/* Language switch: one word every 550 ms, the time to read it */
const LANGUAGE_STEP_MS = 550;

/* Large titles that rise line by line: sections, career change (resume), method (portfolio), footer */
const TITLES = ".section__title, .career__intro h2, .method__title";

/* Practices of the method (portfolio): their rule is drawn, then their text comes out of it */
const METHOD_ITEMS = ".method__item, .domains__item";



/* -------------------- CASCADE REVEAL -------------------- */

/*
 * Numbers the repeated elements of each block animated by reveal.js (class reveal):
 * --i is their rank among the siblings of the same list, motion.css derives the delay from it.
 * At the end of the animation, the class and the rank are removed: a filter or a new display does not replay it.
 */
function initStagger() {
    if (REDUCED_MOTION.matches) return;
    const ranks = new Map();
    document.querySelectorAll(".reveal").forEach(part => {
        part.querySelectorAll(STAGGER_ITEMS).forEach(item => {
            const rank = ranks.get(item.parentElement) ?? 0;
            ranks.set(item.parentElement, rank + 1);
            item.style.setProperty("--i", rank);
            item.classList.add("motion-stagger");
            item.addEventListener("animationend", function done(event) {
                if (event.target !== item) return;
                item.classList.remove("motion-stagger");
                item.style.removeProperty("--i");
                item.removeEventListener("animationend", done);
            });
        });
    });
}


/* -------------------- MAGNETIC BUTTONS -------------------- */

/*
 * The button slides by a few pixels towards the pointer, at most MAGNET_MAX, then comes back smoothly.
 * Each frame covers a share of the remaining way (MAGNET_EASE): a damped movement without a CSS transition,
 * which therefore does not replace the transitions of the button. transform stays free: press (scale)
 * and error shake (translate) use their own properties.
 */
function attachMagnet(button) {
    let target = { x: 0, y: 0 };
    let current = { x: 0, y: 0 };
    let frame = 0;

    function step() {
        current.x += (target.x - current.x) * MAGNET_EASE;
        current.y += (target.y - current.y) * MAGNET_EASE;
        const settled = Math.abs(target.x - current.x) < 0.05 && Math.abs(target.y - current.y) < 0.05;
        if (settled) current = { ...target };
        /* Back at rest: the style is removed, the button becomes ordinary again */
        if (settled && !current.x && !current.y) button.style.removeProperty("transform");
        else button.style.transform = `translate(${current.x.toFixed(2)}px, ${current.y.toFixed(2)}px)`;
        frame = settled ? 0 : requestAnimationFrame(step);
    }

    function moveTo(x, y) {
        target = { x, y };
        if (!frame) frame = requestAnimationFrame(step);
    }

    /*
     * Gap between the pointer and the centre of the button at rest (its measured position minus the current shift),
     * brought back between -1 and 1 on each axis, then multiplied by MAGNET_MAX.
     */
    button.addEventListener("pointermove", event => {
        if (event.pointerType !== "mouse" || REDUCED_MOTION.matches || button.disabled) return;
        const box = button.getBoundingClientRect();
        const x = (event.clientX - box.left + current.x - box.width / 2) / (box.width / 2);
        const y = (event.clientY - box.top + current.y - box.height / 2) / (box.height / 2);
        const clamp = value => Math.max(-1, Math.min(1, value));
        moveTo(clamp(x) * MAGNET_MAX, clamp(y) * MAGNET_MAX);
    });
    button.addEventListener("pointerleave", () => moveTo(0, 0));
}


/*
 * Only with a mouse or a precise touchpad (hover and pointer: fine):
 * with a finger, the button must not move under the finger.
 */
function initMagnets() {
    if (!FINE_HOVER.matches) return;
    document.querySelectorAll(".button--primary").forEach(attachMagnet);
}


/* -------------------- ENTRANCE OF THE OPENING -------------------- */

/*
 * Wraps each word of the title in a mask, without touching the text: the spaces stay
 * text nodes between the masks, the line breaks and textContent do not change.
 * The spans are neutral for screen readers: the title keeps its accessible name.
 * The children (br, span) are walked too: only the text nodes are split.
 * Only breaking spaces separate two words: a non-breaking space ("contexte&nbsp;:") stays inside the mask,
 * because between two masks (inline-block) it would no longer prevent the break and the title would change lines when the masks are removed.
 */
function wrapWords(element) {
    const masks = [];
    const texts = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) texts.push(walker.currentNode);
    texts.forEach(text => {
        const fragment = document.createDocumentFragment();
        text.data.split(/([ \t\n\r\f]+)/).forEach(part => {
            if (!part) return;
            if (/^[ \t\n\r\f]+$/.test(part)) {
                fragment.append(part);
                return;
            }
            const mask = document.createElement("span");
            const word = document.createElement("span");
            mask.className = "motion-intro__mask";
            word.className = "motion-intro__word";
            word.textContent = part;
            mask.append(word);
            fragment.append(mask);
            masks.push(mask);
        });
        text.replaceWith(fragment);
    });
    return masks;
}


/*
 * Line rank of each word, from its real position on screen: a word lower
 * than the previous one (by more than 2 px) starts a new line. Done again on resize
 * and when the font loads, which can move the line breaks.
 */
function measureLines(hero, masks) {
    let line = -1;
    let top = -Infinity;
    masks.forEach(mask => {
        const maskTop = mask.getBoundingClientRect().top;
        if (maskTop > top + 2) {
            line += 1;
            top = maskTop;
        }
        mask.style.setProperty("--line", line);
    });
    hero.style.setProperty("--lines", line + 1);
}


/*
 * The name rises line by line, then the elements that follow it (role, sentence, button) fade in.
 * The page waits for main.js before it is displayed (blocking="render"): the class is set before the first frame,
 * the text never appears before its animation.
 * Once all the animations are over (or interrupted), the class and the ranks are removed:
 * the title becomes ordinary text again and the measurements stop.
 */
function initIntro() {
    if (REDUCED_MOTION.matches) return;
    const hero = document.querySelector(".hero");
    const title = hero?.querySelector("h1");
    if (!title) return;
    const masks = wrapWords(title);
    const followers = [];
    for (let element = title.nextElementSibling; element; element = element.nextElementSibling) followers.push(element);
    followers.forEach((element, index) => {
        element.classList.add("motion-intro__follow");
        element.style.setProperty("--i", index);
    });
    const remeasure = () => measureLines(hero, masks);
    measureLines(hero, masks);
    hero.classList.add("motion-intro");
    window.addEventListener("resize", remeasure);
    document.fonts?.ready.then(() => {
        if (hero.classList.contains("motion-intro")) remeasure();
    });

    const animations = hero.getAnimations({ subtree: true })
        .filter(animation => animation.animationName?.startsWith("motion-intro"));
    Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
        hero.classList.remove("motion-intro");
        hero.style.removeProperty("--lines");
        masks.forEach(mask => mask.style.removeProperty("--line"));
        followers.forEach(element => {
            element.classList.remove("motion-intro__follow");
            element.style.removeProperty("--i");
        });
        window.removeEventListener("resize", remeasure);
    });
}


/* -------------------- REVEAL OF THE TITLES -------------------- */

/*
 * The words of each large title wait under their mask (motion-title), then rise line by line
 * when the title enters the screen (motion-title--play). The lines are measured at that moment: the font is loaded.
 * Once the rises are over (or interrupted), the classes and the ranks are removed, as for the opening.
 */
function playTitle(title, masks) {
    measureLines(title, masks);
    title.classList.add("motion-title--play");
    const transitions = title.getAnimations({ subtree: true })
        .filter(animation => animation.transitionProperty === "translate");
    Promise.allSettled(transitions.map(transition => transition.finished)).then(() => {
        title.classList.remove("motion-title", "motion-title--play");
        title.style.removeProperty("--lines");
        masks.forEach(mask => mask.style.removeProperty("--line"));
    });
}


function initTitles() {
    if (REDUCED_MOTION.matches || !("IntersectionObserver" in window)) return;
    const titles = new Map();
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            observer.unobserve(entry.target);
            playTitle(entry.target, titles.get(entry.target));
        });
    }, { rootMargin: "0px 0px -10% 0px" });
    document.querySelectorAll(TITLES).forEach(title => {
        titles.set(title, wrapWords(title));
        title.classList.add("motion-title");
        observer.observe(title);
    });
}


/* -------------------- BARS OF THE METHOD -------------------- */

/*
 * motion.js sets motion-bar on each practice of the method and each row of the fields (My background): the rule is folded, the text waits above it.
 * --bar-h, the height of the practice, is the distance of the descent: cube, name and text come down in a single block.
 * ResizeObserver keeps it up to date until the start (fonts loaded, window resized), before each display.
 * When the practice enters the screen, motion-bar--play draws the rule from left to right, then cube, name and text
 * come out of the rule downwards (motion.css). The practices of a same row arrive together:
 * --bar-i, their rank in that batch, makes them start one after the other.
 * At the end of the descent of the text, or if it is interrupted, the classes are removed: the practice becomes ordinary again.
 */
function initMethodBars() {
    if (REDUCED_MOTION.matches || !("IntersectionObserver" in window) || !("ResizeObserver" in window)) return;
    const sizes = new ResizeObserver(entries => {
        entries.forEach(entry => entry.target.style.setProperty("--bar-h", `${entry.borderBoxSize[0].blockSize}px`));
    });
    const observer = new IntersectionObserver(entries => {
        entries.filter(entry => entry.isIntersecting).forEach((entry, rank) => {
            const item = entry.target;
            observer.unobserve(item);
            sizes.unobserve(item);
            item.style.setProperty("--bar-i", rank);
            item.classList.add("motion-bar--play");
            function done(event) {
                if (event.propertyName !== "translate" || event.target !== item.lastElementChild) return;
                item.classList.remove("motion-bar", "motion-bar--play");
                ["--bar-i", "--bar-h"].forEach(name => item.style.removeProperty(name));
                ["transitionend", "transitioncancel"].forEach(type => item.removeEventListener(type, done));
            }
            ["transitionend", "transitioncancel"].forEach(type => item.addEventListener(type, done));
        });
    }, { rootMargin: "0px 0px -10% 0px" });
    document.querySelectorAll(METHOD_ITEMS).forEach(item => {
        item.classList.add("motion-bar");
        sizes.observe(item);
        observer.observe(item);
    });
}


/* -------------------- DETAILS OF THE TIMELINE -------------------- */

/*
 * In each timeline step, the elements of the content (timeline__content) get the class timeline__detail
 * and their rank --i: motion.css settles them one after the other when the step lights up.
 * Without a wrapped content, they are the children of the step, except the number and the date.
 */
function initTimelineDetails() {
    if (REDUCED_MOTION.matches) return;
    document.querySelectorAll(".timeline__step").forEach(step => {
        const content = step.querySelector(".timeline__content");
        const details = content
            ? Array.from(content.children)
            : Array.from(step.children).filter(child => !child.matches(".timeline__number, .timeline__date"));
        details.forEach((detail, index) => {
            detail.classList.add("timeline__detail");
            detail.style.setProperty("--i", index);
        });
    });
}


/* -------------------- WIDTH OF THE CHANGING WORDS -------------------- */

/*
 * Reserves, once and before any hover, the width of the widest form a word can take (motion audit M-02):
 * the encrypted or translated word is drawn over the original one, and a wider form overlapped the next word.
 * Measured in a hidden probe placed inside the word (same font), with offsetWidth, which ignores the scale
 * of the wheel; kept in em so that it follows the font size of the title at every width of the screen.
 * Done once the fonts are loaded: a fallback font would give other widths.
 */
function reserveWidth(element, forms) {
    const apply = () => {
        const probe = document.createElement("span");
        probe.setAttribute("aria-hidden", "true");
        probe.style.cssText = "position: absolute; visibility: hidden; white-space: nowrap;";
        element.append(probe);
        const widest = Math.max(...forms.map(form => {
            probe.textContent = form;
            return probe.offsetWidth;
        }));
        probe.remove();
        const size = parseFloat(getComputedStyle(element).fontSize) || 16;
        element.style.display = "inline-block";
        element.style.minWidth = `${(Math.ceil((widest + 1) / size * 100) / 100)}em`;
    };
    if (document.fonts) document.fonts.ready.then(apply);
    else apply();
}


/* -------------------- ENCRYPTION ON HOVER -------------------- */

/*
 * Shifts a letter by shift ranks in the alphabet, keeping its case.
 * An accented letter is encrypted without its accent (é becomes h); the other signs do not change.
 */
function shiftLetter(character, shift) {
    const letter = character.normalize("NFD")[0];
    if (!/[a-z]/i.test(letter)) return character;
    const start = letter === letter.toUpperCase() ? 65 : 97;
    return String.fromCharCode((letter.charCodeAt(0) - start + shift) % 26 + start);
}


/*
 * Without a key: Caesar by CIPHER_SHIFT ranks. With the data-cipher-vigenere key: Vigenère,
 * each letter is shifted by the next letter of the key (A = 0), which only moves on with letters.
 */
function encode(characters, key) {
    let rank = 0;
    return characters.map(character => {
        if (!key) return shiftLetter(character, CIPHER_SHIFT);
        if (!/[a-z]/i.test(character.normalize("NFD")[0])) return character;
        const shift = key.toUpperCase().charCodeAt(rank % key.length) - 65;
        rank += 1;
        return shiftLetter(character, shift);
    });
}


/*
 * On hovering the card, the letters of the data-cipher word are encrypted one by one; when leaving it,
 * they come back one by one. The displayed word goes through data-cipher-shown (motion.css):
 * the text of the page never changes, screen readers and the announcement of the wheel always read the original.
 * Without any encrypted letter, the attribute is removed and the word becomes ordinary again.
 * A word marked data-cipher-off waits for its turn: the cipher demo picks the word from the method
 * and tells the card through the cipherchange event.
 */
function attachCipher(card) {
    const words = Array.from(card.querySelectorAll("[data-cipher]")).map(element => {
        const plain = Array.from(element.textContent);
        return { element, plain, coded: encode(plain, element.dataset.cipherVigenere) };
    });
    words.forEach(({ element, plain, coded }) => reserveWidth(element, [plain.join(""), coded.join("")]));
    let count = 0;
    let target = 0;
    let timer = 0;

    const isOn = word => !word.element.hasAttribute("data-cipher-off");
    const length = () => Math.max(0, ...words.filter(isOn).map(word => word.plain.length));

    function render() {
        words.forEach(word => {
            const { element, plain, coded } = word;
            if (!count || !isOn(word)) element.removeAttribute("data-cipher-shown");
            else element.setAttribute("data-cipher-shown", coded.slice(0, count).join("") + plain.slice(count).join(""));
        });
    }

    function step() {
        count += Math.sign(target - count);
        render();
        if (count === target) {
            clearInterval(timer);
            timer = 0;
        }
    }

    function moveTo(value) {
        target = value;
        if (!timer && count !== target) timer = setInterval(step, CIPHER_STEP_MS);
    }

    card.addEventListener("pointerenter", event => {
        if (event.pointerType === "mouse" && !REDUCED_MOTION.matches) moveTo(length());
    });
    card.addEventListener("pointerleave", () => moveTo(0));

    /* Newly marked word: the old one becomes readable again, the new one is encrypted from the start if the mouse is on the card */
    card.addEventListener("cipherchange", () => {
        count = 0;
        render();
        if (target) moveTo(length());
    });
}


/*
 * The displayed word is an ::after whose alternative text is empty (content: … / ""):
 * a browser that does not know this syntax would read the encrypted word, so it keeps the fixed word.
 */
function initCiphers() {
    if (!FINE_HOVER.matches || !CSS.supports("content", "\"a\" / \"\"")) return;
    document.querySelectorAll('[data-hover="cipher"]').forEach(card => {
        if (card.querySelector("[data-cipher]")) attachCipher(card);
    });
}


/* -------------------- LANGUAGE SWITCH ON HOVER -------------------- */

/*
 * On hovering the card, the data-language word goes from one translation to the next (list separated by spaces
 * in the attribute), comes back to the original word and starts again as long as the mouse stays on the card;
 * when leaving it, it becomes the original word again at once. Same display as the encryption (data-language-shown, motion.css):
 * the text of the page never changes.
 */
function attachLanguage(card) {
    const words = Array.from(card.querySelectorAll("[data-language]")).map(element => ({
        element,
        translations: element.dataset.language.split(" ").filter(Boolean)
    }));
    words.forEach(({ element, translations }) => reserveWidth(element, [element.textContent, ...translations]));
    let index = 0;
    let timer = 0;

    /* Rank 0: original word; rank n: n-th translation, each word looping over its own list */
    function render() {
        words.forEach(({ element, translations }) => {
            const rank = index % (translations.length + 1);
            if (!rank) element.removeAttribute("data-language-shown");
            else element.setAttribute("data-language-shown", translations[rank - 1]);
        });
    }

    function step() {
        index += 1;
        render();
    }

    card.addEventListener("pointerenter", event => {
        if (event.pointerType !== "mouse" || REDUCED_MOTION.matches || timer) return;
        step();
        timer = setInterval(step, LANGUAGE_STEP_MS);
    });
    card.addEventListener("pointerleave", () => {
        clearInterval(timer);
        timer = 0;
        index = 0;
        render();
    });
}


/* Same condition as the encryption: without an empty alternative text, the word stays fixed */
function initLanguages() {
    if (!FINE_HOVER.matches || !CSS.supports("content", "\"a\" / \"\"")) return;
    document.querySelectorAll('[data-hover="language"]').forEach(card => {
        if (card.querySelector("[data-language]")) attachLanguage(card);
    });
}


/*
 * Starts the finishing touches. To be called after initReveal: the cascade relies on its classes.
 * The snake, the stick figure, the cat and the arrow (data-hover="snake", "hangman", "cat", "cursor") only need motion.css.
 */
export function initMotion() {
    initStagger();
    initMagnets();
    initIntro();
    initTitles();
    initMethodBars();
    initTimelineDetails();
    initCiphers();
    initLanguages();
}
