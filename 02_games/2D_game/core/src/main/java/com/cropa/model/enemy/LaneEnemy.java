package com.cropa.model.enemy;

// Board: the field whose cells the enemy enters. DefenseLine: the defenses it wears while it flees, seen through
// an interface of world, so this package never imports model.defense. Farm: the farm this enemy walks to and hits.
// Locale: lower case letters that do not depend on the computer. Random: injected, given to the MoveStrategy.
import com.cropa.model.world.Board;
import com.cropa.model.world.DefenseLine;
import com.cropa.model.world.Farm;
import java.util.Locale;
import java.util.Random;

// What the bat and the witch do the same way, written once: move along their row towards the farm,
// choose their row before each column (MoveStrategy), tell each cell they enter (onEnterCell),
// then hit the farm at a regular pace. The mole does none of this, so it extends Enemy directly.
// onEnterCell is not written here: Flyable (the bat) triggers nothing, Walker (the witch) lets the cell react.
// The Strategy pattern: LaneEnemy asks its MoveStrategy for its row without knowing which one it holds;
// the bat and the witch only differ by the crop their DeviateStrategy avoids.
/**
 * An enemy that moves along its row to the farm, turning aside when a crop blocks it, then hits the farm.
 */
public abstract class LaneEnemy extends Enemy {

    // The size of the field is Board.COLUMNS; CELLS_FROM_FIELD_TO_FARM is inherited from Enemy, shared with the mole.
    // Column c is entered when the cells left reach c + 3: column 5 at 8, column 1 at 4.

    //-------------------- CONSTANTS --------------------
    // How long the attack image stays after a hit on the farm, in seconds (day 14, feedback of the mid-term jury).
    // The same 0.3 s as the defenses (Defense.ATTACK_POSE_SECONDS): long enough to be seen, short next to the 5 s
    // between two hits, so the enemy shows its walking image in between. A look, not a balancing number: it stays
    // here, not in EnemyConfig.
    private static final float ATTACK_POSE_SECONDS = 0.3f;

    //-------------------- STATE --------------------
    // Read once in the config at creation (solution B): the numbers are only written in EnemyConfig.
    private final float speed;
    private final int farmDamage;
    private final float farmHitCooldown;
    // How much it wears a defense of its flee line, in percent (rules §10: bat 10, witch 20).
    private final int defenseWear;

    // The farm this enemy walks to and hits, and the field whose cells it enters.
    private final Farm farm;
    private final Board board;
    // The defenses of rows 0 and 4, worn while it flees. Dependency inversion: LaneEnemy only knows wearAt,
    // DefenseSlots implements it; neither package knows the other.
    private final DefenseLine defenseLine;

    // How it chooses its row before each column, and the source of its random choices (injected).
    private final MoveStrategy moveStrategy;
    private final Random random;

    // Where the enemy entered its row: read once in the config, the point it goes back to when it leaves.
    private final float spawnCellsToFarm;

    // The clock of the hits on the farm: a hit each time it reaches one cooldown. It does not start at 0 but at
    // "cooldown - first delay", so the first hit comes the first delay after the arrival (0 s: as soon as it arrives),
    // the next ones every cooldown (5 s). It only runs in front of the farm (hitFarm).
    private float timeSinceLastHit;

    // Seconds left on the attack image. 0: the walking image. Set by hitFarm at each hit, counted down by update.
    private float attackPoseLeft;

    // true once a closed column sent it to a flee row: it goes back towards its starting point, then flees.
    private boolean retreating;

    // The last column whose defense it wore while fleeing: each column is worn once only.
    private int lastWornColumn;

    //-------------------- CONSTRUCTORS --------------------
    // Called by the subclasses through super(...); EnemyFactory calls the subclasses.
    // The Random always comes last (team rule); the DefenseLine comes just before it (decided with Axel, day 9).
    /**
     * Creates an enemy at the entry of its row, on the given field.
     *
     * @param type the kind of enemy
     * @param row the row of the field, from 1 to 3
     * @param farm the farm the enemy walks to and hits
     * @param board the field whose cells the enemy enters
     * @param config the balancing numbers
     * @param moveStrategy how the enemy chooses its row before each column
     * @param defenseLine the defenses of the flee rows, worn while the enemy flees
     * @param random the source of the random choices of the strategy
     * @throws IllegalArgumentException if the row is not between 1 and 3
     */
    protected LaneEnemy(EnemyType type, int row, Farm farm, Board board, EnemyConfig config,
            MoveStrategy moveStrategy, DefenseLine defenseLine, Random random) {
        super(type, row, config);
        this.farm = farm;
        this.board = board;
        this.moveStrategy = moveStrategy;
        this.defenseLine = defenseLine;
        this.random = random;
        this.speed = config.getSpeed(type);
        this.farmDamage = config.getFarmDamage(type);
        this.farmHitCooldown = config.getFarmHitCooldown();
        this.defenseWear = config.getDefenseWear(type);
        this.spawnCellsToFarm = config.getSpawnCellsToFarm();
        this.timeSinceLastHit = farmHitCooldown - config.getFirstFarmHitDelay();
    }

