package com.cropa.model.defense;

// Enemy: what the catapatate shoots at, without ever knowing which enemy it is.
// Board: the size of the field, written once in the model (L5).
import com.cropa.model.enemy.Enemy;
import com.cropa.model.world.Board;
// Comparator: picks the target. List: the enemies of the game. Optional: "nobody to shoot" without null.
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

// extends Defense: the level and the durability are already written there; this class only adds the shooting.
// It asks an enemy two things, isOnBoard and isTargetable, then calls takeDamage: no test on its type.
// A new enemy is shot at without changing a line here.
/**
 * The catapatate: it stands on a defense slot and throws potatoes at the enemies within reach.
 */
public class Catapatate extends Defense {

    //-------------------- CONSTANTS --------------------
    // The shape of the field, the same rule as LaneEnemy: column c holds the cells left between c + 2 and c + 3.
    // Geometry, not balancing: these numbers do not belong in DefenseConfig.
    private static final int CELLS_FROM_FIELD_TO_FARM = 3;
    // The last column and the last row come from Board: no 5 nor 3 copied here.
    private static final int FIRST_COLUMN = 1;
    private static final int LAST_COLUMN = Board.COLUMNS;
    // The slots under the field stand on the row after the last one (Board.ROWS + 1, so 4), those above it on row 0.
    private static final int BOTTOM_SLOTS_ROW = Board.ROWS + 1;

    //-------------------- FIELDS --------------------
    // Where it stands, and the live list of the enemies: a read-only view that GameSession keeps up to date.
    private final DefenseSlot slot;
    private final List<Enemy> enemies;
    // Read once in the config at creation: they do not change with the level.
    private final int range;
    private final float cooldown;
    private final int wearPerShot;
    // Seconds before the next shot. 0 at creation: the first enemy in reach is shot at once.
    private float timeUntilReady;

    //-------------------- CONSTRUCTOR --------------------
    // Called when the player buys a catapatate. It does not place itself on the slot: the shop does.
    /**
     * Creates a catapatate for the given slot.
     *
     * @param slot the slot it stands on
     * @param config the balancing numbers
     * @param enemies the enemies of the game, read only
     */
    public Catapatate(DefenseSlot slot, DefenseConfig config, List<Enemy> enemies) {
        super(DefenseType.CATAPATATE, config);
        this.slot = slot;
        this.enemies = enemies;
        this.range = config.getRange(DefenseType.CATAPATATE);
        this.cooldown = config.getCooldown(DefenseType.CATAPATATE);
        this.wearPerShot = config.getWearPerUse(DefenseType.CATAPATATE);
    }

    //-------------------- ACTIONS --------------------
    // Called by the game on every frame. A destroyed catapatate no longer acts.
    // Nobody in reach: it stays ready, without shooting and without wearing, and keeps no shot in reserve.
    // += and not =: the fraction of a frame already spent counts, so the pace stays at exactly 1 shot per second.
    // Day 14: the attack image is counted down first, then started again by a shot (Defense.startAttackPose), so
    // the view shows the catapatate throwing for 0.3 s after each shot.
    /**
     * Shoots at the best target within reach, at most once per cooldown, and shows its attack image for 0.3 s after
     * each shot.
     *
     * @param delta the seconds elapsed since the previous frame; ignored if not positive
     */
    @Override
    public void update(float delta) {
        if (isDestroyed() || delta <= 0) {
            return;
        }
        countDownAttackPose(delta);
        timeUntilReady -= delta;
        if (timeUntilReady > 0) {
            return;
        }
        Optional<Enemy> target = findTarget();
        if (target.isEmpty()) {
            timeUntilReady = 0;
            return;
        }
        target.get().takeDamage(getDamage());
        wear(wearPerShot);
        startAttackPose();
        timeUntilReady += cooldown;
    }

    // Called by Defense.wear when the durability reaches 0 %. The catapatate empties its own slot:
    // the slot can take a new defense, and getDefenses() no longer returns this one.
    @Override
    protected void leavePlace() {
        slot.remove();
    }

    //-------------------- TARGETING --------------------
    // Keeps the enemies that can be hit, then the closest row first: while row 1 holds a target, row 2 is left alone
    // (rules, section 7). On the same row, the one closest to the farm: the most dangerous.
    // (Enemy enemy): the type is written, or comparingInt could not tell what the lambda receives.
    private Optional<Enemy> findTarget() {
        return enemies.stream()
                .filter(enemy -> enemy.isOnBoard() && enemy.isTargetable() && isInRange(enemy))
                .min(Comparator.comparingInt((Enemy enemy) -> rowsFromSlot(enemy.getRow()))
                        .thenComparingDouble(Enemy::getCellsToFarm));
    }

    // The diamond of the rules: a slot on column 3, range 2, reaches columns 2, 3 and 4 on the next row,
    // and only column 3 on the row after. rowsFromSlot starts at 1: the rows the enemies flee by are 0, never in reach.
    // Public: the view asks it for each cell, to veil the diamond in white (Defense.reaches).
    /**
     * Tells whether this catapatate reaches a cell: the diamond of its range, from its slot.
     *
     * @param row the row, from 1 to 3
     * @param column the column, from 1 to 5
     * @return {@code true} if the cell is inside the diamond
     */
    @Override
    public boolean reaches(int row, int column) {
        if (column < FIRST_COLUMN || column > LAST_COLUMN) {
            return false;
        }
        int rows = rowsFromSlot(row);
        return rows >= 1 && rows + Math.abs(column - slot.getColumn()) <= range;
    }

    // An enemy is in range when the cell it walks on is reached.
    private boolean isInRange(Enemy enemy) {
        return reaches(enemy.getRow(), columnOf(enemy));
    }

    // ceil: 5.5 cells left gives 6, minus 3: column 3. Before the field the result is above 5, after it below 1.
    private int columnOf(Enemy enemy) {
        return (int) Math.ceil(enemy.getCellsToFarm()) - CELLS_FROM_FIELD_TO_FARM;
    }

    // How many rows separate a row from this slot: row 1 is 1 from the top slots, row 3 is 1 from the bottom ones.
    private int rowsFromSlot(int row) {
        return slot.getSide() == SlotSide.TOP ? row : BOTTOM_SLOTS_ROW - row;
    }
}
