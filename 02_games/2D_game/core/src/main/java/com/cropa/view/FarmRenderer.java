package com.cropa.view;

// Board: the number of rows of the field, so the last one is never a 3 copied here (L5).
// Cat: the farmer's cat in the model, read at each frame: sitting, fleeing or meowing.
// Farmer: old Garry in the model, read at each frame at night: where he faces, and his attack pose.
// Locale: lower case letters that do not depend on the computer, for the name of the direction.
import com.cropa.model.enemy.Cat;
import com.cropa.model.enemy.Farmer;
import com.cropa.model.world.Board;
import com.cropa.view.fx.Effects;
import com.cropa.view.world.FarmSplinters;
import java.util.Locale;

// The sprites that never move: the farm, the old farmer, the cat and the pickup. Before, GameScreen placed them
// itself, mixed with libGDX; here the rule of their places can be tested with a fake Canvas.
/**
 * Draws the farm, the farmer, the cat, and the pickup between two cypresses, at the places given by the map.
 */
public class FarmRenderer {

    //-------------------- CONSTANTS --------------------
    // Drawn sizes, in world pixels: the map gives the places, not the sizes. A size is not a position.
    // Farm: 100 px from a 56 px image. Farmer: 32 px from a 48 px image. Cat: 12 px from a 32 px image, small next to him.
    private static final float FARM_SIZE = 100f;
    private static final float FARMER_SIZE = 32f;
    private static final float CAT_SIZE = 12f;
    // Centre of the lit panes in the 200 px farm image, measured from its bottom left.
    private static final float WINDOW_X_FRACTION = 103.5f / 200f;
    private static final float WINDOW_Y_FRACTION = 65.5f / 200f;
    // In the 56 px farm image, the walls stop 10 rows above the bottom edge: that height, once scaled to FARM_SIZE.
    private static final float FARM_BASE_HEIGHT = FARM_SIZE * 10 / 56;
    // The farmer sits in front of the farm on row 2 (rules.md); his fork reaches rows 1 to 3.
    private static final int FARMER_ROW = 2;
    // The base of the farm lines up with the bottom edge of the last row (Board.ROWS, row 3), so the farm faces the
    // field.
    // The pickup, parked on the dirt road that comes to the farm, facing the way out (west): 48 px from a 64 px
    // image, 11 empty rows under its wheels. The map has no point for it: it is placed from the farm point.
    // On map_v1, the road goes from x 0 to 128 and the gate of the fence stands between x 85 and 107: 110 px left of
    // the farm (x 160), its middle is at x 50, outside the fence. The road goes from y 128 to 160, around the base of
    // the farm (y 144): its wheels stand 12 px under that base.
    private static final float PICKUP_SIZE = 48f;
    private static final float PICKUP_FEET = PICKUP_SIZE * 11 / 64;
    private static final float PICKUP_LEFT_OF_FARM = 110f;
    private static final float PICKUP_BELOW_FARM_BASE = 12f;
    // The pickup image is cut at both ends (its pixels touch its left and right edges): a cypress stands on each end
    // and hides the cut. 56 px, the size of its image, like the trees of the map; 6 empty rows under the trunk.
    // Its trunk 12 px under the wheels (y 120): on the grass, just under the dirt road (y 128), and still tall enough
    // to hide the top of the cut ends. Lower on the screen is closer to the player, so it stands in front.
    // The hole of grass between the two cypresses, under the road, is filled by a pine of the map (layer trees): a
    // sprite is drawn after every tree of the map, so a pine here would stand over the pines in front of it.
    private static final float TREE_SIZE = 56f;
    private static final float TREE_FEET = TREE_SIZE * 6 / 56;
    private static final float CYPRESS_UNDER_WHEELS = 12f;
    // The MEOW bubble of the cat (day 12): 30 px from a 60 px image (scale 0.5), centred over the cat. Its drawing
    // fills the rows 20 to 39 of the image, so its tail stands 10 px above the bottom of its square. Its square starts
    // 5 px under the middle of the cat: the tail lands 5 px above that middle, 1 px over the head of the sitting cat
    // (12 px from a 32 px image with 5 empty rows on top: its head is about 4 px above its middle).
    private static final float MEOW_SIZE = 30f;
    private static final float MEOW_BELOW_CAT_MIDDLE = 5f;

