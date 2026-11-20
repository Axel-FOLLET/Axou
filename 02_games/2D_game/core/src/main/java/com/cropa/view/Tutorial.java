package com.cropa.view;

// The model: the kinds of defense and of crop, whose order gives the line of the shop an arrow points at, and the side
// of the slot it points at. Texts: the words of the bubbles and of the buttons, in the language of the game.
// List: the lines of each bubble, and the steps.
import com.cropa.model.defense.DefenseType;
import com.cropa.model.defense.SlotSide;
import com.cropa.model.world.CropType;
import com.cropa.text.Texts;
import java.util.List;

// The tutorial of the first day (day 14, asked by the jury: the player did not know what to do at the start).
// Modal, like a window over the game: while it is shown, it takes every click, and only its button moves it on; the
// player reads, he does not act yet. GameScreen keeps the timer of the day frozen until it is over.
// No libGDX: the bubbles, the button and the clicks are tested on a RecordingCanvas.
/**
 * Guides the first day in five bubbles: plant a seed, place a defense, a hint on the garlic, a hint on the turnip,
 * upgrade a defense. Each bubble opens the list of the shop it speaks of and points at it with an arrow. While it is
 * shown, it takes every click; each bubble passes with its "Suivant" button, and the "Commencer à jouer" button of
 * the last bubble closes the tutorial.
 */
public class Tutorial {

    //-------------------- CONSTANTS --------------------
    // The frame of Melda's dialog, under the farm, over the forest (x 104 to 348, y 10 to 88): neither on the HUD (top
    // left), nor on the shop panel and the urn (right, from x 397), nor on the field (x 240 to 320, y 128 to 208).
    // Melda never comes on day 1 (her day is drawn from 2), so the two never share it on the first day.
    // Package-private: the tests find the bubble drawn in it.
    static final Bounds AREA = new Bounds(104, 10, 244, 78);
    // The text of the bubbles comes from Texts (tutorialBubbles), cut by hand: 34 letters at most per line (the measure
    // of Melda's dialog, HUD font; 236 px inside the frame, TextsTest checks it), and 3 lines at most, above the button.
    // Bubbles 3 and 4 say nothing more than the hint: the player finds the effect alone (the enemy turns away,
    // rules.md sections 6 and 8).
    // The list of the shop a bubble unrolls, so the player sees what it speaks of.
    private enum Menu { NONE, PLANT, DEFENSE }

    // What a bubble shows besides its words: the list it unrolls, the area its arrow points at (the only one the mask
    // leaves bright), and whether a ghost catapatate stands on that area.
    private record Step(Menu menu, Bounds target, boolean ghost) {
    }

    // The cell and the slot the arrows of bubbles 1 and 5 point at: column 1, the left edge of the field, so the arrow
    // stands on the grass beside it. Row 2, the middle of the field; the slot above it, far from the box of the bubble.
    // On that slot, bubble 5 shows a ghost catapatate: the upgrade it speaks of needs a defense, and none stands on
    // day 1. Only drawn: nothing is placed in the game, so nothing is to remove when the bubble passes.
    private static final int FIELD_ROW = 2;
    private static final int FIELD_COLUMN = 1;
    // The arrow points to the right, its tip 2 px before the left edge of its target, at mid-height.
    private static final float ARROW_GAP = 2f;
    // The button at the bottom right of the frame, like "Passer à la suite" in Melda's: its outline 3 px around its
    // words, ending at x 347 (inside the frame), 16 px under the top of the text and 3 px above it, like the buttons of
    // the HUD. "Suivant" is 48 px wide (lsans-15, the HUD font): its outline from x 293. The button of the last bubble
    // (asked on day 14), "Commencer à jouer", is 130 px wide: its outline from 347 - 136 = 211.
    private static final float BUTTON_RIGHT = 347f;
    private static final float NEXT_TOP = 27f;

