package com.cropa.view;

// JUnit: the checks the tests use, and the annotation that marks a test.
// The model: a real Melda, and GameConfig for her real texts. List: her texts. Random: the seed of her day.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cropa.model.game.GameConfig;
import com.cropa.model.game.Melda;
// Language and Texts: the words of the game in French, the language its layout was measured on.
import com.cropa.text.Language;
import com.cropa.text.Texts;
import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.Test;

// No window and no libGDX: MeldaRenderer draws on a RecordingCanvas, and a click is given as world pixels.
// The test layout puts the farm point at (80, 160) and the farmer at x 136: her forest walk starts at (-60, 104)
// (80 - 140, 160 - 56), her place in front of Garry is (136, 128) (160 - 32). The dialog does not depend on the map.
/**
 * Tests for {@link MeldaRenderer}.
 */
class MeldaRendererTest {

    //-------------------- CONSTANTS --------------------
    // The texts the game shows in French, its first language: the layout was measured on them.
    private static final Texts FRENCH = Texts.of(Language.FRENCH);

    //-------------------- HELPERS --------------------
    // 10 letters per second, as in MeldaTest: after 0.5 s, "Bon m" is written, "Bon" is whole; after 1 s, all.
    private static final List<String> FACTS = List.of("Bon matin", "Au revoir");
    private static final Bounds DIALOG = new Bounds(104, 10, 244, 78);
    private static final Bounds NEXT_BUTTON = new Bounds(228, 11, 115, 19);

    // A Melda whose day has not come: she is not on screen.
    private static Melda meldaAbsent() {
        return new Melda(FACTS, 10f, 8, new Random(0));
    }

    // A Melda whose day has come: she starts her walk in the forest.
    private static Melda meldaWandering() {
        Melda melda = meldaAbsent();
        melda.startIfToday(melda.getDay());
        return melda;
    }

    // A Melda in front of Garry: 8 s in the forest, 6 s to him; her first bubble starts with no letter.
    private static Melda meldaTalking() {
        Melda melda = meldaWandering();
        melda.update(8f);
        melda.update(6f);
        return melda;
    }

    private static MeldaRenderer renderer() {
        return new MeldaRenderer(TestLayouts.layout(), FRENCH);
    }

    // The middle of the "Passer à la suite" button.
    private static boolean clickNext(MeldaRenderer renderer, Melda melda) {
        return renderer.handleClick(melda, NEXT_BUTTON.x() + NEXT_BUTTON.width() / 2,
            NEXT_BUTTON.y() + NEXT_BUTTON.height() / 2);
    }

    //-------------------- HER WALKS --------------------
    // Before her day, nothing at all: the view reads her phase at each frame.
    // Without this test, she could stand on the map from the first day.
    @Test
    void absentMeldaDrawsNothing() {
        RecordingCanvas canvas = new RecordingCanvas();

        renderer().renderMelda(canvas, meldaAbsent());
        renderer().renderDialog(canvas, meldaAbsent());

        assertTrue(canvas.calls.isEmpty());
    }

    // The start of her walk in the forest: on its first point, turned east (the next point is 40 px right, 8 px down).
    @Test
    void sheStartsInTheForestTurnedTheWaySheWalks() {
        RecordingCanvas canvas = new RecordingCanvas();

        renderer().renderMelda(canvas, meldaWandering());

        assertEquals(List.of("sprite melda_east " + new Bounds(-72, 104, 24, 24)), canvas.calls);
    }

    // The end of her way to Garry: the last part goes from (120, 122) to (136, 128), up and right, so east still.
    @Test
    void sheComesToGarry() {
        Melda melda = meldaWandering();
        melda.update(8f);
        melda.update(5.9f);
        RecordingCanvas canvas = new RecordingCanvas();

        renderer().renderMelda(canvas, melda);

        assertTrue(canvas.calls.get(0).startsWith("sprite melda_east "));
    }

    // In front of Garry: her back to the player, and the small bubble on her left (136 - 12 - 24 = 100), 6 px up.
    @Test
    void talkingMeldaFacesGarryWithHerBubble() {
        RecordingCanvas canvas = new RecordingCanvas();

        renderer().renderMelda(canvas, meldaTalking());

        assertEquals(List.of(
                "sprite melda_north " + new Bounds(124, 128, 24, 24),
                "sprite melda_bubble " + new Bounds(100, 134, 24, 24)), canvas.calls);
    }

    // Her last bubble passed: she leaves from Garry, first back under the farm (to the left and down: west), then
    // after 6 s she is gone.
    // Without this test, she could stay in front of Garry for the rest of the day.
    @Test
    void sheLeavesThenIsGone() {
        Melda melda = meldaTalking();
        MeldaRenderer renderer = renderer();
        melda.update(1f);
        clickNext(renderer, melda);
        melda.update(1f);
        clickNext(renderer, melda);
        RecordingCanvas leaving = new RecordingCanvas();

        renderer.renderMelda(leaving, melda);
        assertEquals(List.of("sprite melda_west " + new Bounds(124, 128, 24, 24)), leaving.calls);

        melda.update(6f);
        RecordingCanvas gone = new RecordingCanvas();
        renderer.renderMelda(gone, melda);
        assertTrue(gone.calls.isEmpty());
    }

