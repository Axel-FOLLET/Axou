package com.cropa.model.enemy;

// Board: the size of the field (ROWS, COLUMNS), written once, in the class of the field.
import com.cropa.model.world.Board;
// Damageable and Updatable: Antonin's interfaces, shared by the whole model (model.world).
import com.cropa.model.world.Damageable;
import com.cropa.model.world.Updatable;

// What every enemy has (health, row, cells to the farm, reward) and what every enemy can undergo
// (damage, death, fleeing). Each subclass only writes what makes it different, starting with update().
// The rest of the game only knows interfaces:
// - Damageable: a defense or a bramble hurts it (takeDamage) without knowing its type;
// - Updatable: the game moves it forward in time (update);
// - CellCrosser: the common code tells it it enters a cell; flying or walking is decided by Flyable or Walker;
// - EnemyView: the view only sees the row, the cells left, the sprite key and whether it is on the board.
/**
 * Base class of all enemies: the mole, the bat and the witch.
 */
public abstract class Enemy implements EnemyView, Damageable, Updatable, CellCrosser {

    //-------------------- FIELD SHAPE --------------------
    // The shape of the field (rules.md §4). Its size (3 rows of 5 columns) is Board.ROWS and Board.COLUMNS,
    // written once in the class of the field (day 10, L5: Enemy no longer keeps a copy of it). What only the enemies
    // need stays here, used by LaneEnemy (the columns it crosses), Mole and DeviateStrategy. Geometry, not balancing:
    // not in EnemyConfig. 3 cells between column 1 and the farm, so column c spans from c + 3 to c + 2 cells left.
    // Rows 0 and 4 are not on the field: they are the defense rows enemies flee by.
    // protected: read by the subclasses and by the classes of this package (DeviateStrategy, WaveTable), so they are
    // part of what the Javadoc documents.
    /** Cells between the left edge of the field (column 1) and the farm: column c spans from c + 3 to c + 2. */
    protected static final int CELLS_FROM_FIELD_TO_FARM = 3;
    /** The row of the top defenses, above the field: an enemy flees by it from row 1. */
    protected static final int TOP_FLEE_ROW = 0;
    /** The row of the bottom defenses, below the field: an enemy flees by it from the last row. */
    protected static final int BOTTOM_FLEE_ROW = Board.ROWS + 1;

    //-------------------- STATE --------------------
    // private: only Enemy changes them, through methods that keep their rules (takeDamage, moveTowardsFarm, moveTo).
    // Subclasses read them with the getters; no subclass can put a health below 0 or a place past the farm.
    // health: between 0 and the starting health of the type.
    // row: 1 to 3 on the field; 0 and 4 are the rows enemies flee by.
    // cellsToFarm: cells left to the farm, 10 when the enemy enters its row, 0 in front of the farm.
    private int health;
    private int row;
    private float cellsToFarm;

    // Fixed at creation: the kind of enemy and the coins it is worth.
    private final EnemyType type;
    private final int reward;

    // true once the enemy has left the board; the game then removes it from its list.
    private boolean fled;

    // true once the reward of a killed enemy has been taken: it is paid only once.
    private boolean rewardCollected;

    //-------------------- CONSTRUCTOR --------------------
    // Solution B: the enemy reads its own numbers in the config, so they are only written in EnemyConfig.
    // protected: only subclasses call it, through super(...).
    /**
     * Creates an enemy at the entry of its row, with the numbers of its type.
     *
     * @param type the kind of enemy
     * @param row the row of the field, from 1 to 3
     * @param config the balancing numbers
     * @throws IllegalArgumentException if the row is not between 1 and 3
     */
    protected Enemy(EnemyType type, int row, EnemyConfig config) {
        if (row < 1 || row > Board.ROWS) {
            throw new IllegalArgumentException("row must be between 1 and 3, got " + row);
        }
        this.type = type;
        this.row = row;
        this.health = config.getHealth(type);
        this.reward = config.getReward(type);
        this.cellsToFarm = config.getSpawnCellsToFarm();
    }

    //-------------------- ACTIONS --------------------
    // Same choices as Farm: negative damage is ignored, and health never goes below 0.
    /**
     * Removes health from the enemy.
     *
     * <p>Health never goes below 0. Negative damage is ignored, so an enemy is never healed.
     *
     * @param amount the damage dealt; ignored if negative
     */
    @Override
    public void takeDamage(int amount) {
        if (amount < 0) {
            return;
        }
        health = Math.max(0, health - amount);
    }

    // Called by the subclasses that walk (LaneEnemy.walk): the only way to change cellsToFarm from outside Enemy.
    // The rule "never past the farm" is written once, here, instead of in every walking enemy.
    // protected: only subclasses move an enemy; the view and the defenses cannot.
    /**
     * Moves the enemy towards the farm. It never goes past the farm.
     *
     * @param cells the number of cells to move; the cells left never go below 0
     */
    protected void moveTowardsFarm(float cells) {
        cellsToFarm = Math.max(0, cellsToFarm - cells);
    }