    //-------------------- FIELDS --------------------
    // Computed once: these places never change during a game.
    private final Bounds farmArea;
    private final Bounds farmerArea;
    private final Bounds catArea;
    private final Bounds meowArea;
    private final Bounds pickupArea;
    private final Bounds leftCypressArea;
    private final Bounds rightCypressArea;
    // Turns the farm red for a short instant when its health drops.
    private final HitFlash flash = new HitFlash();
    // Each entry covers one fifth of full health, with its upper endpoint included.
    private static final String[] HEALTH_BANDS = {
        "farm_flames", "farm_smoke", SpriteCatalog.FARM_HALF_DESTROYED, "farm_broken_windows", SpriteCatalog.FARM
    };
    private static final float LIGHT_FADE_SECONDS = 1f;
    private final FarmSplinters splinters = new FarmSplinters();
    private final Effects effects;
    private int lastFarmHealth;
    private boolean hasLastFarmHealth;
    private float nightAge;
    private final int fullHealth;
    // Keep the clocks here so pauses also pause the poses.
    private Boolean previousNight;
    private int garryPreviousHealth;
    private String previousAttack;
    private float standTime = 1f;
    private float attackTime;
    private float hurtTime = 1f;
    private float catTime;

    //-------------------- CONSTRUCTOR --------------------
    // Called once by GameScreen.show(), with the health of the farm at that moment: the game has not started, so it is
    // the full health (GameSession creates the farm with EnemyConfig.getFarmHealth()). No number of the rules here.
    // The points of the farm and the farmer sit between rows 2 and 3 (y = 160): only their x is kept, the y comes from the rows.
    // The base of the farm is the bottom edge of row 3: the pickup's wheels are placed from it, its square starts
    // PICKUP_FEET lower so that the empty rows of the image fall under the wheels. A cypress on each end of the
    // pickup, half its width left and right of its middle, placed from the wheels.
    /**
     * Computes the places of the sprites.
     *
     * @param layout the places read from the map
     * @param fullHealth the health of the farm at the start of the game
     */
    public FarmRenderer(BoardLayout layout, int fullHealth) {
        this(layout, fullHealth, null);
    }

    /** Places the farm and sends hit feedback to the screen's effects service. */
    public FarmRenderer(BoardLayout layout, int fullHealth, Effects effects) {
        this.effects = effects;
        this.fullHealth = fullHealth;
        float farmY = layout.getCellBounds(Board.ROWS, 1).y() + FARM_SIZE / 2 - FARM_BASE_HEIGHT;
        farmArea = Bounds.centeredOn(new Point(layout.getSpot("farm").x(), farmY), FARM_SIZE);
        float farmerY = layout.toScreen(FARMER_ROW, 0).y();
        farmerArea = Bounds.centeredOn(new Point(layout.getSpot("farmer").x(), farmerY), FARMER_SIZE);
        Point cat = layout.getSpot("cat");
        catArea = Bounds.centeredOn(cat, CAT_SIZE);
        meowArea = new Bounds(cat.x() - MEOW_SIZE / 2, cat.y() - MEOW_BELOW_CAT_MIDDLE, MEOW_SIZE, MEOW_SIZE);
        float pickupX = layout.getSpot("farm").x() - PICKUP_LEFT_OF_FARM;
        float pickupGround = layout.getCellBounds(Board.ROWS, 1).y() - PICKUP_BELOW_FARM_BASE;
        pickupArea = new Bounds(pickupX - PICKUP_SIZE / 2, pickupGround - PICKUP_FEET, PICKUP_SIZE, PICKUP_SIZE);
        leftCypressArea = treeOn(pickupX - PICKUP_SIZE / 2, pickupGround - CYPRESS_UNDER_WHEELS);
        rightCypressArea = treeOn(pickupX + PICKUP_SIZE / 2, pickupGround - CYPRESS_UNDER_WHEELS);
    }

