package com.cropa.model.enemy;

// Board and Cell: the field the mole eats from. Occupant: what sits on a cell; it says itself if a mole eats it.
// List: the cells it may eat. Random: chooses one of them, given from outside (injected).
import com.cropa.model.world.Board;
import com.cropa.model.world.Cell;
import com.cropa.model.world.Occupant;
import java.util.List;
import java.util.Random;

// The mole (rules §8, §10): it eats a crop at random, 3 s, visible and attackable, then waits 11 s underground,
// where nothing can touch it. 2 meals at most (3 before day 10), then it leaves.
// Once underground, it leaves at once if there is nothing left to eat.
// It ignores the farm and does not eat the bramble.
// extends Enemy, not LaneEnemy: it follows no row and never hits the farm, so it walks nowhere.
// The Random is given by whoever creates the mole: a test gives new Random(1), so the draws are always the same.
// No instanceof: each occupant says itself whether a mole eats it (onBittenByMole), a crop yes, a bramble no.
/**
 * The mole: it eats crops from underground, and can only be hit while it eats.
 */
public class Mole extends Enemy {

    //-------------------- CONSTANTS --------------------
    // Before its first meal the mole is underground: it needs a row to be born (the constructor of Enemy checks
    // 1 to 3), but this row is never seen. The first meal puts it on its crop with moveTo.
    private static final int UNDERGROUND_START_ROW = 1;

    //-------------------- STATE --------------------
    // The field it eats from, and the source of its draws.
    private final Board board;
    private final Random random;

    // Read once in the config at creation: the numbers are only written in EnemyConfig.
    private final float mealDuration;
    private final float waitDuration;
    private final int maxMeals;

    // One single timer that goes down: the time left of the meal, or of the wait. At 0, the next step happens.
    // It starts at 0, so the mole looks for a crop at its very first frame.
    private float timer;
    private boolean eating;
    private int meals;

    // The cell of the current meal and the crop that was on it: the crop leaves only if it is still the same.
    private Cell mealCell;
    private Occupant meal;

    //-------------------- CONSTRUCTOR --------------------
    // Called by the tests today, and by EnemyFactory from day 8.
    /**
     * Creates a mole underground, before its first meal.
     *
     * @param board the field the mole eats from
     * @param config the balancing numbers
     * @param random the source of the random choice of the crop
     */
    public Mole(Board board, EnemyConfig config, Random random) {
        super(EnemyType.MOLE, UNDERGROUND_START_ROW, config);
        this.board = board;
        this.random = random;
        this.mealDuration = config.getMoleMealDuration();
        this.waitDuration = config.getMoleWaitDuration();
        this.maxMeals = config.getMoleMaxMeals();
    }

    //-------------------- ACTIONS --------------------
    // Nothing once dead, fled, or for a delta that is not positive: a mole killed during its meal stops here,
    // so the crop stays.
    // A meal lasts until its timer runs out. Underground, the wait ends early if the food is gone.
    // One step per frame, the time beyond 0 is not carried over: at about 60 frames per second, the difference
    // is invisible, and it is the rhythm the landmarks of the day sheet rely on.
    /**
     * Moves the mole forward in time: underground it waits, then eats a crop, then waits again.
     *
     * @param delta the seconds elapsed since the previous frame; ignored if not positive
     */
    @Override
    public void update(float delta) {
        if (isDead() || hasFled() || delta <= 0) {
            return;
        }
        timer -= delta;
        if (timer > 0) {
            if (!eating && edibleCells().isEmpty()) {
                flee();
            }
            return;
        }
        if (eating) {
            endMeal();
        } else {
            startMeal();
        }
    }

    // Looks for the cells whose occupant a mole eats, and picks one at random.
    // If none is edible, the mole leaves at once.
    // On its cell, the mole stands in the middle of the column: column + 3 - 0.5 cells left. Catapatate finds the
    // column with ceil(cellsToFarm) - 3, so it aims at the right cell.
    private void startMeal() {
        List<Cell> edibleCells = edibleCells();
        if (edibleCells.isEmpty()) {
            flee();
            return;
        }
        mealCell = edibleCells.get(random.nextInt(edibleCells.size()));
        meal = mealCell.getOccupant().orElseThrow();
        moveTo(mealCell.getRow(), mealCell.getColumn() + CELLS_FROM_FIELD_TO_FARM - 0.5f);
        eating = true;
        timer = mealDuration;
    }

    // Every cell of the field, kept if its occupant says a mole eats it.
    // One walk of the field, Board.getCells (day 10, L5), instead of two loops of its own. Its order is row by row,
    // from r1c1 to r3c5, the order of the two loops it replaces: the list is the same, so random.nextInt picks the
    // same crop as before for the same seed (MoleTest is unchanged).
    // Optional.map then orElse: an empty cell gives false, without null and without asking what the occupant is.
    private List<Cell> edibleCells() {
        return board.getCells().stream()
                .filter(cell -> cell.getOccupant().map(Occupant::onBittenByMole).orElse(false))
                .toList();
    }

    // The meal is over: the crop leaves only if it is still the one the mole started on (the witch may have
    // crushed it, and another one may have been planted). Then underground, or away after the last meal.
    private void endMeal() {
        if (mealCell.getOccupant().filter(occupant -> occupant == meal).isPresent()) {
            mealCell.remove();
        }
        mealCell = null;
        meal = null;
        eating = false;
        meals++;
        if (meals >= maxMeals || edibleCells().isEmpty()) {
            flee();
        } else {
            timer = waitDuration;
        }
    }

    // It follows no row: entering a cell triggers nothing.
    /**
     * Does nothing: the mole follows no row, it only reaches a cell to eat its crop.
     *
     * @param cell the cell entered
     */
    @Override
    public void onEnterCell(Cell cell) {
    }

    //-------------------- QUERIES --------------------
    // Underground, nothing can touch it: only during its meal. A state that changes over time, so a method,
    // not an interface.
    /**
     * Tells whether defenses and the farmer can hit the mole: only while it eats.
     *
     * @return {@code true} during a meal
     */
    @Override
    public boolean isTargetable() {
        return eating;
    }

    // Adds a condition to the one of Enemy (neither dead nor fled): underground, the view does not draw it.
    /**
     * Tells whether the mole is on the board: alive, not fled, and out of the ground to eat.
     *
     * @return {@code true} during a meal, if the mole is alive and has not fled
     */
    @Override
    public boolean isOnBoard() {
        return super.isOnBoard() && isTargetable();
    }

    /**
     * Returns the key of the sprite that shows the mole.
     *
     * @return {@code "mole"}
     */
    @Override
    public String spriteKey() {
        return "mole";
    }
}