    // Called by the subclasses that jump to a place: the mole onto the crop it eats, and from day 7 the lane
    // enemies that turn aside or flee. Born on the field (rows 1 to 3, checked by the constructor), an enemy can
    // reach the flee rows 0 and 4 on its way, never further: a wrong row is a bug, so it stops here, not later.
    /**
     * Puts the enemy on the given row, at the given number of cells from the farm.
     *
     * @param newRow the row, from 0 to 4: the field rows and the two flee rows
     * @param newCellsToFarm the cells left between the enemy and the farm
     * @throws IllegalArgumentException if the row is not between 0 and 4
     */
    protected void moveTo(int newRow, float newCellsToFarm) {
        if (newRow < TOP_FLEE_ROW || newRow > BOTTOM_FLEE_ROW) {
            throw new IllegalArgumentException("row must be between 0 and 4, got " + newRow);
        }
        row = newRow;
        cellsToFarm = newCellsToFarm;
    }

    // Called at dawn: the enemies still on the board leave.
    /**
     * Makes the enemy leave the board. A fled enemy does nothing anymore.
     */
    public void flee() {
        fled = true;
    }

    // Called on every frame by the game. delta is given, never read from a clock,
    // so a test can pass 10f instead of waiting 10 seconds.
    /**
     * Moves the enemy forward in time.
     *
     * @param delta the seconds elapsed since the previous frame
     */
    @Override
    public abstract void update(float delta);

    // Each kind of enemy chooses its sprite from its own state: the view only draws the key it is given.
    // A key, not a file: the files are listed once, in view/SpriteCatalog.
    /**
     * Returns the key of the sprite that shows the enemy in its current state.
     *
     * @return the sprite key, listed in the sprite catalog of the view
     */
    @Override
    public abstract String spriteKey();

    //-------------------- QUERIES --------------------
    /**
     * Returns the kind of enemy.
     *
     * @return the type of the enemy
     */
    public EnemyType getType() {
        return type;
    }

    /**
     * Returns the current health of the enemy.
     *
     * @return the current health, never negative
     */
    @Override
    public int getHealth() {
        return health;
    }

    /**
     * Returns the row the enemy is on.
     *
     * @return the row, from 1 to 3
     */
    @Override
    public int getRow() {
        return row;
    }

    /**
     * Returns the number of cells left between the enemy and the farm.
     *
     * @return the cells left: 10 at the entry of the row, 0 in front of the farm
     */
    @Override
    public float getCellsToFarm() {
        return cellsToFarm;
    }

    /**
     * Returns the coins earned by killing this enemy.
     *
     * @return the reward, in coins
     */
    public int getReward() {
        return reward;
    }

    // Rules §8: killing an enemy brings coins; an enemy that flees brings nothing (it is not dead).
    // Paid once: the game may ask on every frame, or two defenses may kill it in the same frame. The enemy itself
    // remembers that its reward is gone, so nobody else has to keep a list of the enemies already paid.
    // Asking while it is alive takes nothing. An enemy that fled, then took the last hit (the same frame, or a hit
    // that lands after the flight), pays nothing either: it left the board alive (noted by Yohan, day 10).
    /**
     * Takes the reward of a killed enemy, once.
     *
     * @return the reward, in coins, the first time it is asked after the enemy is killed; 0 otherwise, and 0 for an
     *     enemy that fled before it was killed
     */
    public int collectReward() {
        if (!isDead() || hasFled() || rewardCollected) {
            return 0;
        }
        rewardCollected = true;
        return reward;
    }

    /**
     * Tells whether the enemy has no health left.
     *
     * @return {@code true} if the health is 0
     */
    public boolean isDead() {
        return health == 0;
    }

    /**
     * Tells whether the enemy has left the board.
     *
     * @return {@code true} once {@link #flee()} has been called
     */
    public boolean hasFled() {
        return fled;
    }

    // Read by the view on every frame: a dead or fled enemy is no longer drawn.
    /**
     * Tells whether the enemy is still on the board: neither dead nor fled.
     *
     * @return {@code true} if the enemy is alive and has not fled
     */
    @Override
    public boolean isOnBoard() {
        return !isDead() && !hasFled();
    }

    // true by default; the mole overrides it: underground, nothing can hit it.
    // A method, not an interface: it is a state that changes (the mole can be hit only while it eats, 3 s),
    // and an interface describes what an object always is.
    /**
     * Tells whether defenses and the farmer can hit the enemy.
     *
     * @return {@code true} by default
     */
    public boolean isTargetable() {
        return true;
    }

    // false by default; the bat overrides it. Asked by the scarecrow, which punches only what walks (rules, section 8).
    // Crossing a cell is still decided by Flyable and Walker; this question is only for a defense that aims.
    // Written by Axel on day 8, the one exception to the owner of this file that day.
    /**
     * Tells whether the enemy flies over the field.
     *
     * @return {@code false} by default
     */
    public boolean isFlying() {
        return false;
    }
}
