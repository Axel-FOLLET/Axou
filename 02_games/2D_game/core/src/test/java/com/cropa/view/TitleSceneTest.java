package com.cropa.view;

// JUnit: the checks the tests use, and the annotations. Texts and Language: the words of the screen, in French and in
// English. Optional: what a click on the screen gives.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

// Language and Texts: the words of the game in French, the language its layout was measured on.
import com.cropa.text.Language;
import com.cropa.text.Texts;
import java.util.List;
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
        assertTrue(canvas.extras.contains("float > Cliquer pour jouer < 280.0 95.0 1.0 NORMAL"));
    }

    // Half a pulse later the three figures still have separate breathing phases.
    @Test
    void invitationDimsWhileTheThreeFiguresBreathe() {
        TitleScene scene = new TitleScene(WORLD, true, FRENCH);
        scene.update(0.8f);
        scene.render(canvas);
        String pulse = canvas.extras.stream().filter(s -> s.startsWith("float ")).findFirst().orElseThrow();
        String[] words = pulse.split(" ");
        assertEquals(0.55f, Float.parseFloat(words[words.length - 2]), 0.0001f);
        List<Float> times = canvas.extras.stream().filter(s -> s.startsWith("animation "))
                .filter(s -> !s.startsWith("animation urn ")).map(s -> s.split(" "))
                .map(parts -> Float.valueOf(parts[parts.length - 2])).toList();
        assertEquals(List.of(0.8f, 0.8f + 0.4f, 0.8f + 0.8f), times);
    }

    // Both languages keep their own centred bubble at the peak and trough of the pulse.
    @Test
    void playBubbleFollowsTheInvitation() {
        for (Texts texts : List.of(FRENCH, Texts.of(Language.ENGLISH))) {
            TitleScene scene = new TitleScene(WORLD, true, texts);
            float width = TextWidth.of(texts.clickToPlay()) + 6;
            Bounds area = new Bounds(280 - width / 2, 79, width, 19);
            for (float expected : new float[]{1f, 0.55f}) {
                RecordingCanvas frame = new RecordingCanvas();
                scene.render(frame);
                String label = "float " + texts.clickToPlay() + " 280.0 95.0 ";
                String pulse = frame.extras.stream().filter(s -> s.startsWith(label)).findFirst().orElseThrow();
                float alpha = Float.parseFloat(pulse.substring(label.length(), pulse.lastIndexOf(' ')));
                assertEquals(expected, alpha, 1e-5f);
                assertEquals("color " + area + " 0.0 0.0 0.0 " + (0.75f * alpha),
                        frame.extras.get(frame.extras.indexOf(pulse) - 1));
                scene.update(0.8f);
            }
        }
    }

    // Asked by Axel: M. Chmunks with the urn between Henchman 1 and Henchman 2, all facing the player, their feet on y 150.
    // The urn comes after M. Chmunks: it is drawn in front of him.
    @Test
    void chmunksHoldsTheUrnBetweenHisHenchmen() {
        new TitleScene(WORLD, true, FRENCH).render(canvas);

        assertTrue(drew("sprite " + SpriteCatalog.HENCHMAN_1_FRONT + " " + new Bounds(195, 150f - 42f * 2 / 56, 42, 42)));
        assertTrue(drew("sprite " + SpriteCatalog.CHMUNKS_FRONT + " " + new Bounds(258, 150f - 44f * 2 / 32, 44, 44)));
        assertTrue(drew("sprite " + SpriteCatalog.HENCHMAN_2_FRONT + " " + new Bounds(323, 150f - 42f * 3 / 56, 42, 42)));
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
        assertLanguageFrame(canvas, SpriteCatalog.BUTTON_FRAME, scene.getLanguageButton());
        for (boolean pressed : new boolean[]{false, true}) {
            RecordingCanvas frame = new RecordingCanvas();
            scene.render(frame, new Pointer(525, 305, pressed));
            String key = pressed ? SpriteCatalog.BUTTON_PRESSED_FRAME : SpriteCatalog.BUTTON_HOVER_FRAME;
            assertLanguageFrame(frame, key, scene.getLanguageButton());
        }
    }

    private void assertLanguageFrame(RecordingCanvas frame, String key, Bounds area) {
        int index = frame.extras.indexOf("frame " + key + " " + area + " NORMAL");
        assertTrue(index >= 0);
        assertEquals("plain English 501.0 312.0 NORMAL", frame.extras.get(index + 1));
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
        assertTrue(canvas.extras.contains("float > Click to play < 280.0 95.0 1.0 NORMAL"));
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
