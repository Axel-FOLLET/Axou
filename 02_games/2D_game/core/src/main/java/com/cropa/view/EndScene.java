package com.cropa.view;

// The model: the interface the session calls when the game changes, and the ways a game can end. Texts: the words of
// the scenes and of the buttons, in the language of the game.
// Java: Optional for "the game goes on" (nothing to show) and for "no button under the click", without null.
import com.cropa.model.game.GameListener;
import com.cropa.model.game.GameResult;
import com.cropa.text.Texts;
import java.util.Optional;

// implements GameListener, like Hud: the session tells it the day or night that starts and how the game ends, so it
// shows the right scene without asking the session anything. onMoneyChanged, onFarmHealthChanged and onTimerChanged
// stay empty: the end screen does not show them. No libGDX: it draws through Canvas and receives clicks as world points.
// The characters and the objects of the scenes are Figures, shared with the title screen.
/**
 * The end screen, over the frozen game: a dark veil, the scene of the victory or of one of the two defeats, its
 * sentences, and the "Rejouer" and "Quitter" buttons. Nothing is drawn while the game goes on.
 */
public class EndScene implements GameListener {

    //-------------------- CONSTANTS --------------------
    // Each result has its own light behind the figures.
    private static final String VICTORY_BACKGROUND = "end_victory";
    // Both defeats take place under the moon.
    private static final String DEFEAT_BACKGROUND = "end_defeat";
    // Leave the illustration visible through the text bands.
    private static final float BAND_OPACITY = 0.45f;
    // Heights from the bottom of the world: the title, the line the figures stand on, the two sentences, the buttons.
    // The y of a text is its top.
    private static final float TITLE_TOP = 280f;
    private static final float GROUND = 150f;
    private static final float FIRST_LINE_TOP = 125f;
    private static final float SECOND_LINE_TOP = 103f;
    private static final float BUTTON_TOP = 60f;
    // From the middle of one figure to the middle of the next.
    private static final float SPACING = 56f;
    // The urn M. Chmunks carries away: in front of him, at the height of his hands.
    private static final float CARRIED_X = 18f;
    private static final float CARRIED_HEIGHT = 14f;
    // The buttons: 80 px wide, their text centred, 60 px left and right of the middle. The bubble of a text goes from
    // 16 px under its top to 3 px above it, like the rows of ShopWindow.
    private static final float BUTTON_WIDTH = 80f;
    private static final float BUTTON_OFFSET = 60f;

    //-------------------- FIELDS --------------------
    // The whole world, covered by the veil; its middle, where the scene is centred.
    private final Bounds world;
    private final float centerX;
    // The words of the scenes and of the buttons, in the language of the game.
    private final Texts texts;
    // Where a click on each button acts: computed once in the constructor, then never changed.
    private final Bounds replayButton;
    private final Bounds quitButton;
    // The number of the day or night going on, and its kind: the end tells when it happened.
    private int number;
    private boolean night;
    // How the game ended. Empty while it goes on: nothing is drawn and no click is used.
    private Optional<GameResult> result = Optional.empty();
    // The figures breathe while the result is visible.
    private float time;

    //-------------------- CONSTRUCTOR --------------------
    // Called once by GameScreen.show(), with the same world as the night veil.
    /**
     * Creates the end screen, hidden until the game is over.
     *
     * @param world the whole world, in world pixels
     * @param texts the words of the scenes, in the language of the game
     */
    public EndScene(Bounds world, Texts texts) {
        this.world = world;
        this.texts = texts;
        centerX = world.x() + world.width() / 2;
        replayButton = buttonAround(centerX - BUTTON_OFFSET);
        quitButton = buttonAround(centerX + BUTTON_OFFSET);
    }

    //-------------------- EVENTS --------------------
    // Called by GameSession.notifyChanges, always before onGameOver in the same frame: the number is the one of the end.
    /**
     * Remembers the number of the day that starts.
     *
     * @param day the number of the day
     */
    @Override
    public void onDayStarted(int day) {
        number = day;
        night = false;
    }

    /**
     * Remembers the number of the night that starts.
     *
     * @param night the number of the night
     */
    @Override
    public void onNightStarted(int night) {
        number = night;
        this.night = true;
    }

    /**
     * Shows nothing: the end screen does not show the money.
     *
     * @param balance the player's money
     */
    @Override
    public void onMoneyChanged(int balance) {
    }

    /**
     * Shows nothing: the end screen does not show the farm's health.
     *
     * @param health the farm's health points
     */
    @Override
    public void onFarmHealthChanged(int health) {
    }

    /**
     * Shows nothing: the end screen does not show the timer.
     *
     * @param secondsLeft the seconds left, rounded up
     */
    @Override
    public void onTimerChanged(int secondsLeft) {
    }

    // Called once by GameSession.notifyChanges, at the first frame where the game has a result.
    /**
     * Shows the end screen of this result from the next drawing on.
     *
     * @param result how the game ended
     */
    @Override
    public void onGameOver(GameResult result) {
        this.result = Optional.of(result);
    }

    //-------------------- CLICKS --------------------
    // Called by GameScreen once the game is over. The screen decides what each choice does (a new game, or quit):
    // the end screen only knows what it shows.
    /**
     * Tells which button, if any, a click lands on.
     *
     * @param x the x of the click, in world pixels
     * @param y the y of the click, in world pixels
     * @return the button clicked, or an empty {@code Optional} if the screen is hidden or the click is elsewhere
     */
    public Optional<EndChoice> handleClick(float x, float y) {
        if (result.isEmpty()) {
            return Optional.empty();
        }
        if (replayButton.contains(x, y)) {
            return Optional.of(EndChoice.REPLAY);
        }
        if (quitButton.contains(x, y)) {
            return Optional.of(EndChoice.QUIT);
        }
        return Optional.empty();
    }

