package com.cropa.view;

// Board: the number of rows of the field, so the last one is never a 3 copied here (L5).
// Cat: the farmer's cat in the model, read at each frame: sitting, fleeing or meowing.
// Farmer: old Garry in the model, read at each frame at night: where he faces, and his attack pose.
// Locale: lower case letters that do not depend on the computer, for the name of the direction.
import com.cropa.model.enemy.Cat;
import com.cropa.model.enemy.Farmer;
import com.cropa.model.world.Board;
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
    // The health of the farm at the start of the game (day 14): its image changes at half of it, then at 0.
    private final int fullHealth;

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
        canvas.drawSprite(farmKeyOf(farmHealth), farmArea, flash.tintOf(this, farmHealth, delta));
        canvas.drawSprite(farmerKeyOf(farmer, night), farmerArea);
        canvas.drawSprite(cat.isFleeing() ? "cat_fleeing" : SpriteCatalog.CAT, catArea);
        if (cat.isMeowing()) {
            canvas.drawSprite("cat_meow", meowArea);
        }
        canvas.drawSprite(SpriteCatalog.PICKUP, pickupArea);
        canvas.drawSprite(SpriteCatalog.CYPRESS, leftCypressArea);
        canvas.drawSprite(SpriteCatalog.CYPRESS, rightCypressArea);
    }

    //-------------------- INTERNALS --------------------
    // The image of the farm from its health (asked by Axel on day 14): intact above half (strictly), half destroyed from
    // half down to 1, destroyed at 0. health * 2 <= fullHealth, and not health <= fullHealth / 2: with an odd full
    // health, the integer division would round half down and move the threshold by one. The three images share the
    // same 56 px frame, so they take the same place.
    private String farmKeyOf(int health) {
        if (health <= 0) {
            return SpriteCatalog.FARM_DESTROYED;
        }
        if (health * 2 <= fullHealth) {
            return SpriteCatalog.FARM_HALF_DESTROYED;
        }
        return SpriteCatalog.FARM;
    }

    // The image of Garry (day 14). By day, his rocking chair. At night, where the model says he faces (Farmer chooses
    // it from the place of his target: an enemy behind him makes him turn round, west), in lower case:
    // "farmer_north", "farmer_east", "farmer_south" or "farmer_west"; "_attack" while his pose is on. Only the
    // direction and the pose are read: no test on the type of the enemy he hits, no geometry here.
    private static String farmerKeyOf(Farmer farmer, boolean night) {
        if (!night) {
            return SpriteCatalog.FARMER;
        }
        String key = "farmer_" + farmer.getFacing().name().toLowerCase(Locale.ROOT);
        return farmer.isAttacking() ? key + "_attack" : key;
    }

    // A cypress centred on x, its trunk on the given height: its square starts TREE_FEET lower.
    private static Bounds treeOn(float x, float trunk) {
        return new Bounds(x - TREE_SIZE / 2, trunk - TREE_FEET, TREE_SIZE, TREE_SIZE);
    }
}
