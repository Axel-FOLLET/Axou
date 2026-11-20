package com.cropa.view.enemy;

// EnemyView: the read-only face of an enemy; the renderer cannot call takeDamage or flee on it.
// BoardLayout: turns a row and the cells left to the farm into a point. Bounds: the square the sprite fills.
// Canvas: where to draw, without knowing the graphics library. HitFlash: the red after a hit. List: the enemies given by the screen.
// Map: the size of the sprite keys that are bigger than one cell.
import com.cropa.model.enemy.EnemyView;
import com.cropa.view.BoardLayout;
import com.cropa.view.Bounds;
import com.cropa.view.Canvas;
import com.cropa.view.HitFlash;
import java.util.List;
import java.util.Map;

// The view of track B: it shows what the model decides, it decides nothing.
// No libGDX here: the renderer asks the Canvas for a sprite key at a place, and GdxCanvas loads the image,
// draws it and frees it. So a test gives a fake Canvas that records the calls, without a window.
// No switch on the type either: each enemy gives its own sprite key (spriteKey), so a new enemy needs
// a line in SpriteCatalog, not a new case here.
// The farmer and the cat are not enemies: FarmRenderer draws them, with the farm.
/**
 * Draws the enemies still on the board, each centred on its place on its row.
 */
public class EnemyRenderer {

    //-------------------- CONSTANTS --------------------
    // Drawn size, in world pixels: one cell (16 px), from 32 px images.
    private static final float ENEMY_SIZE = 16f;
    // The witch comes from 48 px images, her body 32 rows tall: at 16 px she was 11 px tall, half the old Garry.
    // At 28 px she is about 19 px tall, like him (32 px from a 48 px image, 29 rows), a bit taller than the
    // scarecrow (15 px). Her 10 empty rows under the feet keep them on the bottom edge of her row.
    private static final float WITCH_SIZE = 28f;
    // The size of each sprite key bigger than one cell: the key decides, like in SpriteCatalog, with no switch on
    // the type. Any other key is one cell. Day 14: "witch_back", the witch seen from behind while she goes back along
    // a flee row (east-witch.png, the same 48 px as her other images).
    private static final Map<String, Float> SIZE_BY_KEY =
            Map.of("witch", WITCH_SIZE, "witch_attack", WITCH_SIZE, "witch_back", WITCH_SIZE);

    //-------------------- FIELDS --------------------
    // Gives the point on screen of a row and the cells left to the farm. It only keeps rectangles.
    private final BoardLayout layout;
    // Turns an enemy red for a short instant when its health drops: the catapatate's hit becomes visible.
    private final HitFlash flash = new HitFlash();

    //-------------------- CONSTRUCTOR --------------------
    // Called once by GameScreen.show(). Nothing to load: GdxCanvas loads the images from their keys.
    /**
     * Creates the renderer of the enemies.
     *
     * @param layout the board layout that turns a row and the cells left to the farm into a point on screen
     */
    public EnemyRenderer(BoardLayout layout) {
        this.layout = layout;
    }

    //-------------------- DRAWING --------------------
    // Called by GameScreen on every frame, after the farm: the enemies are drawn over it.
    // For each enemy still on the board: the point comes from toScreen, never from pixels written here,
    // and centeredOn puts the middle of the sprite on that point, at the size of its key (one cell, or the witch's).
    // List<? extends EnemyView>: any list of objects that are EnemyView, such as the List<Enemy> of GameSession.
    // The enemy itself is the key of HitFlash: each one has its own red.
    /**
     * Draws every enemy still on the board, centred on its place on its row, red for a short instant after a hit.
     *
     * <p>Dead and fled enemies are not drawn.
     *
     * @param canvas where to draw
     * @param enemies the enemies of the game, read only
     * @param delta the time since the previous frame, in seconds
     */
    public void render(Canvas canvas, List<? extends EnemyView> enemies, float delta) {
        for (EnemyView enemy : enemies) {
            if (!enemy.isOnBoard()) {
                continue;
            }
            String key = enemy.spriteKey();
            float size = SIZE_BY_KEY.getOrDefault(key, ENEMY_SIZE);
            Bounds area = Bounds.centeredOn(layout.toScreen(enemy.getRow(), enemy.getCellsToFarm()), size);
            canvas.drawSprite(key, area, flash.tintOf(enemy, enemy.getHealth(), delta));
        }
    }
}
