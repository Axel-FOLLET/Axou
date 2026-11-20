package com.cropa.view;

// JUnit: the checks the tests use, and the annotations. Java: the lines of the bubbles, and the source of randomness of
// the session. The model: a real session on day 1, for the shop the tutorial opens, and a carrot planted by hand.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cropa.model.defense.DefenseType;
import com.cropa.model.defense.SlotSide;
import com.cropa.model.game.GameConfig;
import com.cropa.model.game.GameSession;
import com.cropa.model.world.Crop;
import com.cropa.model.world.CropConfig;
import com.cropa.model.world.CropType;
// Language and Texts: the words of the game in French, the language its layout was measured on.
import com.cropa.text.Language;
import com.cropa.text.Texts;
import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

// No window: the tutorial draws on a RecordingCanvas and receives clicks as world points, like ShopWindowTest.
// The session is a real one on day 1, its shop window the one the tutorial opens; the layout is the one of the tests.
/** Tests for {@link Tutorial}. */
class TutorialTest {

    //-------------------- CONSTANTS --------------------
    // The texts the game shows in French, its first language: the layout was measured on them.
    private static final Texts FRENCH = Texts.of(Language.FRENCH);

    //-------------------- FIELDS --------------------
    // The world of GameScreen: 560 x 320 px, 35 x 20 tiles of 16 px. The mask covers it, but for the target.
    private static final Bounds WORLD = new Bounds(0, 0, 560, 320);
    private GameSession session;
    private ShopWindow shop;
    private Tutorial tutorial;
    private RecordingCanvas canvas;

    //-------------------- HELPERS --------------------
    // The first game: the tutorial is shown, from its first bubble.
    @BeforeEach
    void startTheFirstDay() {
        session = new GameSession(new GameConfig(), new Random(0));
        shop = new ShopWindow(session, new GameConfig().getUrnPrice(), new CropConfig(), FRENCH, cue -> { });
        tutorial = new Tutorial(WORLD, TestLayouts.layout(), shop, true, FRENCH);
        canvas = new RecordingCanvas();
    }

    // One frame: a fresh canvas, then the tutorial draws on it.
    private void frame() {
        canvas = new RecordingCanvas();
        tutorial.render(canvas);
    }

    // The calls of the last frame but the mask: the bubble, its button, the arrow.
    private List<String> drawnOverTheMask() {
        return canvas.calls.stream().filter(call -> !call.startsWith("shade ")).toList();
    }

    // What each bubble points at, in order: a cell of the field (row 2, column 1, the left edge of the field), the
    // catapatate of the "Défenses" list, the garlic and the turnip of the "Planter" list, then the ghost catapatate on
    // a slot above the field (column 1): the area of a real one there.
    private static List<Bounds> targets() {
        BoardLayout layout = TestLayouts.layout();
        return List.of(
            layout.getCellBounds(2, 1),
            ShopWindow.defenseLine(DefenseType.CATAPATATE.ordinal()),
            ShopWindow.plantLine(CropType.GARLIC.ordinal()),
            ShopWindow.plantLine(CropType.TURNIP.ordinal()),
            ghostArea());
    }

    // Where a real catapatate would stand on the slot above the field, column 1: the ghost of bubble 5 stands there.
    private static Bounds ghostArea() {
        return DefenseRenderer.slotSpriteArea(TestLayouts.layout().getSlotBounds(SlotSide.TOP, 1));
    }

    // A click in the middle of the "Suivant" button.
    private boolean clickNext() {
        Bounds button = tutorial.nextButton();
        return tutorial.handleClick(button.x() + button.width() / 2, button.y() + button.height() / 2);
    }

    // The words of the bubble drawn on the last frame, its lines joined by a space ("" if no box was drawn).
    // RecordingCanvas writes "dialog <lines joined by ' / '> <area>".
    private String shownWords() {
        String prefix = "dialog ";
        String suffix = " " + Tutorial.AREA;
        return canvas.calls.stream()
                .filter(call -> call.startsWith(prefix) && call.endsWith(suffix))
                .map(call -> call.substring(prefix.length(), call.length() - suffix.length()).replace(" / ", " "))
                .findFirst()
                .orElse("");
    }

