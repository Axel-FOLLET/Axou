package com.cropa.model.enemy;

// Cell: the cell of the field flown over.
import com.cropa.model.world.Cell;

// Flying is a behaviour: a flyer passes over the cells without touching them.
// The default method gives the behaviour to every class that implements Flyable (the bat), written once here.
// So a bramble never hurts a bat and a bat never crushes a crop: crossBy is simply never called.
/**
 * A crosser that flies over the cells: nothing on the cell is triggered.
 */
public interface Flyable extends CellCrosser {

    // Empty on purpose: flying over a cell triggers nothing.
    /**
     * Flies over the cell: nothing happens.
     *
     * @param cell the cell flown over
     */
    @Override
    default void onEnterCell(Cell cell) {
    }
}
