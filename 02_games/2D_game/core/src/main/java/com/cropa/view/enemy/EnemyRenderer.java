package com.cropa.view.enemy;

// EnemyView: the read-only face of an enemy; the renderer cannot call takeDamage or flee on it.
// BoardLayout: turns a row and the cells left to the farm into a point. Bounds: the square the sprite fills.
// Canvas: where to draw, without knowing the graphics library. HitFlash: the red after a hit. List: the enemies given by the screen.
// Map: the size of the sprite keys that are bigger than one cell.
import com.cropa.model.enemy.EnemyView;
import com.cropa.view.Animations;
import com.cropa.view.BoardLayout;
import com.cropa.view.Bounds;
import com.cropa.view.Canvas;
import com.cropa.view.HitFlash;
import com.cropa.view.SpriteStyle;
import com.cropa.view.TextStyle;
import com.cropa.view.Tint;
import com.cropa.view.fx.Effects;
import com.cropa.view.fx.Particle;
import java.util.ArrayList;
import java.util.IdentityHashMap;
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
    private final Effects effects;
    // Live poses are found by identity. Departures keep their original order.
    private final Map<EnemyView, Track> tracks = new IdentityHashMap<>();
    private final List<Track> order = new ArrayList<>();

    //-------------------- CONSTRUCTOR --------------------
    // Called once by GameScreen.show(). Nothing to load: GdxCanvas loads the images from their keys.
    /**
     * Creates the renderer of the enemies.
     *
     * @param layout the board layout that turns a row and the cells left to the farm into a point on screen
     */
    public EnemyRenderer(BoardLayout layout) {
        this(layout, null);
    }

    /**
     * Sends damage and departure effects to the screen that draws them.
     *
     * @param layout the layout used to locate enemies on their rows
     * @param effects the screen's effects service, or null to draw only sprites
     */
    public EnemyRenderer(BoardLayout layout, Effects effects) {
        this.layout = layout;
        this.effects = effects;
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
     * <p>Enemies seen on the board finish their departure at their last visible place.
     *
     * @param canvas where to draw
     * @param enemies the enemies of the game, read only
     * @param delta the time since the previous frame, in seconds
     */
    public void render(Canvas canvas, List<? extends EnemyView> enemies, float delta) {
        // Keep live enemies in the order supplied by the game.
        // A missing enemy must start its departure this frame.
        for (Track track : order) {
            track.seen = false;
        }
        for (EnemyView enemy : enemies) {
            // Hidden enemies have no live pose.
            if (!enemy.isOnBoard()) {
                continue;
            }
            Track track = tracks.get(enemy);
            // Remember the previous age to detect a crossed phase even after a long frame.
            float previousAge = track == null ? -1f : track.age;
            if (track == null) {
                track = new Track(enemy);
                tracks.put(enemy, track);
                order.add(track);
            } else {
                track.age += delta;
                track.time += delta;
            }
            String key = enemy.spriteKey();
            // Each new pose starts at frame zero.
            if (!key.equals(track.key)) {
                track.time = 0f;
            }
            track.key = key;
            track.row = enemy.getRow();
            track.cells = enemy.getCellsToFarm();
            // During the approach the visible mound is still to the right of the plant.
            float offset = key.equals("mole") && track.age < 0.36f ? 1.5f * (1 - track.age / 0.36f) : 0f;
            recordHealth(track, offset);
            // Both bursts come from the soil of the target cell, once per crossing.
            if (key.equals("mole") && (previousAge < 0f || (previousAge < 0.36f && track.age >= 0.36f))) {
                disturbSoil(track);
            }
            track.seen = true;
            Tint tint = track.flash.tintOf(enemy, track.health, delta);
            float progress = Math.min(1f, track.age / 0.25f);
            float scale = 0.6f + 0.4f * progress;
            SpriteStyle style = SpriteStyle.NORMAL.withAlpha(progress).withScale(scale, scale).withTint(tint);
            if (key.equals("mole") && track.age < 0.36f) {
                paint(canvas, track, "mole_mound", offset, track.age, style);
            } else if (key.equals("mole") && track.age < 0.66f) {
                paint(canvas, track, "mole_emerge", 0, track.age - 0.36f, style);
            } else {
                paint(canvas, track, key, 0, key.equals("mole") ? track.age - 0.66f : track.time, style);
            }
            // Let the arrival cloud finish after the body appears.
            if (track.age < 0.32f) {
                puff(canvas, track, 0, track.age);
            }
        }

        // A removed object can still report the lethal hit between two frames.
        for (var it = order.iterator(); it.hasNext();) {
            Track track = it.next();
            // Visible enemies have already been drawn.
            if (track.seen) {
                continue;
            }
            if (track.exit < 0f) {
                tracks.remove(track.enemy);
                recordHealth(track, 0f);
                // A living mole dives through soil while other departures leave smoke.
                if (track.health > 0 && track.key.equals("mole")) {
                    disturbSoil(track);
                } else if (effects != null) {
                    var center = layout.toScreen(track.row, track.cells);
                    effects.burst(Particle.SMOKE, center.x(), center.y(), 6);
                }
                track.exit = 0f;
            } else {
                track.exit += delta;
            }
            // Release the pose once its final image has gone.
            if (!drawExit(canvas, track)) {
                it.remove();
            }
        }
    }

    // Read the final hit from the same object even after the session removes it.
    private void recordHealth(Track track, float offset) {
        int health = track.enemy.getHealth();
        if (effects != null && health < track.health) {
            Bounds bounds = area(track, offset);
            effects.floatText(Integer.toString(track.health - health), bounds.x() + bounds.width() / 2,
                    bounds.y() + bounds.height(), TextStyle.ALERT);
        }
        track.health = health;
    }

    // Soil flies from the ground under the plant whenever the mole breaks the surface.
    private void disturbSoil(Track track) {
        if (effects != null) {
            Bounds bounds = area(track, 0f);
            effects.burst(Particle.DIRT, bounds.x() + bounds.width() / 2, bounds.y(), 5);
        }
    }

    // Keep death, retreat and burrowing at the last visible row.
    private boolean drawExit(Canvas canvas, Track track) {
        String family = track.key.split("_", 2)[0];
        float time = track.exit;
        float offset = 0f;
        float length;
        if (track.health <= 0) {
            String death = family + "_death";
            length = Animations.duration(death, family.equals("mole") ? 3 : 4);
            if (time < length) {
                paint(canvas, track, death, 0, time, SpriteStyle.NORMAL);
                return true;
            }
        } else if (family.equals("mole")) {
            if (time < 0.3f) {
                paint(canvas, track, "mole_emerge", 0, Math.max(0f, Math.nextDown(0.3f) - time), SpriteStyle.NORMAL);
            } else if (time < 0.66f) {
                float progress = (time - 0.3f) / 0.36f;
                paint(canvas, track, "mole_mound", 1.5f * progress, time - 0.3f,
                        SpriteStyle.NORMAL.withAlpha(1 - progress));
            }
            return time < 0.66f;
        } else {
            length = 0.8f;
            String back = family + "_back";
            float speed = 0.25f / Animations.frameDuration(back, 0);
            offset = speed * Math.min(time, length);
            if (time < length) {
                paint(canvas, track, back, offset, time + (back.equals(track.key) ? track.time : 0),
                        SpriteStyle.NORMAL.withAlpha(1 - time / length));
                return true;
            }
        }
        // Release the track when the last cloud frame ends.
        if (time >= length + 0.32f) {
            return false;
        }
        puff(canvas, track, offset, time - length);
        return true;
    }

    // The cloud stays at the end of the path while it dissolves.
    private void puff(Canvas canvas, Track track, float offset, float time) {
        canvas.drawAnimation("puff", area(track, offset), time, Tint.NORMAL);
    }

    // All phases share the last visible row and body size.
    private Bounds area(Track track, float offset) {
        float size = SIZE_BY_KEY.getOrDefault(track.key, ENEMY_SIZE);
        return Bounds.centeredOn(layout.toScreen(track.row, track.cells + offset), size);
    }

    // The shadow stays on the ground while the sprite grows from its feet.
    private void paint(Canvas canvas, Track track, String key, float offset, float time, SpriteStyle style) {
        Bounds area = area(track, offset);
        if (!key.equals("mole_mound")) {
            boolean bat = key.startsWith("bat");
            float width = area.width() * (bat ? 0.4f : 0.6f) * style.scaleX();
            float height = width * 12 / 32;
            float feet = key.startsWith("witch") ? area.height() * 20 / 96 * style.scaleY() : 0;
            Bounds shadow = new Bounds(area.x() + (area.width() - width) / 2,
                    area.y() + feet - height / 2, width, height);
            canvas.drawSprite("shadow", shadow, 0, SpriteStyle.NORMAL.withAlpha(style.alpha() * (bat ? 0.5f : 1f)));
        }
        canvas.drawSprite(key, area, time, style);
    }

    //-------------------- TRACKING --------------------
    // Dropping the track also drops the health history inside its flash.
    private static final class Track {
        final EnemyView enemy;
        final HitFlash flash = new HitFlash();
        String key;
        int row;
        int health;
        float cells;
        float age;
        float time;
        float exit = -1f;
        boolean seen;

        Track(EnemyView enemy) {
            this.enemy = enemy;
        }
    }
}