    // A click in the middle of the "Commencer à jouer" button of the last bubble.
    private boolean clickStart() {
        Bounds button = tutorial.startButton();
        return tutorial.handleClick(button.x() + button.width() / 2, button.y() + button.height() / 2);
    }

    // Clicks "Suivant" the given number of times: from bubble 1, it shows the bubble of that index.
    private void goToBubble(int bubble) {
        for (int click = 0; click < bubble; click++) {
            clickNext();
        }
    }

    // True if the shop window, drawn now, writes a text starting with these words ("text <words>" in RecordingCanvas).
    private boolean shopShows(String words) {
        RecordingCanvas shopCanvas = new RecordingCanvas();
        shop.render(shopCanvas);
        return shopCanvas.calls.stream().anyMatch(call -> call.startsWith("text " + words));
    }

    // The arrow drawn on the last frame, as RecordingCanvas writes it: "arrow <tip>".
    private String shownArrow() {
        return canvas.calls.stream().filter(call -> call.startsWith("arrow ")).findFirst().orElse("");
    }

    // The arrow expected on a target: it points to the right, its tip 2 px before the middle of the left edge.
    private static String arrowOn(Bounds target) {
        return "arrow " + new Point(target.x() - 2, target.y() + target.height() / 2);
    }

    // The words of a bubble of the tutorial, from 0, its lines joined by a space.
    private static String wordsOf(int bubble) {
        return String.join(" ", FRENCH.tutorialBubbles().get(bubble));
    }

    //-------------------- TESTS --------------------
    // Expected by the sheet of the day: the five bubbles in order, the first one at the start, then one per "Suivant".
    @Test
    void theBubblesComeInOrder() {
        for (int bubble = 0; bubble < FRENCH.tutorialBubbles().size(); bubble++) {
            frame();
            assertEquals(wordsOf(bubble), shownWords());
            clickNext();
        }
    }

    // The mask first (four bands), then the box, the "Suivant" button and its white outline, in the frame of the neighbour's
    // dialog, then the arrow, last: over the list of the shop drawn before it.
    @Test
    void aBubbleIsDrawnWithItsMaskItsNextButtonAndItsArrow() {
        frame();

        assertEquals(8, canvas.calls.size());
        for (int band = 0; band < 4; band++) {
            assertTrue(canvas.calls.get(band).startsWith("shade "));
        }
        assertTrue(canvas.calls.get(4).startsWith("dialog "));
        assertTrue(canvas.calls.get(5).startsWith("text Suivant "));
        assertEquals("outline WHITE " + tutorial.nextButton(), canvas.calls.get(6));
        assertTrue(canvas.calls.get(7).startsWith("arrow "));
    }

    // Modal (asked on day 14): bubble 1 no longer passes by itself, only "Suivant" moves the tutorial on. The
    // tutorial reads nothing in the model.
    @Test
    void aCropPlantedDoesNotPassTheFirstBubble() {
        session.getBoard().getCell(2, 2).place(new Crop(CropType.CARROT, new CropConfig()));
        frame();

        assertEquals(wordsOf(0), shownWords());
    }

    // "Suivant" takes the click on bubbles 1 to 4, so the click reaches nothing behind it.
    @Test
    void nextTakesTheClickAndShowsTheNextBubble() {
        for (int bubble = 0; bubble < FRENCH.tutorialBubbles().size() - 1; bubble++) {
            assertTrue(clickNext());
            frame();
            assertEquals(wordsOf(bubble + 1), shownWords());
        }
    }

    // The last bubble (asked on day 14): its button says "Commencer à jouer", not "Suivant", wider, at the same place
    // (bottom right of the frame).
    @Test
    void theLastBubbleShowsStartToPlay() {
        goToBubble(FRENCH.tutorialBubbles().size() - 1);
        frame();

        List<String> drawn = drawnOverTheMask();
        assertTrue(drawn.get(1).startsWith("text Commencer à jouer "));
        assertEquals("outline WHITE " + tutorial.startButton(), drawn.get(2));
        assertTrue(canvas.calls.stream().noneMatch(call -> call.startsWith("text Suivant ")));
    }

