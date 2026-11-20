package com.cropa.view;

// Texts: the lines of the scenes and the invitation to click, in the language of the game.
// Java: List, the scenes of the cinematic, in their order; ArrayList, to pair each image with its line.
import com.cropa.text.Texts;
import java.util.ArrayList;
import java.util.List;

// No interface: like the title screen, a cinematic does not listen to the session; only the clicks move it forward.
// No libGDX: it draws through Canvas.
/**
 * A cinematic: still images shown one after the other, each with a line of text. A click goes to the next scene;
 * after the last one, the cinematic is over.
 */
public class Cinematic {

    //-------------------- CONSTANTS --------------------
    // The images of the scenes, in their order; the line of each one comes from Texts, in the same order.
    private static final List<String> INTRO_IMAGES = List.of("intro_1", "intro_2", "intro_3", "intro_4", "intro_5");
    private static final List<String> VICTORY_IMAGES = List.of("victory_1", "victory_2", "victory_3");
    // The dark band at the bottom of the image, behind the texts: they stay readable on a light image.
    // 0.7: darker than the deepest night (NightRenderer: 0.5), so the image still shows through it.
    private static final float BAND_HEIGHT = 44f;
    private static final float BAND_OPACITY = 0.7f;
    // Heights from the bottom of the world; the y of a text is its top. The HUD font is 18 px a line, so the line ends
    // at y 18 at the lowest; the label, half that size (9 px), ends at y 4: 5 px between them.
    private static final float LINE_TOP = 36f;
    private static final float CONTINUE_TOP = 13f;

    //-------------------- FIELDS --------------------
    // The whole world: each image covers it.
    private final Bounds world;
    // The scenes, in their order. A copy nobody can change: the cinematic cannot lose a scene while it is shown.
    private final List<Scene> scenes;
    // Under the line of each scene, in the small font of the labels: the player knows a click goes on.
    private final String continueLabel;
    // The position of the scene shown in the list: 0 for the first one. Equal to the size of the list once the last
    // scene has been clicked: no scene left, the cinematic is over.
    private int current;

    //-------------------- CONSTRUCTOR --------------------
    // Called by GameScreen.show(), with the same world as the title screen. An empty list gives a cinematic that is
    // over at once.
    /**
     * Creates a cinematic that starts on its first scene.
     *
     * @param world the whole world, in world pixels
     * @param scenes the scenes, in the order they are shown
     * @param texts the invitation to click under each scene, in the language of the game
     */
    public Cinematic(Bounds world, List<Scene> scenes, Texts texts) {
        this.world = world;
        this.scenes = List.copyOf(scenes);
        continueLabel = texts.clickToContinue();
    }

    //-------------------- THE CINEMATICS OF THE GAME --------------------
    // Called by GameScreen.show() when a game starts with its title screen. The story before the first day, in five
    // images: Garry alone with his cat, the urn on the mantelpiece, Mr. Chmunks who wants it, the theft, the ransom.
    // The image keys are in SpriteCatalog; each line was measured with the game font: 481 px at the widest in French,
    // less than the 560 px of the world (TextsTest checks both languages).
    /**
     * The cinematic shown before the first day: why Garry has to earn 10 000 coins.
     *
     * @param world the whole world, in world pixels
     * @param texts the lines of the scenes, in the language of the game
     * @return a new cinematic, on its first scene
     */
    public static Cinematic intro(Bounds world, Texts texts) {
        return new Cinematic(world, scenesOf(INTRO_IMAGES, texts.introLines()), texts);
    }

    // Called by GameScreen.show(), for every game: it is only shown if the game ends on a victory, before the end
    // screen. Three images: the coins gathered, the urn back on the mantelpiece, Garry resting at dawn.
    /**
     * The cinematic shown after a victory, before the end screen: Garry gets the urn back.
     *
     * @param world the whole world, in world pixels
     * @param texts the lines of the scenes, in the language of the game
     * @return a new cinematic, on its first scene
     */
    public static Cinematic victory(Bounds world, Texts texts) {
        return new Cinematic(world, scenesOf(VICTORY_IMAGES, texts.victoryLines()), texts);
    }

    // Each image with the line of the same rank: Texts gives one line per image, in the same order.
    private static List<Scene> scenesOf(List<String> images, List<String> lines) {
        List<Scene> scenes = new ArrayList<>();
        for (int index = 0; index < images.size(); index++) {
            scenes.add(new Scene(images.get(index), lines.get(index)));
        }
        return scenes;
    }

    //-------------------- STATE --------------------
    // Read by GameScreen on every frame: while the cinematic is not over, the game does not move forward.
    /**
     * Tells whether every scene has been shown and clicked.
     *
     * @return true once the last scene has been clicked, or at once if there is no scene
     */
    public boolean isOver() {
        return current >= scenes.size();
    }

    //-------------------- CLICKS --------------------
    // Called by GameScreen on every click, first, like the title screen: a click anywhere goes to the next scene, so
    // no position is needed. Once the cinematic is over, the click is not used, and goes to what comes next.
    /**
     * Goes to the next scene if the cinematic is not over.
     *
     * @return true if the click was used by the cinematic, false if it was already over
     */
    public boolean handleClick() {
        if (isOver()) {
            return false;
        }
        current++;
        return true;
    }

    //-------------------- DRAWING --------------------
    // Called on every frame by GameScreen while the cinematic is not over, instead of the HUD. The image covers the
    // whole world, so the farm behind it is hidden; the band comes after the image, so over it; then the line and the
    // invitation to click, after the band, so over it. Both are centred on the middle of the world.
    /**
     * Draws the current scene: its image over the whole world, a dark band at the bottom, its line and
     * "Cliquer pour continuer". Draws nothing once the cinematic is over.
     *
     * @param canvas where to draw
     */
    public void render(Canvas canvas) {
        if (isOver()) {
            return;
        }
        Scene scene = scenes.get(current);
        float centerX = world.x() + world.width() / 2;
        canvas.drawSprite(scene.imageKey(), world);
        canvas.drawNightVeil(new Bounds(world.x(), world.y(), world.width(), BAND_HEIGHT), BAND_OPACITY);
        canvas.drawCenteredText(scene.line(), centerX, world.y() + LINE_TOP);
        canvas.drawLabel(continueLabel, centerX, world.y() + CONTINUE_TOP);
    }
}