    // Read by the tests, which click in their middle instead of copying numbers.
    /**
     * Returns the clickable area of the "Rejouer" button.
     *
     * @return its area, in world pixels
     */
    public Bounds getReplayButton() {
        return replayButton;
    }

    /**
     * Returns the clickable area of the "Quitter" button.
     *
     * @return its area, in world pixels
     */
    public Bounds getQuitButton() {
        return quitButton;
    }

    //-------------------- TIME --------------------
    /**
     * Advances the end scene.
     *
     * @param delta elapsed time in seconds
     */
    public void update(float delta) {
        time += delta;
    }

    //-------------------- DRAWING --------------------
    // Called on every frame by GameScreen, last: the veil covers the game, the HUD and the shop. Then the scene of the
    // result, then the two buttons with their white outline. A switch over the enum: one scene per way of ending.
    /**
     * Draws the end screen if the game is over, nothing otherwise.
     *
     * @param canvas where to draw
     */
    public void render(Canvas canvas) {
        render(canvas, Pointer.AWAY);
    }

    /**
     * Draws the end screen with the current button frames.
     *
     * @param canvas where to draw
     * @param pointer the pointer in world coordinates
     */
    public void render(Canvas canvas, Pointer pointer) {
        if (result.isEmpty()) {
            return;
        }
        // Keep the illustrated ground and the figures clear between the two bands.
        String background = result.get() == GameResult.VICTORY ? VICTORY_BACKGROUND : DEFEAT_BACKGROUND;
        canvas.drawSprite(background, world);
        drawBand(canvas, TITLE_TOP - 22, 30);
        drawBand(canvas, BUTTON_TOP - 22, FIRST_LINE_TOP - BUTTON_TOP + 30);
        switch (result.get()) {
            case VICTORY -> drawVictory(canvas);
            case DEFEAT_FARM_DESTROYED -> drawFarmDestroyed(canvas);
            case DEFEAT_URN_SOLD -> drawUrnSold(canvas);
        }
        drawButton(canvas, pointer, texts.replay(), replayButton);
        drawButton(canvas, pointer, texts.quit(), quitButton);
    }

    // Garry, the urn and the ghost of his wife, side by side, facing the player.
    private void drawVictory(Canvas canvas) {
        canvas.drawCenteredText(texts.victoryTitle(), centerX, at(TITLE_TOP));
        Figure.GARRY.stand(canvas, centerX - SPACING, at(GROUND), time);
        Figure.URN.stand(canvas, centerX, at(GROUND), time);
        Figure.GHOST.stand(canvas, centerX + SPACING, at(GROUND), time + 0.4f);
        canvas.drawCenteredText(texts.urnBoughtBack(), centerX, at(FIRST_LINE_TOP));
        canvas.drawCenteredText(texts.boughtOnDay(number), centerX, at(SECOND_LINE_TOP));
    }

    // A lighter edge on either side softens the strip without darkening the figures.
    private void drawBand(Canvas canvas, float bottom, float height) {
        float y = at(bottom);
        canvas.drawColorLayer(new Bounds(world.x(), y, world.width(), 2), 0, 0, 0, BAND_OPACITY / 2);
        canvas.drawColorLayer(new Bounds(world.x(), y + 2, world.width(), height - 4), 0, 0, 0, BAND_OPACITY);
        canvas.drawColorLayer(new Bounds(world.x(), y + height - 2, world.width(), 2),
                0, 0, 0, BAND_OPACITY / 2);
    }

    // The destroyed farm, and when it fell: "la nuit 5" (the enemies only come at night), "le jour 5" otherwise.
    private void drawFarmDestroyed(Canvas canvas) {
        canvas.drawCenteredText(texts.defeatTitle(), centerX, at(TITLE_TOP));
        Figure.FARM_DESTROYED.stand(canvas, centerX, at(GROUND), time);
        canvas.drawCenteredText(texts.farmFell(night, number), centerX, at(FIRST_LINE_TOP));
    }

    // M. Chmunks goes away to the right with the urn, between Henchman 1 and Henchman 2.
    private void drawUrnSold(Canvas canvas) {
        canvas.drawCenteredText(texts.defeatTitle(), centerX, at(TITLE_TOP));
        Figure.HENCHMAN_1.stand(canvas, centerX - SPACING, at(GROUND), time);
        Figure.CHMUNKS.stand(canvas, centerX, at(GROUND), time + 0.4f);
        Figure.URN.stand(canvas, centerX + CARRIED_X, at(GROUND + CARRIED_HEIGHT), time);
        Figure.HENCHMAN_2.stand(canvas, centerX + SPACING, at(GROUND), time + 0.8f);
        canvas.drawCenteredText(texts.urnSold(), centerX, at(FIRST_LINE_TOP));
    }

    // Draw the frame first so the centred words stay visible in every state.
    private void drawButton(Canvas canvas, Pointer pointer, String text, Bounds button) {
        canvas.drawFrame(pointer.frame("button", button, false), button, Tint.NORMAL);
        canvas.drawPlainCenteredText(text, button.x() + button.width() / 2, at(BUTTON_TOP), TextStyle.NORMAL);
    }

    //-------------------- INTERNALS --------------------
    // A height of the scene, counted from the bottom of the world.
    private float at(float height) {
        return world.y() + height;
    }

    // The area of a button centred on x, around the text drawn at BUTTON_TOP.
    private Bounds buttonAround(float x) {
        return new Bounds(x - BUTTON_WIDTH / 2, at(BUTTON_TOP) - 16, BUTTON_WIDTH, 19);
    }
}