    // Kept for the code that does not give the field yet (the bat of the POC in NightState, CatapatateTest,
    // EnemyRendererTest): the enemy crosses an empty field of its own, so nothing ever blocks it and nothing
    // happens on its way. A new Board, never null: no special case below. Its new Random() is the one exception to
    // "Random injected": on an empty field, the strategy never draws. On an empty field it never flees either, so
    // its DefenseLine is a lambda that does nothing. To remove at day 10, once the game uses EnemyFactory.
    /**
     * Creates an enemy at the entry of its row, on an empty field of its own: it crosses no crop.
     *
     * @param type the kind of enemy
     * @param row the row of the field, from 1 to 3
     * @param farm the farm the enemy walks to and hits
     * @param config the balancing numbers
     * @param moveStrategy how the enemy chooses its row before each column
     * @throws IllegalArgumentException if the row is not between 1 and 3
     */
    protected LaneEnemy(EnemyType type, int row, Farm farm, EnemyConfig config, MoveStrategy moveStrategy) {
        this(type, row, farm, new Board(), config, moveStrategy, (wearRow, column, percent) -> { }, new Random());
    }

    //-------------------- ACTIONS --------------------
    // A dead or fled enemy does nothing. A leaving one only goes back (retreat). Otherwise the frame's time is
    // split in two: first the walk to the farm, then whatever time is left counts in front of the farm.
    // Between the two, the enemy enters the cells it reached during the walk. If one of them killed it
    // (a bramble), or if a closed column sent it to a flee row, it stops there: it never reaches the farm.
    // So a single update(30f) gives the same result as many small frames.
    // Day 14: the attack image is counted down first, then started again by a hit of this frame (hitFarm), as in
    // Catapatate.update, so the frame of a new hit keeps its pose.
    /**
     * Moves the enemy along its row, entering the cells of the field it reaches, then lets it hit the
     * farm once it is in front of it; or, once it leaves, takes it back to its starting point.
     *
     * <p>The enemy moves {@code speed × delta} cells towards the farm and stops at 0. Each column of the
     * field is entered once, in order, through {@link #onEnterCell}, on the row its strategy gives. In front
     * of the farm, its first hit comes the first delay after its arrival, then one hit every cooldown, until it
     * dies, flees or the farm is destroyed; each hit shows the attack image for 0.3 s. If a column blocks all its
     * rows, it leaves by a flee row, goes back at its speed, wearing once the defense of each column it reaches on
     * that row, and flees once back at its starting point, without ever hitting the farm.
     *
     * @param delta the seconds elapsed since the previous frame; ignored if not positive
     */
    @Override
    public void update(float delta) {
        if (isDead() || hasFled() || delta <= 0) {
            return;
        }
        attackPoseLeft = Math.max(0, attackPoseLeft - delta);
        if (retreating) {
            retreat(delta);
            return;
        }
        float cellsBefore = getCellsToFarm();
        float timeLeft = walk(delta);
        enterCellsBetween(cellsBefore, getCellsToFarm());
        if (isDead() || retreating) {
            return;
        }
        hitFarm(timeLeft);
    }

    // Going back along the flee row, away from the farm, at its own speed: the cells left go up, never past
    // its starting point. Back there, it has fled: the game removes it. No cell is entered on the way back,
    // but the defense of each column it reaches on its flee line is worn (rules §7, §8).
    private void retreat(float delta) {
        float cellsLeft = Math.min(getCellsToFarm() + speed * delta, spawnCellsToFarm);
        moveTo(getRow(), cellsLeft);
        wearColumnsUpTo(columnOf(cellsLeft));
        if (cellsLeft >= spawnCellsToFarm) {
            flee();
        }
    }

    // The column closed: it leaves the field by the flee row, at the edge of that column, and starts going back.
    // It arrives on the defense line at that column: this column is worn first.
    private void startRetreat(int fleeRow, int column) {
        moveTo(fleeRow, column + CELLS_FROM_FIELD_TO_FARM);
        retreating = true;
        lastWornColumn = column - 1;
        wearColumnsUpTo(column);
    }

    // Wears each column after the last one worn, up to this one, never past column 5: a long frame that crosses
    // several columns wears each of them, and a column is never worn twice.
    private void wearColumnsUpTo(int column) {
        int lastColumn = Math.min(column, Board.COLUMNS);
        for (int next = lastWornColumn + 1; next <= lastColumn; next++) {
            defenseLine.wearAt(getRow(), next, defenseWear);
            lastWornColumn = next;
        }
    }

