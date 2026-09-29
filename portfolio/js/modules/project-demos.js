/*
 * Démos des projets : « Tester » agrandit la carte pour afficher l'outil (voir project-showcase.js).
 * Ce module calcule les résultats. Contrairement aux jeux, ces outils se testent aussi sur téléphone (pas de clavier requis).
 */
import { RELIABLE_LENGTH, rankLanguages } from "../tools/language-detector.js";
import { caesar, findCaesarKey, isValidVigenereKey, vigenere } from "../tools/ciphers.js";


const TEXTS = {
    fr: {
        languages: { fr: "Français", en: "Anglais", es: "Espagnol", pt: "Portugais", it: "Italien", de: "Allemand", nl: "Néerlandais", sv: "Suédois", pl: "Polonais", tr: "Turc" },
        locale: "fr-FR",
        waiting: "Le résultat s'affiche pendant la saisie.",
        noLetter: "Aucune lettre à analyser.",
        verdict: "Langue probable :",
        gap: "écart",
        shortText: count => `Texte court (${count} lettres) : ajoutez une ou deux phrases pour un résultat plus sûr.`,
        caesarKeyHint: "César : chiffres uniquement (ex. : 3).",
        vigenereKeyHint: "Vigenère : lettres uniquement, sans accents (ex. : EPITECH).",
        caesarKeyError: "Clé invalide : la clé de César ne contient que des chiffres.",
        vigenereKeyError: "Clé invalide : la clé de Vigenère ne contient que des lettres, sans accents, espaces ni chiffres.",
        foundKey: key => `Clé trouvée : ${key}, celle qui donne le texte le plus proche du français.`
    },
    en: {
        languages: { fr: "French", en: "English", es: "Spanish", pt: "Portuguese", it: "Italian", de: "German", nl: "Dutch", sv: "Swedish", pl: "Polish", tr: "Turkish" },
        locale: "en-GB",
        waiting: "The result appears as you type.",
        noLetter: "No letters to analyse.",
        verdict: "Probable language:",
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
 * Exemples chargés tour à tour par le bouton « Exemple » : deux phrases, assez pour un résultat fiable.
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
 * Crée un élément avec sa classe BEM et son texte (textContent n'interprète pas le HTML).
 */
function createElement(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
}


/*
 * Détecteur : le classement est recalculé à chaque saisie.
 * Les trois langues les plus proches sont affichées, avec leur écart.
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
        verdict.replaceChildren(texts.verdict + " ", createElement("strong", "", texts.languages[languages[0].code]));
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
 * Chiffrement : le résultat est recalculé à chaque changement de méthode, d'opération, de clé ou de texte.
 * « Trouver la clé » n'a de sens que pour déchiffrer un César : le bouton n'apparaît que dans ce cas.
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
     * Retourne le message d'erreur de la clé, ou une chaîne vide si elle est valide.
     */
    function checkKey() {
        if (method.value === "caesar") return /^\d+$/.test(key.value.trim()) ? "" : texts.caesarKeyError;
        return isValidVigenereKey(key.value.trim()) ? "" : texts.vigenereKeyError;
    }

    /*
     * L'erreur s'affiche sous le champ dès la frappe ; le résultat est vidé tant que la clé est invalide.
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
        const cipherKey = method.value === "caesar" ? Number(key.value) : key.value.trim();
        output.value = cipher(input.value, cipherKey, Number(direction.value));
    }

    [direction, key, input].forEach(field => field.addEventListener("input", update));

    /*
     * Changer de méthode propose une clé d'exemple valide : "3" ne convient pas à Vigenère, "EPITECH" pas à César.
     */
    method.addEventListener("input", () => {
        key.value = method.value === "caesar" ? "3" : "EPITECH";
        update();
    });

    /*
     * Reprend le résultat comme nouveau texte et inverse l'opération : pratique pour vérifier l'aller-retour.
     */
    swapButton.addEventListener("click", () => {
        if (!output.value) return;
        input.value = output.value;
        direction.value = String(-Number(direction.value));
        update();
    });

    crackButton.addEventListener("click", () => {
        key.value = String(findCaesarKey(input.value, language));
        update();
        message.textContent = texts.foundKey(key.value);
    });
    update();
}


export function initProjectDemos(language) {
    const texts = TEXTS[language] ?? TEXTS.fr;
    document.querySelectorAll(".demo--language").forEach(demo => initLanguageDemo(demo, texts));
    document.querySelectorAll(".demo--cipher").forEach(demo => initCipherDemo(demo, texts, language));
}
