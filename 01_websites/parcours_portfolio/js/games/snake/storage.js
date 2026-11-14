/*
 * Record persistence in this browser and for this HTTP origin.
 * try/catch lets the game work if storage is forbidden or invalid.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
import { SCORE_KEY } from "./constants.js";

/*
 * Reads the JSON saved in localStorage and checks the expected fields.
 * A missing, corrupted or inaccessible value returns the game's fallback value.
 */
export function readBestScore() {
    try {
        const content = localStorage.getItem(SCORE_KEY);

        if (!content) {
            return 0;
        }

        const data = JSON.parse(content);

        if (!Number.isInteger(data.score)) {
            return 0;
        }

        return data.score;
    } catch (error) {
        return 0;
    }
}

/*
 * Saves newScore and its date under the key specific to Snake.
 * JSON.stringify turns the object into text, the format localStorage expects.
 */
export function saveBestScore(newScore) {
    try {
        localStorage.setItem(
            SCORE_KEY,
            JSON.stringify({
                score: newScore,
                date: new Date().toISOString().slice(0, 10)
            })
        );
    } catch (error) {
        // In private mode, the game stays playable even if localStorage is refused.
    }
}

/*
 * Saves only a score above the record and returns true if the record is beaten.
 */
export function updateBestScore(newScore) {
    const previousScore = readBestScore();

    if (newScore > previousScore) {
        saveBestScore(newScore);
        return true;
    }

    return false;
}
