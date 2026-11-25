package com.cropa.view;

// JUnit: the checks the tests use, and the annotation.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

// Java: the images collected scene after scene, and the lists of scenes.
// Language and Texts: the words of the game in French, the language its layout was measured on.
import com.cropa.text.Language;
import com.cropa.text.Texts;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

// No window and no image: the cinematic draws on a RecordingCanvas, which only writes down the keys it receives.
/** Tests for {@link Cinematic}. */
class CinematicTest {

    //-------------------- CONSTANTS --------------------
    // The texts the game shows in French, its first language: the layout was measured on them.
    private static final Texts FRENCH = Texts.of(Language.FRENCH);

    //-------------------- FIELDS --------------------
    // The world of the game: 560 x 320.
    private static final Bounds WORLD = new Bounds(0, 0, 560, 320);
    // Three scenes of their own: the tests do not depend on the real cinematics.
    private static final List<Scene> THREE_SCENES = List.of(
            new Scene("first", "Line 1"),
            new Scene("second", "Line 2"),
            new Scene("third", "Line 3"));

    //-------------------- THE CLICKS --------------------
    // Asked by the J11 sheet: 3 scenes, 3 clicks; isOver() true at the third click, not before.
    @Test
    void threeScenesAreOverAtTheThirdClick() {
        Cinematic cinematic = new Cinematic(WORLD, THREE_SCENES, FRENCH);

        assertFalse(cinematic.isOver());
        assertTrue(cinematic.handleClick());
        assertFalse(cinematic.isOver());
        assertTrue(cinematic.handleClick());
        assertFalse(cinematic.isOver());
        assertTrue(cinematic.handleClick());
        assertTrue(cinematic.isOver());
    }

    // Once it is over, a click is not used: it goes to the game.
    @Test
    void aClickAfterTheEndIsNotUsed() {
        Cinematic cinematic = new Cinematic(WORLD, THREE_SCENES, FRENCH);
        cinematic.handleClick();
        cinematic.handleClick();
        cinematic.handleClick();

        assertFalse(cinematic.handleClick());
        assertTrue(cinematic.isOver());
    }

    // No scene: over at once, and no click is used.
    @Test
    void anEmptyCinematicIsOverAtOnce() {
        Cinematic cinematic = new Cinematic(WORLD, List.of(), FRENCH);

        assertTrue(cinematic.isOver());
        assertFalse(cinematic.handleClick());
    }

    //-------------------- THE DRAWING --------------------
    // Asked by the J11 sheet: the image of the current scene over the whole world, and its line. After one click, the
    // second scene. In this order: the image, the band over its bottom 44 px, the line centred on x 280 with its top
    // at y 36, then "Cliquer pour continuer" in small, its top at y 13.
    @Test
    void drawsTheCurrentSceneOverTheWholeWorld() {
        Cinematic cinematic = new Cinematic(WORLD, THREE_SCENES, FRENCH);
        cinematic.handleClick();
        RecordingCanvas canvas = new RecordingCanvas();

        cinematic.render(canvas);

        assertEquals(List.of(
                "sprite second " + WORLD,
                "veil " + new Bounds(0, 0, 560, 44) + " 0.7",
                "centered  280.0 36.0",
                "label Cliquer pour continuer 280.0 13.0"), canvas.calls);
        cinematic.update(0.15f);
        canvas.calls.clear();
        cinematic.render(canvas);
        assertEquals("centered Line 2 280.0 36.0", canvas.calls.get(2));
    }

    // A click during typing starts a fresh line; the image never moves.
    @Test
    void imageStaysStillAndLettersRestartOnEveryClick() {
        Cinematic film = new Cinematic(WORLD, THREE_SCENES, FRENCH);
        RecordingCanvas canvas = new RecordingCanvas();
        film.update(0.05f);
        film.render(canvas);
        assertEquals("centered Li 280.0 36.0", canvas.calls.get(2));
        assertTrue(film.handleClick());
        canvas.calls.clear();
        film.render(canvas);
        assertEquals("sprite second " + WORLD, canvas.calls.get(0));
        assertEquals("centered  280.0 36.0", canvas.calls.get(2));

        // Long after the click, the image has not moved: it still covers exactly the world.
        canvas.calls.clear();
        film.update(8f);
        film.render(canvas);
        assertEquals("sprite second " + WORLD, canvas.calls.get(0));
    }

    // Once it is over, nothing is drawn: the game shows through.
    @Test
    void drawsNothingOnceOver() {
        Cinematic cinematic = new Cinematic(WORLD, List.of(), FRENCH);
        RecordingCanvas canvas = new RecordingCanvas();

        cinematic.render(canvas);

        assertTrue(canvas.calls.isEmpty());
    }

    //-------------------- THE INTRO --------------------
    // Asked by the J11 sheet: the five scenes of the story, in their order, then the game. Each scene is drawn, then
    // clicked; the keys of the images are read in the calls of the canvas.
    @Test
    void theIntroShowsItsFiveImagesInOrder() {
        Cinematic intro = Cinematic.intro(WORLD, FRENCH);
        List<String> images = new ArrayList<>();

        while (!intro.isOver()) {
            RecordingCanvas canvas = new RecordingCanvas();
            intro.render(canvas);
            images.add(canvas.calls.get(0));
            intro.handleClick();
        }

        assertEquals(List.of(
                "sprite intro_1 " + WORLD,
                "sprite intro_2 " + WORLD,
                "sprite intro_3 " + WORLD,
                "sprite intro_4 " + WORLD,
                "sprite intro_5 " + WORLD), images);
    }

    // The first line of the story, under the first image.
    @Test
    void theIntroStartsWithGarryAndHisCat() {
        RecordingCanvas canvas = new RecordingCanvas();

        Cinematic intro = Cinematic.intro(WORLD, FRENCH);
        intro.update(7f);
        intro.render(canvas);

        assertEquals("centered Le vieux Garry vivait seul dans sa ferme, avec son chat. 280.0 36.0",
                canvas.calls.get(2));
    }

    // Each key of the intro has its file in the catalog: a missing line there would only fail when the image is drawn.
    @Test
    void everyIntroImageHasItsFile() {
        for (int scene = 1; scene <= 5; scene++) {
            assertEquals("cinematics/intro/" + scene + ".png", SpriteCatalog.pathOf("intro_" + scene));
        }
    }

    //-------------------- THE VICTORY --------------------
    // Asked by the J11 sheet: three scenes after a victory, in their order, then the end screen.
    @Test
    void theVictoryShowsItsThreeImagesInOrder() {
        Cinematic victory = Cinematic.victory(WORLD, FRENCH);
        List<String> images = new ArrayList<>();

        while (!victory.isOver()) {
            RecordingCanvas canvas = new RecordingCanvas();
            victory.render(canvas);
            images.add(canvas.calls.get(0));
            victory.handleClick();
        }

        assertEquals(List.of(
                "sprite victory_1 " + WORLD,
                "sprite victory_2 " + WORLD,
                "sprite victory_3 " + WORLD), images);
    }

    // Each key of the victory has its file in the catalog.
    @Test
    void everyVictoryImageHasItsFile() {
        for (int scene = 1; scene <= 3; scene++) {
            assertEquals("cinematics/victory/" + scene + ".png", SpriteCatalog.pathOf("victory_" + scene));
        }
    }
}
