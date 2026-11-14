/*
 * Project demos: "Try it" enlarges the card to show the tool (see project-showcase.js).
 * This module computes the results. Unlike the games, these tools can also be tested on a phone (no keyboard required).
 */
import { RELIABLE_LENGTH, rankLanguages } from "../tools/language-detector.js";
import { caesar, findCaesarKey, isValidVigenereKey, vigenere } from "../tools/ciphers.js";
import { normalize } from "../tools/letter-frequencies.js";


// \u00A0: non-breaking space before the colons, as in the French pages
const TEXTS = {
    fr: {
        languages: { fr: "Français", en: "Anglais", es: "Espagnol", pt: "Portugais", it: "Italien", de: "Allemand", nl: "Néerlandais", sv: "Suédois", pl: "Polonais", tr: "Turc" },
        locale: "fr-FR",
        waiting: "Le résultat s'affiche pendant la saisie.",
        noLetter: "Aucune lettre à analyser.",
        verdict: "Langue probable\u00A0:",
        // In the verdict sentence, the language name is written in lower case; the ranking, where it opens the line, keeps the capital
        verdictName: name => name.toLocaleLowerCase("fr-FR"),
        gap: "écart",
        shortText: count => `Texte court (${count} lettres)\u00A0: ajoutez une ou deux phrases pour un résultat plus sûr.`,
        caesarKeyHint: "César\u00A0: chiffres uniquement (ex.\u00A0: 3).",
        vigenereKeyHint: "Vigenère\u00A0: lettres uniquement, sans accents (ex.\u00A0: EPITECH).",
        caesarKeyError: "Clé invalide\u00A0: la clé de César ne contient que des chiffres.",
        vigenereKeyError: "Clé invalide\u00A0: la clé de Vigenère ne contient que des lettres, sans accents, espaces ni chiffres.",
        foundKey: key => `Clé trouvée\u00A0: ${key}, celle qui donne le texte le plus proche du français.`
    },
    en: {
        languages: { fr: "French", en: "English", es: "Spanish", pt: "Portuguese", it: "Italian", de: "German", nl: "Dutch", sv: "Swedish", pl: "Polish", tr: "Turkish" },
        locale: "en-GB",
        waiting: "The result appears as you type.",
        noLetter: "No letters to analyse.",
        verdict: "Probable language:",
        // In English, a language name always keeps its capital
        verdictName: name => name,
        gap: "gap",
        shortText: count => `Short text (${count} letters): add a sentence or two for a more reliable result.`,
        caesarKeyHint: "Caesar: digits only (e.g. 3).",
        vigenereKeyHint: "Vigenère: letters only, no accents (e.g. EPITECH).",
        caesarKeyError: "Invalid key: a Caesar key contains digits only.",
        vigenereKeyError: "Invalid key: a Vigenère key contains letters only, without accents, spaces or digits.",
        foundKey: key => `Key found: ${key}, the one that gives the text closest to English.`
    }
};

/*
 * Examples loaded one after the other by the "Example" button: two sentences, enough for a reliable result.
 */
const EXAMPLES = [
    "Le petit chat dort sur le canapé pendant que les enfants jouent dans le jardin. Demain, nous irons tous ensemble à la plage.",
    "The little cat is sleeping on the sofa while the children are playing in the garden. Tomorrow we will all go to the beach together.",
    "El pequeño gato duerme en el sofá mientras los niños juegan en el jardín. Mañana iremos todos juntos a la playa.",
    "Die kleine Katze schläft auf dem Sofa, während die Kinder im Garten spielen. Morgen fahren wir alle zusammen an den Strand.",
    "Il piccolo gatto dorme sul divano mentre i bambini giocano in giardino. Domani andremo tutti insieme al mare.",
    "O pequeno gato dorme no sofá enquanto as crianças brincam no jardim. Amanhã vamos todos juntos para a praia.",
    "De kleine kat slaapt op de bank terwijl de kinderen in de tuin spelen. Morgen gaan we allemaal samen naar het strand.",
    "Den lilla katten sover i soffan medan barnen leker i trädgården. I morgon åker vi alla tillsammans till stranden.",
    "Mały kot śpi na kanapie, podczas gdy dzieci bawią się w ogrodzie. Jutro wszyscy razem pojedziemy na plażę.",
    "Küçük kedi kanepede uyurken çocuklar bahçede oynuyor. Yarın hep birlikte plaja gideceğiz."
];


/*
 * Creates an element with its BEM class and its text (textContent does not interpret HTML).
 */
function createElement(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
}


/*
 * Caesar shift reduced to 0-25, computed digit by digit: a 400-digit key would otherwise be
 * a number too large for JavaScript (Infinity), and the encrypted text would become unreadable.
 */
function caesarShift(digits) {
    return [...digits].reduce((shift, digit) => (shift * 10 + Number(digit)) % 26, 0);
}


/*
 * Detector: the ranking is recomputed on every keystroke.
 * The three closest languages are displayed, with their gap.
 */