    // The same formula as Catapatate: ceil(6.5) = 7, minus 3: column 4. At the edge of a column (6.0), it is that
    // column (3). Past the field (more than 8 cells), the result is above 5.
    private static int columnOf(float cellsToFarm) {
        return (int) Math.ceil(cellsToFarm) - CELLS_FROM_FIELD_TO_FARM;
    }

    // Called after each walk with the cells left before and after it. Column c is entered when the cells left
    // reach c + 3: entered now if that edge lies between "after" (included) and "before" (excluded), so a
    // column is never entered twice. From column 5 to column 1: the order the enemy reaches them in.
    // Before each column, the strategy gives the row: the enemy moves to it, then enters the cell of that row.
    // A long frame can enter several columns; the loop stops if a cell kills the enemy, or if it must flee.
    private void enterCellsBetween(float cellsBefore, float cellsAfter) {
        for (int column = Board.COLUMNS; column >= 1; column--) {
            int entryEdge = column + CELLS_FROM_FIELD_TO_FARM;
            if (cellsAfter <= entryEdge && entryEdge < cellsBefore) {
                int nextRow = moveStrategy.nextRow(getRow(), column, board, random);
                if (isFleeRow(nextRow)) {
                    // The column is closed. The rest of a long frame does not count: it never walks further.
                    startRetreat(nextRow, column);
                    return;
                }
                moveTo(nextRow, getCellsToFarm());
                onEnterCell(board.getCell(getRow(), column));
                if (isDead()) {
                    return;
                }
            }
        }
    }

    // Rows 0 and 4 are not on the field: the strategy gives them when the column is closed.
    private static boolean isFleeRow(int row) {
        return row == TOP_FLEE_ROW || row == BOTTOM_FLEE_ROW;
    }

    // The type in lower case ("bat", "witch"), with "_attack" during the 0.3 s that follow a hit on the farm.
    // Before day 14, "_attack" as soon as it stood in front of the farm: the image never changed, so the player never
    // saw the hits (feedback of the mid-term jury). Between two hits, the walking image, even in front of the farm.
    // Day 14 too: "_back" while it goes back along a flee row (retreating), seen from behind (east-*.png). Before, it
    // went back "in moonwalk", still turned to the farm (feedback of the mid-term jury). An enemy that goes back never
    // hits the farm, so the two suffixes never meet.
    // The same rule for every lane enemy: a new one only needs its three keys in view/SpriteCatalog.
    // Locale.ROOT: on a Turkish computer, "WITCH".toLowerCase() would give a dotless ı.
    /**
     * Returns the key of the sprite that shows the enemy: walking, attacking just after a hit on the farm, or seen
     * from behind while it goes back along a flee row.
     *
     * @return the type in lower case, followed by {@code "_back"} while it goes back, or by {@code "_attack"} during
     *         the 0.3 s that follow a hit
     */
    @Override
    public String spriteKey() {
        String walking = getType().name().toLowerCase(Locale.ROOT);
        if (retreating) {
            return walking + "_back";
        }
        return attackPoseLeft > 0 ? walking + "_attack" : walking;
    }

    // Moves towards the farm and returns the part of delta not used for walking.
    // cellsLeft / speed = time needed to reach the farm. The cells are changed through moveTowardsFarm,
    // which never lets the enemy go past the farm.
    private float walk(float delta) {
        float cellsLeft = getCellsToFarm();
        if (cellsLeft <= 0) {
            return delta;
        }
        float timeToFarm = cellsLeft / speed;
        if (delta < timeToFarm) {
            moveTowardsFarm(speed * delta);
            return 0;
        }
        moveTowardsFarm(cellsLeft);
        return delta - timeToFarm;
    }

    // Adds the time spent in front of the farm, and hits once per full cooldown.
    // update calls it at every frame, even far from the farm (with 0 s left): without the first check, a clock that
    // starts already full (a first delay of 0) would hit the farm from the entry of the row.
    // A while loop, not an if: a long frame can hold several hits.
    // Day 14: after a hit, timeSinceLastHit is exactly the time of this frame spent since that hit. The pose keeps
    // what is left of its 0.3 s: a hit at the very end of the frame shows the whole pose, a hit 1 s before the end
    // of a long frame shows none. So a single long frame gives the same image as many small ones.
    private void hitFarm(float time) {
        if (getCellsToFarm() > 0) {
            return;
        }
        timeSinceLastHit += time;
        while (timeSinceLastHit >= farmHitCooldown && !farm.isDestroyed()) {
            farm.takeDamage(farmDamage);
            timeSinceLastHit -= farmHitCooldown;
            attackPoseLeft = Math.max(0, ATTACK_POSE_SECONDS - timeSinceLastHit);
        }
    }
}
