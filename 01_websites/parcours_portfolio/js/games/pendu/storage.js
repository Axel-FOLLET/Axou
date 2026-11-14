/*
 * Persistence of the record in this browser and for this HTTP origin.
 * try/catch lets the game work if storage is forbidden or invalid.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
import { SCORE_KEY } from "./constants.js";
import { state } from "./state.js";
import { language, t } from "./translations.js";

/*
 * Reads the JSON saved in localStorage and checks the expected fields.
 * A missing, corrupted or inaccessible value returns the fallback value of the game.
 * The saved field keeps its historical name "tentatives": renaming it would hide the records visitors already have.
 */
export function readBestScore() {
    try {
        const content = localStorage.getItem(SCORE_KEY);

        if (!content) {
            return null;
        }

        const score = JSON.parse(content);

        if (!Number.isInteger(score.tentatives) || !score.date) {
            return null;
        }

        return score;
    } catch (error) {
        return null;
    }
}

/*
 * Today's date, in local time, in YYYY-MM-DD format (toISOString would give the UTC date, sometimes the day before).
 */
function todayDate() {
    const now = new Date();
    return [now.getFullYear(), now.getMonth() + 1, now.getDate()].map(n => String(n).padStart(2, "0")).join("-");
}

/*
 * Displays a YYYY-MM-DD date in the language of the game: "1 novembre 2026", "1 November 2026".
 */
function readableDate(date) {
    const [year, month, day] = date.split("-").map(Number);
    const parsed = new Date(year, month - 1, day);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString(language === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

/*
 * Saves the number of attempts and the local date in YYYY-MM-DD format.
 * If storage is refused, still returns the date to let the game work.
 */
export function saveScore() {
    try {
        const date = todayDate();
        localStorage.setItem(
            SCORE_KEY,
            JSON.stringify({ tentatives: state.attemptCount, date: date })
        );
        return date;
    } catch (error) {
        return todayDate();
    }
}

/*
 * Returns the score message in the chosen language.
 * In Hangman, a record is a win with fewer attempts.
 */
export function bestScoreText(won) {
    const previous = readBestScore();

    if (won && (!previous || state.attemptCount < previous.tentatives)) {
        saveScore();
        return t.newBest;
    }

    if (!previous) {
        return t.noBest;
    }

    return t.best(previous.tentatives, readableDate(previous.date));
}
