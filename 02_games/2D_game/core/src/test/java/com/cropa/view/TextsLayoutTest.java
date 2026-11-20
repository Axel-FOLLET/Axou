package com.cropa.view;

// JUnit: the checks the tests use, and the annotations; a parameterized test runs once per language.
// The model: the kinds of defense and of crop, and the numbers of the crops (their price and ripe value).
// Texts and Language: every word of the game, in French and in English.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cropa.model.defense.DefenseType;
import com.cropa.model.world.CropConfig;
import com.cropa.model.world.CropType;
import com.cropa.text.Language;
import com.cropa.text.Texts;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

// The layout of the screen was measured on the French words. This test checks that the words of both languages fit
// the places drawn for them, with TextWidth, the widths of the game font: a longer translation fails here, not on
// screen.
/** Tests that the texts of every language fit their place on screen. */
class TextsLayoutTest {

    //-------------------- CONSTANTS --------------------
    // The world is 560 px wide. The shop panel holds 138 px of words (144 minus 3 px on each side); the dialog frame of
    // the tutorial and of Melda, 236 px. The first line of the HUD ends before the shop (x 397, from x 8).
    private static final float WORLD_WIDTH = 560f;
    private static final float PANEL_WORDS = 138f;
    private static final float DIALOG_WORDS = 236f;
    private static final float HUD_LINE = 389f;
    // The end screen buttons are 80 px wide: their words, centred, keep 3 px on each side.
    private static final float END_BUTTON_WORDS = 74f;
    // The highest numbers shown: 10 000 coins, the last night, the full timer, a defense at its top level.
    private static final int MAX_MONEY = 10000;
    private static final int MAX_LEVEL = 3;

    //-------------------- THE FONT --------------------
    // The widths written in the comments of the view, measured on lsans-15 when the layout was drawn.
    @Test
    void theWidthsMatchTheMeasuresOfTheLayout() {
        assertEquals(46, TextWidth.of("Planter"));
        assertEquals(63, TextWidth.of("Défenses"));
        assertEquals(87, TextWidth.of("Lancer la nuit"));
        assertEquals(144, TextWidth.of("Lancer la dernière nuit"));
        assertEquals(109, TextWidth.of("Passer à la suite"));
        assertEquals(130, TextWidth.of("Commencer à jouer"));
        assertEquals(138, TextWidth.of("Épouvantail N1 100%"));
    }

    // A character the font does not have would be drawn as nothing: TextWidth refuses it, so a text with a typographic
    // apostrophe fails here.
    @Test
    void aCharacterOutOfTheFontIsRefused() {
        assertThrows(IllegalArgumentException.class, () -> TextWidth.of("l’urne"));
    }

    //-------------------- EVERY LANGUAGE --------------------
    // The two buttons of the shop, side by side, stay in the world.
    @ParameterizedTest
    @EnumSource(Language.class)
    void theShopButtonsFitTheWorld(Language language) {
        ShopWindow shop = new ShopWindow(null, MAX_MONEY, new CropConfig(), Texts.of(language));
        Bounds defenses = shop.defenseButton();

        assertTrue(defenses.x() > shop.plantButton().x() + shop.plantButton().width());
        assertTrue(defenses.x() + defenses.width() <= WORLD_WIDTH);
    }

    // Every line of the shop panel: the lists, the titles of a defense and of a crop, the urn, the actions.
    @ParameterizedTest
    @EnumSource(Language.class)
    void theShopWordsFitThePanel(Language language) {
        Texts texts = Texts.of(language);
        CropConfig crops = new CropConfig();
        for (CropType type : CropType.values()) {
            int ripe = crops.getValue(type, crops.getStageCount(type) - 1);
            fits(texts.name(type) + " " + crops.getSeedPrice(type) + " -> " + ripe, PANEL_WORDS);
            for (Growth growth : Growth.values()) {
                fits(texts.name(type) + ", " + growth.label(texts), PANEL_WORDS);
            }
            fits(texts.sell(ripe), PANEL_WORDS);
        }
        for (DefenseType type : DefenseType.values()) {
            fits(texts.name(type) + " (" + MAX_MONEY + ")", PANEL_WORDS);
            fits(texts.defenseTitle(type, MAX_LEVEL, 100), PANEL_WORDS);
        }
        fits(texts.urnOffer(MAX_MONEY), PANEL_WORDS);
        fits(texts.upgrade(200), PANEL_WORDS);
        fits(texts.maxLevel(), PANEL_WORDS);
        fits(texts.remove(), PANEL_WORDS);
    }

    // The first line of the HUD at its widest, left of the shop.
    @ParameterizedTest
    @EnumSource(Language.class)
    void theHudLineFitsLeftOfTheShop(Language language) {
        fits(Texts.of(language).status(MAX_MONEY, 200, true, 10, 60), HUD_LINE);
    }

    // The bubbles of the tutorial: 3 lines at most, each one inside the frame.
    @ParameterizedTest
    @EnumSource(Language.class)
    void theTutorialFitsItsFrame(Language language) {
        for (List<String> bubble : Texts.of(language).tutorialBubbles()) {
            assertTrue(bubble.size() <= 3, bubble.toString());
            bubble.forEach(line -> fits(line, DIALOG_WORDS));
        }
    }

    // Melda's texts, cut the way her dialog cuts them: 3 lines at most (no word lost), each one inside the frame.
    @ParameterizedTest
    @EnumSource(Language.class)
    void meldaFitsHerFrame(Language language) {
        Texts texts = Texts.of(language);
        for (List<String> facts : List.of(texts.meldaFirstGame(), texts.meldaReplay())) {
            for (String fact : facts) {
                List<String> lines = MeldaRenderer.linesOf(fact);
                assertEquals(fact, String.join(" ", lines), "more than 3 lines: " + fact);
                lines.forEach(line -> fits(line, DIALOG_WORDS));
            }
        }
    }

    // The centred lines of the title screen, of the cinematics and of the end screen, inside the world.
    @ParameterizedTest
    @EnumSource(Language.class)
    void theCentredLinesFitTheWorld(Language language) {
        Texts texts = Texts.of(language);
        texts.titleLines().forEach(line -> fits(line, WORLD_WIDTH - 2 * 16));
        texts.introLines().forEach(line -> fits(line, WORLD_WIDTH - 2 * 16));
        texts.victoryLines().forEach(line -> fits(line, WORLD_WIDTH - 2 * 16));
        fits(texts.urnBoughtBack(), WORLD_WIDTH);
        fits(texts.farmFell(true, 10), WORLD_WIDTH);
        fits(texts.urnSold(), WORLD_WIDTH);
        fits(texts.replay(), END_BUTTON_WORDS);
        fits(texts.quit(), END_BUTTON_WORDS);
    }

    //-------------------- HELPERS --------------------
    // TextWidth also refuses a character out of the font: every text checked here can be drawn.
    private static void fits(String text, float width) {
        assertTrue(TextWidth.of(text) <= width, text + " is " + TextWidth.of(text) + " px wide, more than " + width);
    }
}
