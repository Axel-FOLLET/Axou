package com.cropa.view;

// JUnit: the checks the tests use, and the annotations. Texts and Language: the words of the screen, in French and in
// English. Optional: what a click on the screen gives.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

// Language and Texts: the words of the game in French, the language its layout was measured on.
import com.cropa.text.Language;
import com.cropa.text.Texts;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

// No window: the title screen draws on a RecordingCanvas.
/** Tests for {@link TitleScene}. */
class TitleSceneTest {

    //-------------------- CONSTANTS --------------------
    // The texts the game shows in French, its first language: the layout was measured on them.
    private static final Texts FRENCH = Texts.of(Language.FRENCH);

    //-------------------- FIELDS --------------------
    // The world of the game: 560 x 320, its middle at x 280.
    private static final Bounds WORLD = new Bounds(0, 0, 560, 320);
    private RecordingCanvas canvas;

    //-------------------- HELPERS --------------------
    @BeforeEach
    void newCanvas() {
        canvas = new RecordingCanvas();
    }

    // The position of the first recorded call that contains the text, -1 if none.
    private int indexOf(String text) {
        for (int i = 0; i < canvas.calls.size(); i++) {
            if (canvas.calls.get(i).contains(text)) {
                return i;
            }
        }
        return -1;
    }

    private boolean drew(String text) {
        return indexOf(text) >= 0;
    }

    //-------------------- AT LAUNCH --------------------
    // Asked by Axel: the full title over the farm darkened. The veil first, then the three lines, 22 px apart,
    // centred on x 280, then the invitation to click.
    @Test
    void theLaunchShowsTheFullTitle() {
        new TitleScene(WORLD, true, FRENCH).render(canvas);

        assertTrue(canvas.calls.get(0).startsWith("veil "));
        assertTrue(drew("centered Un vieil homme riche a volé l'urne de ma défunte femme, 280.0 290.0"));
        assertTrue(drew("centered je compte la racheter en vendant mes récoltes 280.0 268.0"));
        assertTrue(drew("centered mais des monstres attaquent ma plantation. 1 280.0 246.0"));
        assertTrue(drew("centered > Cliquer pour jouer < 280.0 95.0"));
    }

    // Asked by Axel: M. Chmunks with the urn between Hugo and Alexis, all facing the player, their feet on y 150.
    // The urn comes after M. Chmunks: it is drawn in front of him.
    @Test
    void chmunksHoldsTheUrnBetweenHisHenchmen() {
        new TitleScene(WORLD, true, FRENCH).render(canvas);

        assertTrue(drew("sprite " + SpriteCatalog.HUGO_FRONT + " " + new Bounds(195, 150f - 42f * 2 / 56, 42, 42)));
        assertTrue(drew("sprite " + SpriteCatalog.CHMUNKS_FRONT + " " + new Bounds(258, 150f - 44f * 2 / 32, 44, 44)));
        assertTrue(drew("sprite " + SpriteCatalog.ALEXIS_FRONT + " " + new Bounds(323, 150f - 42f * 3 / 56, 42, 42)));
        assertTrue(indexOf("sprite " + SpriteCatalog.URN) > indexOf("sprite " + SpriteCatalog.CHMUNKS_FRONT));
    }

    //-------------------- THE CLICK --------------------
    // A click anywhere but on the language button closes it and is used for nothing else; then nothing is drawn, and
    // the clicks go to the game.
    @Test
    void aClickAnywhereClosesIt() {
        TitleScene scene = new TitleScene(WORLD, true, FRENCH);

        assertEquals(Optional.of(TitleChoice.PLAY), scene.handleClick(100, 100));
        assertFalse(scene.isVisible());
        assertEquals(Optional.empty(), scene.handleClick(100, 100));
        scene.render(canvas);
        assertTrue(canvas.calls.isEmpty());
    }

    //-------------------- THE LANGUAGE --------------------
    // The button names the other language, in that language, at the top right: its outline 3 px around its words,
    // 8 px from the right edge, its text on the line of the HUD (y 312). "English" is 48 px wide in the HUD font.
    @Test
    void theFrenchScreenOffersEnglishAtTheTopRight() {
        TitleScene scene = new TitleScene(WORLD, true, FRENCH);
        scene.render(canvas);

        assertEquals(new Bounds(498, 296, 54, 19), scene.getLanguageButton());
        assertTrue(drew("text English 501.0 312.0"));
        assertTrue(drew("outline WHITE " + scene.getLanguageButton()));
    }

    // A click on the button asks for the other language and leaves the screen shown: the game starts over in it.
    @Test
    void theLanguageButtonAsksForTheOtherLanguage() {
        TitleScene scene = new TitleScene(WORLD, true, FRENCH);
        Bounds button = scene.getLanguageButton();

        assertEquals(Optional.of(TitleChoice.SWITCH_LANGUAGE),
            scene.handleClick(button.x() + button.width() / 2, button.y() + button.height() / 2));
        assertTrue(scene.isVisible());
    }

    // The English screen: the title and the invitation in English, and the button offers French.
    @Test
    void theEnglishScreenIsInEnglish() {
        new TitleScene(WORLD, true, Texts.of(Language.ENGLISH)).render(canvas);

        assertTrue(drew("centered A rich old man stole my late wife's urn, 280.0 290.0"));
        assertTrue(drew("centered > Click to play < 280.0 95.0"));
        assertTrue(drew("text Français "));
    }

    // After "Rejouer", the new game starts right away: the title screen is never shown.
    @Test
    void hiddenAfterReplay() {
        TitleScene scene = new TitleScene(WORLD, false, FRENCH);
        scene.render(canvas);

        assertFalse(scene.isVisible());
        assertEquals(Optional.empty(), scene.handleClick(100, 100));
        assertTrue(canvas.calls.isEmpty());
    }
}
