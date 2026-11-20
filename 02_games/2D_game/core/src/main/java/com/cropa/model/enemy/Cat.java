package com.cropa.model.enemy;

// List: the enemies of the game, read at each frame. Random: injected, decides the meows.
import java.util.List;
import java.util.Random;

// The farmer's cat (rules §9): purely decorative. It attacks nobody, runs away when an enemy comes onto it, and
// meows at random in a bubble, without sound. The view reads isFleeing and isMeowing to draw it.
// It sits at the top of row 1, half a cell from the farm (point "cat" of map_v1.tmx: x 200, the farm being at x 192
// and column 1 starting at x 240, 3 cells further).
// L7: it only reads the enemies, so it receives EnemyView (getRow, getCellsToFarm, isOnBoard), not Enemy: it cannot
// hit them, make them flee or move them. The same reason as EnemyRenderer: an arrow to an interface, not to a class.
// The Random is injected, as for the mole: a test chooses the draw, and a game with the same seed meows the same way.
// Its numbers are not balancing (the cat changes nothing to the game), so they stay here, not in EnemyConfig.
/**
 * The farmer's cat: it runs away from the enemies that come onto it and meows now and then.
 */
public class Cat {

    //-------------------- CONSTANTS --------------------
    // Where it is afraid: on row 1, from the farm (0 cells) to 1 cell left. It sits at 0.5 cell, in the middle.
    private static final int CAT_ROW = 1;
    private static final float FLEE_DISTANCE = 1f;
    // One draw per second, 1 chance in 30 (nextInt(30) gives 0 to 29, and 0 wins), for a meow of 2 s: a meow every
    // 32 s on average (30 draws, then the 2 s of the meow). 1 in 10 until day 12: Axel wanted it "really not often".
    private static final float DRAW_INTERVAL = 1f;
    private static final int MEOW_CHANCE = 30;
    private static final float MEOW_DURATION = 2f;

    //-------------------- STATE --------------------
    // The source of the draws, given from outside.
    private final Random random;
    // true while an enemy still in play is on the cat.
    private boolean fleeing;
    // Seconds left of the current meow: 0 when it does not meow.
    private float meowTimeLeft;
    // Seconds before the next draw. It starts at 1 s: the first draw comes after a whole second.
    private float timeUntilDraw = DRAW_INTERVAL;

    //-------------------- CONSTRUCTOR --------------------
    /**
     * Creates the cat, sitting quietly next to the farm.
     *
     * @param random the source of the random meows
     */
    public Cat(Random random) {
        this.random = random;
    }

    //-------------------- ACTIONS --------------------
    // Called at each frame by the game, after the farmer. First it looks at the enemies, then the meow goes on.
    // It looks even when no time passes (delta 0): fleeing depends on where the enemies are, not on time.
    // Fleeing: no meow, and no draw. A meow in progress stops at once, and the clock of the draws starts again, so
    // after the flight the next draw comes a whole second later.
    // Meowing: no draw either (a meow in progress ends before the next draw). When it ends, the clock of the draws
    // starts again: the next draw comes 1 s after the end of the meow.
    // Otherwise the clock goes down, and at 0 one draw. += and not =: the pace stays exactly one draw per second.
    // One draw per frame at most: at about 60 frames per second, nobody sees the difference.
    /**
     * Moves the cat forward in time: it flees from the enemies on it, otherwise it may meow.
     *
     * <p>The cat flees while an enemy still on the board stands on row 1, 1 cell or less from the farm. While it
     * flees, it does not meow. Otherwise, once per second, it has 1 chance in 30 to start a meow of 2 s; there is
     * no draw during a meow, and the next draw comes 1 s after the end of a meow or of a flight.
     *
     * @param delta the seconds elapsed since the previous frame; the time is ignored if not positive
     * @param enemies the enemies of the game, read only
     */
    public void update(float delta, List<? extends EnemyView> enemies) {
        fleeing = enemies.stream().anyMatch(this::isOnTheCat);
        if (fleeing) {
            meowTimeLeft = 0;
            timeUntilDraw = DRAW_INTERVAL;
            return;
        }
        if (delta <= 0) {
            return;
        }
        if (meowTimeLeft > 0) {
            meowTimeLeft = Math.max(0, meowTimeLeft - delta);
            if (meowTimeLeft == 0) {
                timeUntilDraw = DRAW_INTERVAL;
            }
            return;
        }
        timeUntilDraw -= delta;
        if (timeUntilDraw > 0) {
            return;
        }
        timeUntilDraw += DRAW_INTERVAL;
        if (random.nextInt(MEOW_CHANCE) == 0) {
            meowTimeLeft = MEOW_DURATION;
        }
    }

    // Still in play (not dead, not fled), on row 1, 1 cell or less from the farm. No lower bound: an enemy never
    // goes below 0 cells.
    private boolean isOnTheCat(EnemyView enemy) {
        return enemy.isOnBoard() && enemy.getRow() == CAT_ROW && enemy.getCellsToFarm() <= FLEE_DISTANCE;
    }

    //-------------------- QUERIES --------------------
    /**
     * Tells whether the cat is running away from an enemy.
     *
     * @return {@code true} while an enemy still on the board is on row 1, 1 cell or less from the farm
     */
    public boolean isFleeing() {
        return fleeing;
    }

    /**
     * Tells whether the cat is meowing, in its bubble.
     *
     * @return {@code true} during the 2 s of a meow
     */
    public boolean isMeowing() {
        return meowTimeLeft > 0;
    }
}
