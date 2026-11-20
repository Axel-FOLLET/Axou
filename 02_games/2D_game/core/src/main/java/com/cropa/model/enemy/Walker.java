package com.cropa.model.enemy;

// Cell: the cell walked on. Damageable: a walker can be hurt by what sits on the cell (a bramble).
import com.cropa.model.world.Cell;
import com.cropa.model.world.Damageable;

// Walking is a behaviour: a walker steps on the cell, and the cell reacts through Cell.crossBy.
// The occupant decides: a crop is crushed and leaves, a bramble stays and hurts the walker (takeDamage).
// extends Damageable: crossBy needs something it can hurt, so only a Damageable can be a Walker.
/**
 * A crosser that walks on the cells: the occupant of each cell reacts to it.
 */
public interface Walker extends CellCrosser, Damageable {

    // The default method gives the behaviour to every walker (the witch), written once here.
    /**
     * Walks on the cell: its occupant reacts, and may hurt the walker or leave the cell.
     *
     * @param cell the cell walked on
     */
    @Override
    default void onEnterCell(Cell cell) {
        cell.crossBy(this);
    }
}
