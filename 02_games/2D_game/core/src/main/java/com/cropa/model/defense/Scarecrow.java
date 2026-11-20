package com.cropa.model.defense;

// Enemy: what the scarecrow punches, without ever knowing which enemy it is.
import com.cropa.model.enemy.Enemy;
// Board: the size of the field, written once in the model (L5).
// Cell: the cell it stands on. Damageable: what crosses it. Occupant: the contract of whatever sits on a cell.
import com.cropa.model.world.Board;
import com.cropa.model.world.Cell;
import com.cropa.model.world.Damageable;
import com.cropa.model.world.Occupant;
// Comparator: picks the target. List: the enemies of the game. Optional: "nobody to punch" without null.
// OptionalInt: what onHarvested returns.
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.OptionalInt;

// extends Defense: the level, the durability, the damage and the upgrade are already written there.
// implements Occupant: it stands on a cell of the field, like a crop, so a Cell accepts it and an enemy crosses it.
// One class to extend, as many interfaces as needed: it is a Defense AND something that sits on a cell.
/**
 * The boxing scarecrow: it stands on a cell of the field and punches the walking enemies on
 * its cell and on the four cells next to it.
 */
public class Scarecrow extends Defense implements Occupant {

    //-------------------- CONSTANTS --------------------
    // The shape of the field, the same rule as Catapatate and LaneEnemy: column c holds the cells left between
    // c + 2 and c + 3. Geometry, not balancing: these numbers do not belong in DefenseConfig.
    private static final int CELLS_FROM_FIELD_TO_FARM = 3;
    // The last column and the last row come from Board: no 5 nor 3 copied here.
    private static final int FIRST_COLUMN = 1;
    private static final int LAST_COLUMN = Board.COLUMNS;
    private static final int FIRST_ROW = 1;
    private static final int LAST_ROW = Board.ROWS;

    //-------------------- FIELDS --------------------
    // Where it stands, and the live list of the enemies that GameSession keeps up to date.
    private final Cell cell;
    private final List<Enemy> enemies;
    // Read once in the config at creation: they do not change with the level.
    private final int range;
    private final float cooldown;
    // Seconds before the next punch. 0 at creation: the first enemy in reach is punched at once.
    private float timeUntilReady;

    //-------------------- CONSTRUCTOR --------------------
    // Called by DefenseOffer when the player buys a scarecrow. It does not place itself: DefenseSlots.placeOnField does.
    /**
     * Creates a scarecrow for the given cell.
     *
     * @param cell the cell of the field it stands on
     * @param config the balancing numbers
     * @param enemies the enemies of the game, read only
     */
    public Scarecrow(Cell cell, DefenseConfig config, List<Enemy> enemies) {
        super(DefenseType.SCARECROW, config);
        this.cell = cell;
        this.enemies = enemies;
        this.range = config.getRange(DefenseType.SCARECROW);
        this.cooldown = config.getCooldown(DefenseType.SCARECROW);
    }

    //-------------------- ACTIONS --------------------
    // Called by the game on every frame, the same pace as the catapatate: one punch per cooldown (1.5 s).
    // A punch does not wear it: only the enemies that cross its cell do (rules, section 7).
    // Day 14: like the catapatate, the attack image is counted down first, then started again by a punch.
    /**
     * Punches the best target within reach, at most once per cooldown, and shows its attack image for 0.3 s after
     * each punch.
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
        startAttackPose();
        timeUntilReady += cooldown;
    }

    // Called by Defense.wear at 0 %: the scarecrow empties its cell, which can take a crop again.
    @Override
    protected void leavePlace() {
        cell.remove();
    }

    //-------------------- OCCUPANT --------------------
    // Called by Cell.crossBy when a walker enters its cell (a flyer never calls it: Flyable).
    // -10 % per crossing; it stays on its cell unless that wear destroyed it.
    /**
     * Reacts to an enemy crossing its cell: it loses durability.
     *
     * @param crosser what crosses the cell, not hurt by the crossing
     * @return {@code true} only if this crossing destroyed it
     */
    @Override
    public boolean onCrossedBy(Damageable crosser) {
        wear(getWearPerUse());
        return isDestroyed();
    }

    // The mole eats crops, not defenses.
    /**
     * Reacts to a mole biting it.
     *
     * @return always {@code false}: a scarecrow is not eaten
     */
    @Override
    public boolean onBittenByMole() {
        return false;
    }

    // Day 14, asked by Axel: like the bramble, it can be removed to free its cell ("Retirer" in the shop). Shop.sell
    // adds 0 coins, then empties the cell; DefenseSlots forgets it at its next read (purgeField). Not for sale: 0.
    /**
     * Returns the money a removal of the scarecrow brings.
     *
     * @return always 0: the removal only frees the cell
     */
    @Override
    public OptionalInt onHarvested() {
        return OptionalInt.of(0);
    }

    // Read by Board.spriteAt for WorldRenderer; both files are listed in view/SpriteCatalog.
    // Day 14: for 0.3 s after a punch, its attack image (isAttacking, in Defense). WorldRenderer draws whatever key
    // it gets, so the scarecrow punches on screen without any change in the view.
    /**
     * Returns the name of the sprite of the scarecrow: punching for 0.3 s after a punch, still otherwise.
     *
     * @return {@code "scarecrow_attack"} right after a punch, {@code "scarecrow"} otherwise
     */
    @Override
    public String spriteKey() {
        return isAttacking() ? "scarecrow_attack" : "scarecrow";
    }

    //-------------------- TARGETING --------------------
    // Keeps the enemies it can hit: on the board, targetable (not a mole underground), walking, within reach.
    // Among them, the one closest to the farm: the most dangerous, as for the catapatate.
    private Optional<Enemy> findTarget() {
        return enemies.stream()
                .filter(enemy -> enemy.isOnBoard() && enemy.isTargetable() && !enemy.isFlying() && isInRange(enemy))
                .min(Comparator.comparingDouble(Enemy::getCellsToFarm));
    }

    // The cross of the rules: rows apart + columns apart <= 1, so its cell and the 4 cells next to it.
    // Only the cells of the field: an enemy before column 5, past column 1 or on a flee row is not in reach.
    // Public: the view asks it for each cell, to veil the cross in white (Defense.reaches).
    /**
     * Tells whether this scarecrow reaches a cell: its own cell and the cells next to it, within its range.
     *
     * @param row the row, from 1 to 3
     * @param column the column, from 1 to 5
     * @return {@code true} if the cell is inside the cross
     */
    @Override
    public boolean reaches(int row, int column) {
        if (row < FIRST_ROW || row > LAST_ROW || column < FIRST_COLUMN || column > LAST_COLUMN) {
            return false;
        }
        return Math.abs(row - cell.getRow()) + Math.abs(column - cell.getColumn()) <= range;
    }

    // ceil: 5.5 cells left gives 6, minus 3: column 3. The enemy is in range when the cell it walks on is reached.
    private boolean isInRange(Enemy enemy) {
        int column = (int) Math.ceil(enemy.getCellsToFarm()) - CELLS_FROM_FIELD_TO_FARM;
        return reaches(enemy.getRow(), column);
    }
}