    // The night renderer places the halo on the same rectangle used to draw the house.
    /** @return the centre of the farm window in world pixels */
    public Point windowCenter() {
        return new Point(farmArea.x() + farmArea.width() * WINDOW_X_FRACTION,
                farmArea.y() + farmArea.height() * WINDOW_Y_FRACTION);
    }

    //-------------------- DRAWING --------------------
    // Called on every frame by GameScreen, after the map: each sprite is drawn over what comes before it.
    // The farm is the only one that can be hit: its health goes to HitFlash, with this renderer as its key, and chooses
    // its image (farmKeyOf): intact, half destroyed, destroyed.
    // Day 14 (feedback of the mid-term jury): by day, Garry dozes in his rocking chair; at night, he stands and faces
    // the enemy he hits, in the 4 directions of his images (farmerKeyOf). Same farmerArea for every image: they all come from 48 px images,
    // drawn on 32, so he does not grow when he stands up.
    // The cat is read at each frame, like the enemies (no event): seen from the front while it sits, turned west
    // (towards the farm) while it flees. Its MEOW bubble comes right after it, over its head, only during a meow; the
    // model never makes it meow while it flees.
    /**
     * Draws the farm (intact above half its health, half destroyed from half down to 1, destroyed at 0), red for a
     * short instant after a hit, then the farmer (in his rocking chair by day; at night standing, turned to the
     * enemy he hits, his pitchfork forward just after a hit), the cat (sitting or fleeing) with its MEOW bubble
     * while it meows, the pickup and, over its two ends, the two cypresses.
     *
     * @param canvas where to draw
     * @param farmHealth the farm's health now
     * @param farmer the farmer, read as he is now
     * @param night {@code true} during the night, when the farmer stands up
     * @param cat the farmer's cat, read as it is now
     * @param delta the time since the previous frame, in seconds
     */
    public void render(Canvas canvas, int farmHealth, Farmer farmer, boolean night, Cat cat, float delta) {
        // Age existing debris before recording a new impact at its origin.
        splinters.advance(delta);
        if (hasLastFarmHealth && farmHealth < lastFarmHealth) {
            splinters.hit();
            if (effects != null) {
                effects.shake(Effects.SMALL_SHAKE);
                effects.floatText(Integer.toString(lastFarmHealth - farmHealth),
                        farmArea.x() + farmArea.width() / 2, farmArea.y() + farmArea.height(), TextStyle.ALERT);
            }
        }
        lastFarmHealth = farmHealth;
        hasLastFarmHealth = true;
        nightAge = night ? Math.min(LIGHT_FADE_SECONDS, nightAge + delta) : 0f;
        canvas.drawSprite(farmKeyOf(farmHealth), farmArea, flash.tintOf(this, farmHealth, delta));
        drawFarmer(canvas, farmer, night, farmHealth, delta);
        drawCat(canvas, cat, delta);
        if (cat.isMeowing()) {
            canvas.drawSprite("cat_meow", meowArea);
        }
        canvas.drawSprite(SpriteCatalog.PICKUP, pickupArea);
        canvas.drawSprite(SpriteCatalog.CYPRESS, leftCypressArea);
        canvas.drawSprite(SpriteCatalog.CYPRESS, rightCypressArea);
        splinters.draw(canvas, farmArea);
    }