    //-------------------- FIELDS --------------------
    // The whole world, which the mask covers but for the target of the bubble, and the shop window whose lists the
    // bubbles open. Never replaced: final.
    private final Bounds world;
    private final ShopWindow shop;
    // The words of the bubbles, and of the two buttons with their outline, in the language of the game.
    private final List<List<String>> bubbles;
    private final String nextLabel;
    private final Bounds nextButton;
    private final String startLabel;
    private final Bounds startButton;
    // One step per bubble, same order as bubbles. Built once by the constructor: the cell and the slot come from the
    // layout of the map.
    private final List<Step> steps;
    // The bubble shown, from 0; bubbles.size() once the tutorial is over.
    private int bubble;

    //-------------------- CONSTRUCTOR --------------------
    // Called once by GameScreen.show(), with its withTitle, like TitleScene: true for the first game, false after
    // "Rejouer", where the player already knows the game. false starts it over, so GameScreen needs no null.
    /**
     * Creates the tutorial of a game.
     *
     * @param world the whole world, in world pixels, which the mask covers
     * @param layout where the cells and the slots of the field are, for the arrows
     * @param shop the shop window, whose lists the bubbles open
     * @param shown true to show it from its first bubble, false to never show it
     * @param texts the words of the bubbles, in the language of the game
     */
    public Tutorial(Bounds world, BoardLayout layout, ShopWindow shop, boolean shown, Texts texts) {
        this.world = world;
        this.shop = shop;
        bubbles = texts.tutorialBubbles();
        nextLabel = texts.next();
        nextButton = buttonFor(nextLabel);
        startLabel = texts.startPlaying();
        startButton = buttonFor(startLabel);
        // The field (bubble 1) and its slots (bubble 5) are not in the shop: no list. The catapatate is in the
        // "Défenses" list, the garlic and the turnip in the "Planter" list: the order of the kinds is the order of the
        // lines (ShopWindow.defenseLine and plantLine). The ghost of bubble 5 takes the area of a real catapatate on
        // its slot (DefenseRenderer.slotSpriteArea), wider than the slot: the arrow and the bright hole fit it.
        steps = List.of(
            new Step(Menu.NONE, layout.getCellBounds(FIELD_ROW, FIELD_COLUMN), false),
            new Step(Menu.DEFENSE, ShopWindow.defenseLine(DefenseType.CATAPATATE.ordinal()), false),
            new Step(Menu.PLANT, ShopWindow.plantLine(CropType.GARLIC.ordinal()), false),
            new Step(Menu.PLANT, ShopWindow.plantLine(CropType.TURNIP.ordinal()), false),
            new Step(Menu.NONE,
                DefenseRenderer.slotSpriteArea(layout.getSlotBounds(SlotSide.TOP, FIELD_COLUMN)), true));
        bubble = shown ? 0 : bubbles.size();
        openMenu();
    }

    //-------------------- STATE --------------------
    /**
     * Tells whether the tutorial is over: closed by the "Commencer à jouer" of its last bubble, or never shown.
     *
     * @return true once no bubble is shown any more
     */
    public boolean isOver() {
        return bubble >= bubbles.size();
    }

    //-------------------- DRAWING --------------------
    // Called on every frame by GameScreen, after the HUD and the shop panel: the bubble passes over them. Only once the
    // title screen and the intro are gone (the last else of GameScreen.render), so never during the cinematic.
    // The mask first, over the HUD and the shop drawn before the tutorial, but for the target: the eye goes to it. The
    // ghost catapatate of bubble 5 over the mask, then the arrow last: over the list of the shop and the ghost.
    /**
     * Darkens the world but the target of the bubble shown, then draws the bubble in a dark box, with its button
     * ("Suivant", or "Commencer à jouer" on the last one), the ghost catapatate of the upgrade bubble, and the arrow
     * pointing at what it speaks of.
     * Draws nothing once the tutorial is over.
     *
     * @param canvas where to draw
     */
    public void render(Canvas canvas) {
        if (isOver()) {
            return;
        }
        Bounds target = steps.get(bubble).target();
        shadeAround(canvas, target);
        canvas.drawDialog(bubbles.get(bubble), AREA);
        Bounds button = button();
        canvas.drawText(isLastBubble() ? startLabel : nextLabel, button.x() + 3, NEXT_TOP);
        canvas.drawOutline(button, OutlineColor.WHITE);
        if (steps.get(bubble).ghost()) {
            canvas.drawSprite(SpriteCatalog.CATAPATATE_TOP, target, Tint.GHOST);
        }
        canvas.drawArrow(new Point(target.x() - ARROW_GAP, target.y() + target.height() / 2));
    }

