package com.cropa.view;

// Texts: the title and the words of the buttons, in the language of the game.
// Java: List, the lines of the title; Optional for "no choice" (the screen is closed) without null.
import com.cropa.text.Texts;
import java.util.List;
import java.util.Optional;

// No interface: the title screen does not listen to the session. It is shown before the game starts, and only a click
// closes it. No libGDX: it draws through Canvas.
/**
 * The title screen, over the farm darkened: the full title of the game, M. Chmunks holding the urn between Henchman 1 and
 * Henchman 2, "Cliquer pour jouer", and at the top right the button of the other language. A click on that button starts
 * the game over in the other language; a click anywhere else closes the title screen, and the game starts.
 */
public class TitleScene {

    //-------------------- CONSTANTS --------------------
    // The full title (rules.md, §1) comes from Texts, cut in three lines: in one line, it would be about 970 px wide in
    // the 560 px world. The longest line is 368 px in the HUD font, in French.
    // The language button, at the top right of the world: its outline 3 px around its words, ending 8 px from the
    // right edge, its text top on the line of the HUD and of the shop buttons (y 312).
    private static final float LANGUAGE_RIGHT_MARGIN = 8f;
    private static final float LANGUAGE_TOP = 312f;
    // Darker than the deepest night (NightRenderer: 0.5), lighter than the end screen (0.85): the farm stays visible.
    private static final float VEIL_OPACITY = 0.6f;
    // Heights from the bottom of the world; the y of a text is its top. The font is 18 px a line: 22 px between lines.
    private static final float TITLE_TOP = 290f;
    private static final float LINE_SPACING = 22f;
    private static final float GROUND = 150f;
    private static final float PLAY_TOP = 95f;
    // From the middle of one figure to the middle of the next.
    private static final float SPACING = 64f;
    // The urn M. Chmunks holds: in front of him, a little above his feet.
    private static final float HELD_HEIGHT = 8f;

    //-------------------- FIELDS --------------------
    // The whole world, covered by the veil; its middle, where the scene is centred.
    private final Bounds world;
    private final float centerX;
    // The words of the screen, in the language of the game, and where a click on the language button acts.
    private final List<String> titleLines;
    private final String playLabel;
    private final String languageLabel;
    private final Bounds languageButton;
    // true until the first click: then nothing is drawn and the clicks go to the game.
    private boolean visible;

    //-------------------- CONSTRUCTOR --------------------
    // Called once by GameScreen.show(), with the same world as the night veil. visible: true at launch, false after
    // "Rejouer", which starts the new game right away.
    /**
     * Creates the title screen.
     *
     * @param world the whole world, in world pixels
     * @param visible true to show it until the first click, false to never show it
     * @param texts the words of the screen, in the language of the game
     */
    public TitleScene(Bounds world, boolean visible, Texts texts) {
        this.world = world;
        this.visible = visible;
        centerX = world.x() + world.width() / 2;
        titleLines = texts.titleLines();
        playLabel = texts.clickToPlay();
        languageLabel = texts.otherLanguage();
        float width = TextWidth.of(languageLabel) + 6;
        languageButton = new Bounds(world.x() + world.width() - LANGUAGE_RIGHT_MARGIN - width,
            at(LANGUAGE_TOP) - 16, width, 19);
    }

    //-------------------- STATE --------------------
    // Read by GameScreen on every frame: while the title is shown, the game does not move forward.
    /**
     * Tells whether the title screen is shown.
     *
     * @return true until the first click
     */
    public boolean isVisible() {
        return visible;
    }

    // Read by the tests, which click in its middle.
    /**
     * Returns the button of the other language.
     *
     * @return its area, in world pixels
     */
    public Bounds getLanguageButton() {
        return languageButton;
    }

    //-------------------- CLICKS --------------------
    // Called by GameScreen on every click, first. The language button leaves the screen shown: GameScreen starts the
    // game over in the other language, title screen included. "Cliquer pour jouer": anywhere else.
    /**
     * Takes a click while the title screen is shown: on the language button, the other language is asked for;
     * anywhere else, the title screen closes.
     *
     * @param x the x of the click, in world pixels
     * @param y the y of the click, in world pixels
     * @return the choice of the click, which must reach nothing else; empty if the screen was already closed
     */
    public Optional<TitleChoice> handleClick(float x, float y) {
        if (!visible) {
            return Optional.empty();
        }
        if (languageButton.contains(x, y)) {
            return Optional.of(TitleChoice.SWITCH_LANGUAGE);
        }
        visible = false;
        return Optional.of(TitleChoice.PLAY);
    }

    //-------------------- DRAWING --------------------
    // Called on every frame by GameScreen, after the farm and instead of the HUD. The veil darkens the farm, then the
    // three lines of the title, 22 px apart; Henchman 1 on the left, M. Chmunks in the middle with the urn drawn after him,
    // so in front of him, Henchman 2 on the right, all facing the player; then the invitation to click, and the language
    // button with the white outline of what can be clicked.
    /**
     * Draws the title screen if it is shown, nothing otherwise.
     *
     * @param canvas where to draw
     */
    public void render(Canvas canvas) {
        if (!visible) {
            return;
        }
        canvas.drawNightVeil(world, VEIL_OPACITY);
        for (int line = 0; line < titleLines.size(); line++) {
            canvas.drawCenteredText(titleLines.get(line), centerX, at(TITLE_TOP - line * LINE_SPACING));
        }
        Figure.HENCHMAN_1_FRONT.stand(canvas, centerX - SPACING, at(GROUND));
        Figure.CHMUNKS_FRONT.stand(canvas, centerX, at(GROUND));
        Figure.URN.stand(canvas, centerX, at(GROUND + HELD_HEIGHT));
        Figure.HENCHMAN_2_FRONT.stand(canvas, centerX + SPACING, at(GROUND));
        canvas.drawCenteredText(playLabel, centerX, at(PLAY_TOP));
        canvas.drawText(languageLabel, languageButton.x() + 3, at(LANGUAGE_TOP));
        canvas.drawOutline(languageButton, OutlineColor.WHITE);
    }

    //-------------------- INTERNALS --------------------
    // A height of the scene, counted from the bottom of the world.
    private float at(float height) {
        return world.y() + height;
    }
}
