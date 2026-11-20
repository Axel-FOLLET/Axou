package com.cropa.model.enemy;

// Cell: the cell of the field the enemy enters (Antonin's model).
import com.cropa.model.world.Cell;

// Whatever crosses the cells of the field. The common code (LaneEnemy) only calls onEnterCell, and each
// crosser does what it can: a walker lets the cell react, a flyer triggers nothing.
// So nobody asks "is it flying?": no isFlying(), no instanceof.
/**
 * Something that enters the cells of the field one after the other.
 */
public interface CellCrosser {

    /**
     * Reacts to entering a cell of the field.
     *
     * @param cell the cell just entered
     */
    void onEnterCell(Cell cell);
}