    // The 8 directions: a move straight down is south, up and to the left is north-west.
    @Test
    void directionFollowsTheMove() {
        assertEquals("south", MeldaRenderer.directionOf(new Point(0, 0), new Point(0, -10)));
        assertEquals("north_west", MeldaRenderer.directionOf(new Point(0, 0), new Point(-10, 10)));
    }

    //-------------------- HER DIALOG --------------------
    // While she writes: the words in the dialog box, the button greyed, its white outline.
    @Test
    void whileSheWritesTheButtonIsGreyed() {
        Melda melda = meldaTalking();
        melda.update(0.5f);
        RecordingCanvas canvas = new RecordingCanvas();

        renderer().renderDialog(canvas, melda);

        assertEquals(List.of(
                "dialog Bon " + DIALOG,
                "text Passer à la suite 231.0 27.0 GREYED",
                "outline WHITE " + NEXT_BUTTON), canvas.calls);
    }

    // The bubble whole: the button is white (NORMAL adds no word to the line).
    @Test
    void onceTheBubbleIsWrittenTheButtonIsActive() {
        Melda melda = meldaTalking();
        melda.update(1f);
        RecordingCanvas canvas = new RecordingCanvas();

        renderer().renderDialog(canvas, melda);

        assertEquals("dialog Bon matin " + DIALOG, canvas.calls.get(0));
        assertEquals("text Passer à la suite 231.0 27.0", canvas.calls.get(1));
    }

    // At the start of a bubble, no word is whole: the box stays, empty, so it does not blink between two bubbles.
    @Test
    void theBoxStaysWhileNoWordIsWhole() {
        RecordingCanvas canvas = new RecordingCanvas();

        renderer().renderDialog(canvas, meldaTalking());

        assertEquals("dialog  " + DIALOG, canvas.calls.get(0));
    }

    // Her walks have no dialog.
    @Test
    void noDialogWhileSheWalks() {
        RecordingCanvas canvas = new RecordingCanvas();

        renderer().renderDialog(canvas, meldaWandering());

        assertTrue(canvas.calls.isEmpty());
    }

    //-------------------- CLICKS --------------------
    // The button while she writes: the click is hers, but nothing happens (no faster writing, no next bubble).
    @Test
    void clickWhileSheWritesChangesNothing() {
        Melda melda = meldaTalking();
        melda.update(0.5f);

        assertTrue(clickNext(renderer(), melda));
        assertEquals("Bon", melda.getCurrentBubble());
    }

    // The button once the bubble is whole: the next bubble starts, empty.
    @Test
    void clickOnceWrittenShowsTheNextBubble() {
        Melda melda = meldaTalking();
        melda.update(1f);

        assertTrue(clickNext(renderer(), melda));
        assertEquals("", melda.getCurrentBubble());
        assertTrue(melda.isTalking());
    }

    // Anywhere else while she talks (the shop, the field, the dialog text): the click is hers, so nothing else gets
    // it, and her bubble does not move.
    // Without this test, the player could buy or plant while she talks.
    @Test
    void sheTakesEveryClickWhileSheTalks() {
        Melda melda = meldaTalking();
        melda.update(1f);

        assertTrue(renderer().handleClick(melda, 300, 300));
        assertTrue(renderer().handleClick(melda, 150, 60));
        assertEquals("Bon matin", melda.getCurrentBubble());
    }

    // When she does not talk (walking, absent), the clicks go on to the rest of the game.
    @Test
    void clicksAreNotHersWhenSheDoesNotTalk() {
        assertFalse(renderer().handleClick(meldaWandering(), 300, 300));
        assertFalse(clickNext(renderer(), meldaAbsent()));
    }

    //-------------------- LINES --------------------
    // Her 11 real texts (both versions): each one fits in 3 lines of 34 letters at most, and no word is lost.
    // Without this test, a new text could need a 4th line, and lose its first words on screen.
    @Test
    void herRealTextsFitInThreeLines() {
        for (boolean firstGame : new boolean[] {true, false}) {
            for (String fact : new GameConfig(Language.FRENCH, firstGame).getMeldaFacts()) {
                List<String> lines = MeldaRenderer.linesOf(fact);

                assertTrue(lines.size() <= 3, fact);
                assertTrue(lines.stream().allMatch(line -> line.length() <= 34), fact);
                assertEquals(fact, String.join(" ", lines));
            }
        }
    }

    // A text longer than hers: only the last 3 lines are kept, so the newest words stay on screen.
    @Test
    void longerTextKeepsItsLastThreeLines() {
        String text = "un deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze seize"
                + " dix-sept dix-huit dix-neuf vingt";

        List<String> lines = MeldaRenderer.linesOf(text);

        assertEquals(3, lines.size());
        assertTrue(lines.get(0).startsWith("huit"));
        assertTrue(lines.get(2).endsWith("vingt"));
    }
}