    //-------------------- INTERNALS --------------------
    /** Draws the lit windows above the night veil while the farm stands. */
    public void renderWindows(Canvas canvas, int health, boolean night, float timeLeft) {
        if (night && health > 0) {
            String key = SpriteCatalog.FARM.equals(farmKeyOf(health)) ? "farm_light" : "farm_light_broken";
            float alpha = Math.min(nightAge, Math.max(0f, timeLeft)) / LIGHT_FADE_SECONDS;
            canvas.drawLight(key, farmArea, alpha);
        }
    }

    // Subtract one before dividing to keep each exact threshold in the lower band.
    private String farmKeyOf(int health) {
        if (health <= 0) {
            return SpriteCatalog.FARM_DESTROYED;
        }
        long index = ((long) health * HEALTH_BANDS.length - 1) / Math.max(1, fullHealth);
        return HEALTH_BANDS[(int) Math.min(index, HEALTH_BANDS.length - 1)];
    }

    // A new pose starts on its first frame even if this update was long.
    private void drawFarmer(Canvas canvas, Farmer farmer, boolean night, int health, float delta) {
        String facing = "farmer_" + farmer.getFacing().name().toLowerCase(Locale.ROOT);
        String attack = night && farmer.isAttacking() ? facing + "_attack" : null;
        boolean changed = previousNight != null && previousNight != night;
        standTime = changed ? 0f : standTime + delta;
        attackTime = attack != null && !attack.equals(previousAttack) ? 0f : attackTime + delta;
        hurtTime = night && attack == null && health < garryPreviousHealth ? 0f : hurtTime + delta;
        previousNight = night;
        garryPreviousHealth = health;
        previousAttack = attack;

        // The chair stays beneath him until he finishes sitting down.
        boolean standingUp = standTime < 0.6f;
        String key = night ? facing : "farmer";
        float time = -1f;
        if (attack != null) {
            key = attack;
            time = attackTime;
        } else if (night && hurtTime < 0.3f) {
            key = facing + "_hurt";
            time = hurtTime;
        } else if (standingUp) {
            key = "farmer_stand_up";
            time = night ? standTime : Math.max(0f, Math.nextDown(0.6f) - standTime);
        }
        drawShadow(canvas, farmerArea, key.startsWith("farmer_south") ? 22f / 96 : 20f / 96);
        // The seated day sprite already includes the chair.
        if (night || standingUp) {
            canvas.drawSprite("farmer_chair", farmerArea);
        }
        // Idle loops use the canvas clock so timed poses can start at frame zero.
        if (time < 0) {
            canvas.drawSprite(key, farmerArea);
        } else {
            canvas.drawAnimation(key, farmerArea, time, Tint.NORMAL);
        }
    }

    // Fleeing interrupts the bath and starts a fresh sitting interval.
    private void drawCat(Canvas canvas, Cat cat, float delta) {
        float bath = Animations.duration("cat_grooming", 4);
        catTime = cat.isFleeing() ? 0f : (catTime + delta) % (7f + 2 * bath);
        drawShadow(canvas, catArea, cat.isFleeing() ? 0f : 10f / 64);
        if (catTime >= 7f) {
            canvas.drawAnimation("cat_grooming", catArea, (catTime - 7f) % bath, Tint.NORMAL);
        } else {
            canvas.drawSprite(cat.isFleeing() ? "cat_fleeing" : SpriteCatalog.CAT, catArea);
        }
    }

    // Centre the oval on the ground below the painted feet.
    private static void drawShadow(Canvas canvas, Bounds area, float padding) {
        float width = area.width() * 0.6f;
        float height = width * 12 / 32;
        canvas.drawSprite("shadow", new Bounds(area.x() + (area.width() - width) / 2,
                area.y() + area.height() * padding - height / 2, width, height));
    }

    // A cypress centred on x, its trunk on the given height: its square starts TREE_FEET lower.
    private static Bounds treeOn(float x, float trunk) {
        return new Bounds(x - TREE_SIZE / 2, trunk - TREE_FEET, TREE_SIZE, TREE_SIZE);
    }
}
