package com.cropa.text;

// JUnit: the checks the tests use, and the annotation. DefenseType: the scarecrow, whose title is checked. GameResult:
// the ends of a game, each with its words.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import com.cropa.model.defense.DefenseType;
import com.cropa.model.game.GameResult;
import org.junit.jupiter.api.Test;

// The width of the texts on screen is checked by TextsLayoutTest, in the view.
/** Tests for {@link Texts} and {@link Language}. */
class TextsTest {

    //-------------------- CONSTANTS --------------------
    private static final Texts FRENCH = Texts.of(Language.FRENCH);
    private static final Texts ENGLISH = Texts.of(Language.ENGLISH);

    //-------------------- LANGUAGE --------------------
    // The launchers give the code of the computer ("fr", "en") or of the web page ("fr-FR"): only French gives French.
    @Test
    void onlyAFrenchCodeGivesFrench() {
        assertEquals(Language.FRENCH, Language.fromCode("fr"));
        assertEquals(Language.FRENCH, Language.fromCode("FR_fr"));
        assertEquals(Language.ENGLISH, Language.fromCode("en"));
        assertEquals(Language.ENGLISH, Language.fromCode("de"));
        assertEquals(Language.ENGLISH, Language.fromCode(""));
        assertEquals(Language.ENGLISH, Language.fromCode(null));
    }

    // The button of the title screen goes from one language to the other, and back.
    @Test
    void theOtherLanguageComesBack() {
        assertEquals(Language.ENGLISH, Language.FRENCH.other());
        assertEquals(Language.FRENCH, Language.ENGLISH.other());
    }

    //-------------------- TEXTS --------------------
    // The thousands apart as each language writes them.
    @Test
    void theThousandsAreWrittenAsEachLanguageDoes() {
        assertEquals("3 450", FRENCH.number(3450));
        assertEquals("3,450", ENGLISH.number(3450));
        assertEquals("Urne : 3 450 / 10 000", FRENCH.urnGauge(3450, 10000));
        assertEquals("Urn: 3,450 / 10,000", ENGLISH.urnGauge(3450, 10000));
    }

    // The French words are the ones of the game before the translation: nothing changed for a French player.
    @Test
    void theFrenchWordsAreTheOnesOfTheGame() {
        assertEquals("Argent : 100   PV ferme : 200   Jour : 1   Temps : 60 s", FRENCH.status(100, 200, false, 1, 60));
        assertEquals("Défaite : l'urne a été vendue", FRENCH.ending(GameResult.DEFEAT_URN_SOLD));
        assertEquals("Épouvantail N1 100%", FRENCH.defenseTitle(
            DefenseType.SCARECROW, 1, 100));
        assertEquals("La ferme est tombée la nuit 5.", FRENCH.farmFell(true, 5));
    }

    // Each list has as many lines in both languages: one line per image of a cinematic, the same bubbles of the
    // tutorial, the same bubbles of Neighbour.
    @Test
    void bothLanguagesTellTheSameNumberOfLines() {
        assertEquals(FRENCH.titleLines().size(), ENGLISH.titleLines().size());
        assertEquals(FRENCH.introLines().size(), ENGLISH.introLines().size());
        assertEquals(FRENCH.victoryLines().size(), ENGLISH.victoryLines().size());
        assertEquals(FRENCH.tutorialBubbles().size(), ENGLISH.tutorialBubbles().size());
        assertEquals(FRENCH.neighbourFirstGame().size(), ENGLISH.neighbourFirstGame().size());
        assertEquals(FRENCH.neighbourReplay().size(), ENGLISH.neighbourReplay().size());
        assertEquals(FRENCH.lastSaleWarning().size(), ENGLISH.lastSaleWarning().size());
    }

    // Every end of the game has its own words in English.
    @Test
    void everyEndingIsTranslated() {
        for (GameResult result : GameResult.values()) {
            assertNotEquals(FRENCH.ending(result), ENGLISH.ending(result));
        }
    }
}