    // The bubbles before it keep "Suivant".
    @Test
    void theOtherBubblesNeverShowStartToPlay() {
        for (int bubble = 0; bubble < FRENCH.tutorialBubbles().size() - 1; bubble++) {
            frame();
            assertTrue(canvas.calls.stream().noneMatch(call -> call.contains("Commencer")), "bubble " + (bubble + 1));
            clickNext();
        }
    }

    // "Commencer à jouer" closes the tutorial: nothing drawn any more, and the next clicks go to the game.
    @Test
    void startOnTheLastBubbleClosesTheTutorial() {
        goToBubble(FRENCH.tutorialBubbles().size() - 1);
        assertFalse(tutorial.isOver());

        assertTrue(clickStart());
        frame();

        assertTrue(tutorial.isOver());
        assertTrue(canvas.calls.isEmpty());
        assertFalse(clickStart());
    }

    // The "Commencer à jouer" button holds its text: 130 px measured on lsans-15, 3 px on each side, inside the frame.
    @Test
    void theStartButtonFitsTheFrame() {
        Bounds button = tutorial.startButton();

        assertEquals(136, button.width());
        assertTrue(button.x() >= Tutorial.AREA.x());
        assertTrue(button.x() + button.width() <= Tutorial.AREA.x() + Tutorial.AREA.width());
    }

    // Modal: a click outside the button is taken too (true), so it reaches nothing behind the tutorial (the field,
    // the shop, "Lancer la nuit"), and the bubble stays.
    @Test
    void aClickOutsideTheButtonIsTakenAndChangesNothing() {
        assertTrue(tutorial.handleClick(270, 160));
        assertTrue(tutorial.handleClick(Tutorial.AREA.x() + 10, Tutorial.AREA.y() + Tutorial.AREA.height() - 10));
        assertTrue(tutorial.handleClick(shop.plantButton().x() + 5, shop.plantButton().y() + 5));
        frame();

        assertEquals(wordsOf(0), shownWords());
    }

    // Bubbles 3 and 4 give a hint, not the rule: the player finds the effect alone (the enemy turns away).
    @Test
    void theGarlicAndTurnipBubblesSayNothingMore() {
        clickNext();
        clickNext();
        frame();
        assertEquals("Les chauves-souris n'aiment pas l'ail.", shownWords());

        clickNext();
        frame();
        assertEquals("Les sorcières n'aiment pas le navet.", shownWords());
    }

    // After "Rejouer" (withTitle false), the player knows the game: no bubble, no click taken.
    @Test
    void noTutorialAfterReplay() {
        tutorial = new Tutorial(WORLD, TestLayouts.layout(), shop, false, FRENCH);
        frame();

        assertTrue(tutorial.isOver());
        assertTrue(canvas.calls.isEmpty());
        assertFalse(clickNext());
    }

    // Each line fits the box: 34 letters at most (the measure of the neighbour's dialog), 3 lines at most above the button.
    @Test
    void everyBubbleFitsTheBox() {
        for (List<String> lines : FRENCH.tutorialBubbles()) {
            assertTrue(lines.size() <= 3);
            lines.forEach(line -> assertTrue(line.length() <= 34, line));
        }
    }

    //-------------------- THE LISTS OF THE SHOP --------------------
    // Bubble 1 speaks of the field: whatever was open in the shop closes, so the list does not hide the arrow.
    @Test
    void theFirstBubbleClosesTheShop() {
        shop.showPlantList();
        tutorial = new Tutorial(WORLD, TestLayouts.layout(), shop, true, FRENCH);

        assertFalse(shop.isOpen());
    }

    // Bubble 2 speaks of the catapatate: the tutorial unrolls the "Défenses" list, where the arrow shows it.
    @Test
    void theDefenseBubbleShowsTheDefenseList() {
        goToBubble(1);

        assertTrue(shopShows("Catapatate"));
        assertFalse(shopShows("Carotte"));
    }

