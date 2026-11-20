package com.cropa.model.enemy;

// Board: the field it looks at. CropType: the crop this strategy avoids. Random: injected, decides the ties.
import com.cropa.model.world.Board;
import com.cropa.model.world.CropType;
import java.util.Random;

// The rule decided by the team (it goes further than "a neighbouring row" of rules.md §8):
// in front of a crop that blocks it, the enemy goes to the nearest free row of the same column, at random if two
// rows are as near. A free row is a cell that does not block it: a carrot does not stop the witch, she goes there.
// It flees only when the 3 rows of the column block it: row 1 by row 0, row 3 by row 4, row 2 by 0 or 4 at random.
// One class for both enemies: the witch avoids TURNIP, the bat GARLIC. No instanceof: each occupant says itself
// whether it blocks (Occupant.blocks).
/**
 * Turns the enemy aside from the crops of one type: to the nearest free row, or away if the column is closed.
 */
public class DeviateStrategy implements MoveStrategy {

    //-------------------- CONSTANTS --------------------
    // The shape of the field comes from Enemy (same package): rows 1 to 3, flee rows 0 and 4, written once.
    // The middle row, 2, is as far from both flee rows.
    private static final int MIDDLE_ROW = (Enemy.TOP_FLEE_ROW + Enemy.BOTTOM_FLEE_ROW) / 2;

    //-------------------- STATE --------------------
    // The crop this strategy avoids: the only difference between the witch and the bat.
    private final CropType blocker;

    //-------------------- CONSTRUCTOR --------------------
    /**
     * Creates a strategy that avoids one type of crop.
     *
     * @param blocker the crop type that stops the enemy
     */
    public DeviateStrategy(CropType blocker) {
        this.blocker = blocker;
    }

    //-------------------- STRATEGY --------------------
    // Not blocked: same row. Blocked: the nearest free row, looked for at a growing distance (1, then 2), and at
    // random when both rows at that distance are free. None: the flee row.
    /**
     * Gives the row on which the enemy enters the column.
     *
     * <p>The same row if the cell does not block the enemy; otherwise the nearest row of the column that does not
     * block it, chosen at random between two rows as near; if the 3 rows block it, the nearest flee row (0 or 4),
     * at random from row 2.
     *
     * @param row the row the enemy is on, from 1 to 3
     * @param column the column it is about to enter, from 1 to 5
     * @param board the field
     * @param random the source of the random choices
     * @return the row to enter the column on: 1 to 3 on the field, or 0 or 4 to flee
     */
    @Override
    public int nextRow(int row, int column, Board board, Random random) {
        if (!blocks(row, column, board)) {
            return row;
        }
        for (int distance = 1; distance < Board.ROWS; distance++) {
            boolean aboveFree = isFree(row - distance, column, board);
            boolean belowFree = isFree(row + distance, column, board);
            if (aboveFree && belowFree) {
                return random.nextBoolean() ? row - distance : row + distance;
            }
            if (aboveFree) {
                return row - distance;
            }
            if (belowFree) {
                return row + distance;
            }
        }
        return fleeRow(row, random);
    }

    // A row of the field whose cell does not block the enemy. Rows outside 1 to 3 are never free.
    private boolean isFree(int row, int column, Board board) {
        return row >= 1 && row <= Board.ROWS && !blocks(row, column, board);
    }

    // Optional.map then orElse: an empty cell blocks nobody, without null and without asking what the occupant is.
    private boolean blocks(int row, int column, Board board) {
        return board.getCell(row, column).getOccupant().map(occupant -> occupant.blocks(blocker)).orElse(false);
    }

    // The nearest defense row: 0 from row 1, 4 from row 3. Row 2 is as far from both: a coin decides.
    private int fleeRow(int row, Random random) {
        if (row < MIDDLE_ROW) {
            return Enemy.TOP_FLEE_ROW;
        }
        if (row > MIDDLE_ROW) {
            return Enemy.BOTTOM_FLEE_ROW;
        }
        return random.nextBoolean() ? Enemy.TOP_FLEE_ROW : Enemy.BOTTOM_FLEE_ROW;
    }
}