    //-------------------- CLICKS --------------------
    // Called by GameScreen on every click, after Melda and before the HUD. Modal: while a bubble is shown, every click
    // is taken (true), like Melda's while she talks, so none reaches the HUD, the shop or the field; only the one on
    // the button moves the tutorial on. Once it is over, false: the game gets its clicks back.
    /**
     * Takes every click while a bubble is shown: a click on its button shows the next bubble, or closes the tutorial
     * on the last one; any other click does nothing.
     *
     * @param x the x of the click, in world pixels
     * @param y the y of the click, in world pixels
     * @return true while the tutorial is shown: the click must reach nothing else
     */
    public boolean handleClick(float x, float y) {
        if (isOver()) {
            return false;
        }
        if (button().contains(x, y)) {
            bubble++;
            openMenu();
        }
        return true;
    }

    //-------------------- BUTTONS --------------------
    // Read by the tests, which click in their middle.
    /**
     * Returns the "Suivant" button of the bubbles but the last one.
     *
     * @return its area, in world pixels
     */
    public Bounds nextButton() {
        return nextButton;
    }

    /**
     * Returns the "Commencer à jouer" button of the last bubble.
     *
     * @return its area, in world pixels
     */
    public Bounds startButton() {
        return startButton;
    }

    //-------------------- INTERNALS --------------------
    // The last bubble closes the tutorial: its button starts the game.
    private boolean isLastBubble() {
        return bubble == bubbles.size() - 1;
    }

    // The outline of a button: its words plus 3 px on each side, its right edge at BUTTON_RIGHT.
    private static Bounds buttonFor(String words) {
        float width = TextWidth.of(words) + 6;
        return new Bounds(BUTTON_RIGHT - width, NEXT_TOP - 16, width, 19);
    }

    // The mask, a spotlight: four bands that cover the world but the target. Under it and above it on the whole width,
    // then on its left and on its right at its height, so no band covers another and the target stays bright.
    private void shadeAround(Canvas canvas, Bounds target) {
        float top = target.y() + target.height();
        float right = target.x() + target.width();
        canvas.drawShade(new Bounds(world.x(), world.y(), world.width(), target.y() - world.y()));
        canvas.drawShade(new Bounds(world.x(), top, world.width(), world.y() + world.height() - top));
        canvas.drawShade(new Bounds(world.x(), target.y(), target.x() - world.x(), target.height()));
        canvas.drawShade(new Bounds(right, target.y(), world.x() + world.width() - right, target.height()));
    }

    // The button of the bubble shown: "Commencer à jouer" on the last one, "Suivant" on the others.
    private Bounds button() {
        return isLastBubble() ? startButton : nextButton;
    }

    // Called when a bubble comes: by the constructor for the first one, by handleClick for the next ones. The shop
    // shows the list of the bubble, or closes; once the tutorial is over (or never shown), the shop is left alone, so
    // the last bubble's closed shop is the one the player starts with.
    private void openMenu() {
        if (isOver()) {
            return;
        }
        switch (steps.get(bubble).menu()) {
            case PLANT -> shop.showPlantList();
            case DEFENSE -> shop.showDefenseList();
            case NONE -> shop.close();
        }
    }
}