    // Bubbles 3 and 4 speak of the garlic and the turnip: the "Planter" list, where the arrow shows them.
    @Test
    void theGarlicAndTurnipBubblesShowThePlantList() {
        goToBubble(2);
        assertTrue(shopShows("Ail "));
        assertFalse(shopShows("Catapatate"));

        clickNext();
        assertTrue(shopShows("Navet "));
    }

    // Bubble 5 speaks of a slot of the field: the list rolls up.
    @Test
    void theUpgradeBubbleClosesTheList() {
        goToBubble(4);

        assertFalse(shop.isOpen());
    }

    // After "Rejouer", the tutorial never touches the shop.
    @Test
    void noTutorialLeavesTheShopAlone() {
        shop.showPlantList();
        tutorial = new Tutorial(WORLD, TestLayouts.layout(), shop, false, FRENCH);
        tutorial.handleClick(tutorial.nextButton().x() + 5, tutorial.nextButton().y() + 5);

        assertTrue(shop.isOpen());
    }

    //-------------------- THE ARROWS --------------------
    // Each bubble points at what it speaks of (asked on day 14).
    @Test
    void eachBubblePointsAtWhatItSpeaksOf() {
        List<Bounds> targets = targets();

        for (int bubble = 0; bubble < targets.size(); bubble++) {
            frame();
            assertEquals(arrowOn(targets.get(bubble)), shownArrow(), "bubble " + (bubble + 1));
            clickNext();
        }
    }

    //-------------------- THE MASK --------------------
    // Like a modal window (asked on day 14): the whole world is shaded but the target of the bubble, a spotlight. Four
    // bands around the target: under it and above it on the whole width, then on its left and on its right at its
    // height. The target itself is never shaded.
    @Test
    void eachBubbleShadesAllButItsTarget() {
        List<Bounds> targets = targets();

        for (int bubble = 0; bubble < targets.size(); bubble++) {
            Bounds t = targets.get(bubble);
            float top = t.y() + t.height();
            float right = t.x() + t.width();
            frame();

            assertEquals(List.of(
                    "shade " + new Bounds(0, 0, WORLD.width(), t.y()),
                    "shade " + new Bounds(0, top, WORLD.width(), WORLD.height() - top),
                    "shade " + new Bounds(0, t.y(), t.x(), t.height()),
                    "shade " + new Bounds(right, t.y(), WORLD.width() - right, t.height())),
                canvas.calls.subList(0, 4), "bubble " + (bubble + 1));
            clickNext();
        }
    }

    //-------------------- THE GHOST DEFENSE --------------------
    // Bubble 5 speaks of upgrading a defense, but none stands on day 1: a ghost catapatate (60 % opaque) shows one, on
    // its slot, over the mask. It comes after the button and before the arrow, which points at it.
    @Test
    void theUpgradeBubbleShowsAGhostCatapatate() {
        goToBubble(4);
        frame();

        List<String> drawn = drawnOverTheMask();
        assertEquals("sprite " + SpriteCatalog.CATAPATATE_TOP + " " + ghostArea() + " GHOST", drawn.get(3));
        assertTrue(drawn.get(4).startsWith("arrow "));
    }

    // The other bubbles show no sprite: the ghost belongs to bubble 5 only, and leaves with it.
    @Test
    void noGhostOnTheOtherBubbles() {
        for (int bubble = 0; bubble < FRENCH.tutorialBubbles().size() - 1; bubble++) {
            frame();
            assertTrue(canvas.calls.stream().noneMatch(call -> call.startsWith("sprite ")), "bubble " + (bubble + 1));
            clickNext();
        }
    }

    // The ghost is only drawn: no defense stands in the game, and nothing is paid.
    @Test
    void theGhostIsNotADefense() {
        int money = session.getWallet().getBalance();
        goToBubble(4);
        frame();

        assertTrue(session.getDefenseSlots().getDefenses().isEmpty());
        assertEquals(money, session.getWallet().getBalance());
    }
}