function initLanguageDemo(demo, texts) {
    const input = demo.querySelector(".demo__input");
    const verdict = demo.querySelector(".demo__verdict");
    const ranking = demo.querySelector(".demo__ranking");
    const note = demo.querySelector(".demo__note");
    const exampleButton = demo.querySelector(".demo__example");
    let exampleIndex = 0;

    function update() {
        const { letterCount, ranking: languages } = rankLanguages(input.value);
        ranking.replaceChildren();
        note.textContent = "";
        if (!input.value.trim()) {
            verdict.textContent = texts.waiting;
            return;
        }
        if (!letterCount) {
            verdict.textContent = texts.noLetter;
            return;
        }
        // The verdict is a sentence: it ends with a full stop
        verdict.replaceChildren(texts.verdict + " ", createElement("strong", "", texts.verdictName(texts.languages[languages[0].code])), ".");
        for (const { code, gap } of languages.slice(0, 3)) {
            ranking.append(createElement("li", "demo__rank", texts.languages[code] + " — " + texts.gap + " " + gap.toLocaleString(texts.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })));
        }
        if (letterCount < RELIABLE_LENGTH) note.textContent = texts.shortText(letterCount);
    }

    input.addEventListener("input", update);
    exampleButton.addEventListener("click", () => {
        input.value = EXAMPLES[exampleIndex];
        exampleIndex = (exampleIndex + 1) % EXAMPLES.length;
        update();
    });
    update();
}


/*
 * Cipher: the result is recomputed whenever the method, operation, key or text changes.
 * "Find the key" only makes sense for decrypting a Caesar cipher: the button appears only in that case.
 */
function initCipherDemo(demo, texts, language) {
    const method = demo.querySelector("[data-cipher-method]");
    const direction = demo.querySelector("[data-cipher-direction]");
    const key = demo.querySelector("[data-cipher-key]");
    const input = demo.querySelector(".demo__input");
    const output = demo.querySelector(".demo__output");
    const hint = demo.querySelector("[data-cipher-hint]");
    const keyError = demo.querySelector("[data-cipher-error]");
    const message = demo.querySelector(".demo__note");
    const swapButton = demo.querySelector("[data-cipher-swap]");
    const crackButton = demo.querySelector("[data-cipher-crack]");

    /*
     * Returns the error message of the key, or an empty string if it is valid.
     */
    function checkKey() {
        if (method.value === "caesar") return /^\d+$/.test(key.value.trim()) ? "" : texts.caesarKeyError;
        return isValidVigenereKey(key.value.trim()) ? "" : texts.vigenereKeyError;
    }

    /*
     * The error shows under the field as soon as the user types; the result is emptied while the key is invalid.
     */
    function update() {
        crackButton.hidden = !(method.value === "caesar" && direction.value === "-1");
        hint.textContent = method.value === "caesar" ? texts.caesarKeyHint : texts.vigenereKeyHint;
        message.textContent = "";
        const error = checkKey();
        key.setAttribute("aria-invalid", String(Boolean(error)));
        keyError.textContent = error;
        if (error) {
            output.value = "";
            return;
        }
        const cipher = method.value === "caesar" ? caesar : vigenere;
        const cipherKey = method.value === "caesar" ? caesarShift(key.value.trim()) : key.value.trim();
        output.value = cipher(input.value, cipherKey, Number(direction.value));
    }

    [direction, key, input].forEach(field => field.addEventListener("input", update));

    /*
     * Changing the method offers a valid example key: "3" does not suit Vigenere, "EPITECH" does not suit Caesar.
     */
    method.addEventListener("input", () => {
        key.value = method.value === "caesar" ? "3" : "EPITECH";
        markTitle();
        update();
    });

    /*
     * The title word encrypted on hover follows the chosen method: Caesar or Vigenere (marked data-cipher-vigenere).
     * motion.js is notified by the cipherchange event.
     */
    function markTitle() {
        const card = demo.closest('[data-hover="cipher"]');
        if (!card) return;
        card.querySelectorAll("[data-cipher]").forEach(word => {
            const isVigenere = word.hasAttribute("data-cipher-vigenere");
            word.toggleAttribute("data-cipher-off", isVigenere !== (method.value === "vigenere"));
        });
        card.dispatchEvent(new Event("cipherchange"));
    }

    /*
     * Takes the result as the new text and reverses the operation: handy to check the round trip.
     */
    swapButton.addEventListener("click", () => {
        if (!output.value) return;
        input.value = output.value;
        direction.value = String(-Number(direction.value));
        update();
    });

    /*
     * With no letter in the text, no key can be found: the typed key stays in place.
     */
    crackButton.addEventListener("click", () => {
        if (!normalize(input.value)) {
            message.textContent = texts.noLetter;
            return;
        }
        key.value = String(findCaesarKey(input.value, language));
        update();
        message.textContent = texts.foundKey(key.value);
    });
    markTitle();
    update();
}


export function initProjectDemos(language) {
    const texts = TEXTS[language] ?? TEXTS.fr;
    document.querySelectorAll(".demo--language").forEach(demo => initLanguageDemo(demo, texts));
    document.querySelectorAll(".demo--cipher").forEach(demo => initCipherDemo(demo, texts, language));
}
