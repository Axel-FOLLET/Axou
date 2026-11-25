package com.cropa.view;

// JUnit: the checks the tests use, and the annotation that marks a test.
// The model: a real the neighbour, and GameConfig for her real texts. List: her texts. Random: the seed of her day.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cropa.model.game.GameConfig;
import com.cropa.model.game.Neighbour;
// Language and Texts: the words of the game in French, the language its layout was measured on.
import com.cropa.text.Language;
import com.cropa.text.Texts;
import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.Test;

// No window and no libGDX: NeighbourRenderer draws on a RecordingCanvas, and a click is given as world pixels.
// The test layout puts the farm point at (80, 160) and the farmer at x 136: her forest walk starts at (-60, 104)
// (80 - 140, 160 - 56), her place in front of Garry is (136, 128) (160 - 32). The dialog does not depend on the map.
/**
 * Tests for {@link NeighbourRenderer}.
 */
class NeighbourRendererTest {

    //-------------------- CONSTANTS --------------------
    // The texts the game shows in French, its first language: the layout was measured on them.
    private static final Texts FRENCH = Texts.of(Language.FRENCH);

    //-------------------- HELPERS --------------------
    // 10 letters per second, as in NeighbourTest: after 0.5 s, "Bon m" is written, "Bon" is whole; after 1 s, all.
    private static final List<String> FACTS = List.of("Bon matin", "Au revoir");
    private static final Bounds DIALOG = new Bounds(104, 10, 244, 78);
    private static final Bounds NEXT_BUTTON = new Bounds(228, 11, 115, 19);

    // A the neighbour whose day has not come: she is not on screen.
    private static Neighbour neighbourAbsent() {
        return new Neighbour(FACTS, 10f, 8, new Random(0));
    }

    // A the neighbour whose day has come: she starts her walk in the forest.
    private static Neighbour neighbourWandering() {
        Neighbour neighbour = neighbourAbsent();
        neighbour.startIfToday(neighbour.getDay());
        return neighbour;
    }

    // A the neighbour in front of Garry: 8 s in the forest, 6 s to him; her first bubble starts with no letter.
    private static Neighbour neighbourTalking() {
        Neighbour neighbour = neighbourWandering();
        neighbour.update(8f);
        neighbour.update(6f);
        return neighbour;
    }

    private static NeighbourRenderer renderer() {
        return new NeighbourRenderer(TestLayouts.layout(), FRENCH);
    }

    // The middle of the "Passer à la suite" button.
    private static boolean clickNext(NeighbourRenderer renderer, Neighbour neighbour) {
        return renderer.handleClick(neighbour, NEXT_BUTTON.x() + NEXT_BUTTON.width() / 2,
            NEXT_BUTTON.y() + NEXT_BUTTON.height() / 2);
    }

    //-------------------- HER WALKS --------------------
    // Before her day, nothing at all: the view reads her phase at each frame.
    // Without this test, she could stand on the map from the first day.
    @Test
    void absentNeighbourDrawsNothing() {
        RecordingCanvas canvas = new RecordingCanvas();

        renderer().renderNeighbour(canvas, neighbourAbsent());
        renderer().renderDialog(canvas, neighbourAbsent());

        assertTrue(canvas.calls.isEmpty());
    }

    // The start of her walk in the forest: on its first point, turned east (the next point is 40 px right, 8 px down).
    @Test
    void sheStartsInTheForestTurnedTheWaySheWalks() {
        RecordingCanvas canvas = new RecordingCanvas();

        renderer().renderNeighbour(canvas, neighbourWandering());

        assertEquals(2, canvas.calls.size());
        assertTrue(canvas.calls.get(0).startsWith("sprite shadow "));
        assertEquals("sprite neighbour_east " + new Bounds(-72, 104, 24, 24), canvas.calls.get(1));
    }

    // The end of her way to Garry: the last part goes from (120, 122) to (136, 128), up and right, so east still.
    @Test
    void sheComesToGarry() {
        Neighbour neighbour = neighbourWandering();
        neighbour.update(8f);
        neighbour.update(5.9f);
        RecordingCanvas canvas = new RecordingCanvas();

        renderer().renderNeighbour(canvas, neighbour);

        assertTrue(canvas.calls.get(1).startsWith("sprite neighbour_east "));
        assertTrue(canvas.extras.stream().anyMatch(c -> c.startsWith("animation neighbour_east ")
                && !c.endsWith(" 0.0 NORMAL")));
    }

    // In front of Garry: her back to the player, and the small bubble on her left (136 - 12 - 24 = 100), 6 px up.
    @Test
    void talkingNeighbourFacesGarryWithHerBubble() {
        RecordingCanvas canvas = new RecordingCanvas();

        renderer().renderNeighbour(canvas, neighbourTalking());

        assertTrue(canvas.extras.contains("animation neighbour_north " + new Bounds(124, 128, 24, 24) + " 0.0 NORMAL"));
        float width = 24f * 0.6f;
        float height = width * 12 / 32;
        assertEquals(List.of(
                "sprite shadow " + new Bounds(136 - width / 2, 129.5f - height / 2, width, height),
                "sprite neighbour_north " + new Bounds(124, 128, 24, 24),
                "sprite neighbour_bubble " + new Bounds(100, 134, 24, 24)), canvas.calls);
    }

