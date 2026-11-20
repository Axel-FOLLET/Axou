package com.cropa.model.enemy;

// Board: the field the strategy looks at. Random: given from outside (injected), so a test fixes the draws.
import com.cropa.model.world.Board;
import java.util.Random;

// The Strategy pattern: how a lane enemy chooses its row is an object it receives, not code written in it.
// LaneEnemy asks nextRow before entering each column, without knowing which strategy it holds:
// a new way of moving (an enemy that never turns aside, or one that zigzags) is a new class, LaneEnemy unchanged.
/**
 * How a lane enemy chooses its row before entering a column of the field.
 */
public interface MoveStrategy {

    /**
     * Gives the row on which the enemy enters the column.
     *
     * @param row the row the enemy is on, from 1 to 3
     * @param column the column it is about to enter, from 1 to 5
     * @param board the field
     * @param random the source of the random choices
     * @return the row to enter the column on: 1 to 3 on the field, or 0 or 4 to flee
     */
    int nextRow(int row, int column, Board board, Random random);
}