    // Her last bubble passed: she leaves from Garry, first back under the farm (to the left and down: west), then
    // after 6 s she is gone.
    // Without this test, she could stay in front of Garry for the rest of the day.
    @Test
    void sheLeavesThenIsGone() {
        Neighbour neighbour = neighbourTalking();
        NeighbourRenderer renderer = renderer();
        neighbour.update(1f);
        clickNext(renderer, neighbour);
        neighbour.update(1f);
        clickNext(renderer, neighbour);
        RecordingCanvas leaving = new RecordingCanvas();

        renderer.renderNeighbour(leaving, neighbour);
        assertEquals(2, leaving.calls.size());
        assertTrue(leaving.calls.get(0).startsWith("sprite shadow "));
        assertEquals("sprite neighbour_west " + new Bounds(124, 128, 24, 24), leaving.calls.get(1));

        neighbour.update(6f);
        RecordingCanvas gone = new RecordingCanvas();
        renderer.renderNeighbour(gone, neighbour);
        assertTrue(gone.calls.isEmpty());
    }

    // The 8 directions: a move straight down is south, up and to the left is north-west.
    @Test
    void directionFollowsTheMove() {
        assertEquals("south", NeighbourRenderer.directionOf(new Point(0, 0), new Point(0, -10)));
        assertEquals("north_west", NeighbourRenderer.directionOf(new Point(0, 0), new Point(-10, 10)));
    }

    //-------------------- HER DIALOG --------------------
    // While she writes: the words in the dialog box, the button greyed, its white outline.
    @Test
    void whileSheWritesTheButtonIsGreyed() {
        Neighbour neighbour = neighbourTalking();
        neighbour.update(0.5f);
        RecordingCanvas canvas = new RecordingCanvas();

        renderer().renderDialog(canvas, neighbour);

        assertEquals(List.of(
                "sprite bubble_frame " + new Bounds(100, 6, 252, 86),
                "sprite portrait_frame " + new Bounds(60, 60, 32, 32),
                "sprite portrait_neighbour " + new Bounds(64, 64, 24, 24),
                "sprite bubble_tail_left " + new Bounds(92, 76, 8, 8),
                "dialog Bon " + DIALOG,
                "sprite button_disabled_frame " + NEXT_BUTTON,
                "text Passer à la suite 231.0 27.0 GREYED"), canvas.calls);
    }

    // The bubble whole: the button is white (NORMAL adds no word to the line).
    @Test
    void onceTheBubbleIsWrittenTheButtonIsActive() {
        Neighbour neighbour = neighbourTalking();
        neighbour.update(1f);
        RecordingCanvas canvas = new RecordingCanvas();

        renderer().renderDialog(canvas, neighbour);

        assertEquals("dialog Bon matin " + DIALOG, canvas.calls.get(4));
        assertEquals("text Passer à la suite 231.0 27.0", canvas.calls.get(6));
    }

    // At the start of a bubble, no word is whole: the box stays, empty, so it does not blink between two bubbles.
    @Test
    void theBoxStaysWhileNoWordIsWhole() {
        RecordingCanvas canvas = new RecordingCanvas();

        renderer().renderDialog(canvas, neighbourTalking());

        assertEquals("dialog  " + DIALOG, canvas.calls.get(4));
    }

    // Her walks have no dialog.
    @Test
    void noDialogWhileSheWalks() {
        RecordingCanvas canvas = new RecordingCanvas();

        renderer().renderDialog(canvas, neighbourWandering());

        assertTrue(canvas.calls.isEmpty());
    }

    //-------------------- CLICKS --------------------
    // The button while she writes: the click is hers, but nothing happens (no faster writing, no next bubble).
    @Test
    void clickWhileSheWritesChangesNothing() {
        Neighbour neighbour = neighbourTalking();
        neighbour.update(0.5f);

        assertTrue(clickNext(renderer(), neighbour));
        assertEquals("Bon", neighbour.getCurrentBubble());
    }

    // The button once the bubble is whole: the next bubble starts, empty.
    @Test
    void clickOnceWrittenShowsTheNextBubble() {
        Neighbour neighbour = neighbourTalking();
        neighbour.update(1f);

        assertTrue(clickNext(renderer(), neighbour));
        assertEquals("", neighbour.getCurrentBubble());
        assertTrue(neighbour.isTalking());
    }

    // Anywhere else while she talks (the shop, the field, the dialog text): the click is hers, so nothing else gets
    // it, and her bubble does not move.
    // Without this test, the player could buy or plant while she talks.
    @Test
    void sheTakesEveryClickWhileSheTalks() {
        Neighbour neighbour = neighbourTalking();
        neighbour.update(1f);

        assertTrue(renderer().handleClick(neighbour, 300, 300));
        assertTrue(renderer().handleClick(neighbour, 150, 60));
        assertEquals("Bon matin", neighbour.getCurrentBubble());
    }

    // When she does not talk (walking, absent), the clicks go on to the rest of the game.
    @Test
    void clicksAreNotHersWhenSheDoesNotTalk() {
        assertFalse(renderer().handleClick(neighbourWandering(), 300, 300));
        assertFalse(clickNext(renderer(), neighbourAbsent()));
    }

    //-------------------- LINES --------------------
    // Her 11 real texts (both versions): each one fits in 3 lines of 34 letters at most, and no word is lost.
    // Without this test, a new text could need a 4th line, and lose its first words on screen.
    @Test
    void herRealTextsFitInThreeLines() {
        for (boolean firstGame : new boolean[] {true, false}) {
            for (String fact : new GameConfig(Language.FRENCH, firstGame).getNeighbourFacts()) {
                List<String> lines = NeighbourRenderer.linesOf(fact);

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

        List<String> lines = NeighbourRenderer.linesOf(text);

        assertEquals(3, lines.size());
        assertTrue(lines.get(0).startsWith("huit"));
        assertTrue(lines.get(2).endsWith("vingt"));
    }
}
