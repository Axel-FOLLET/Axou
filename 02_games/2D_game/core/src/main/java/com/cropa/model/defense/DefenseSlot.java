package com.cropa.model.defense;

// Board: the number of columns of the field, written once in the model (L5).
// Optional: lets getDefense() say "nothing here" without ever returning null.
import com.cropa.model.world.Board;
import java.util.Optional;

// No extends: a place outside the field, above row 1 or under row 3, that holds at most one defense.
// It works like Cell, but it is not a Cell: a catapatate is not an Occupant of the field.
/**
 * One defense slot: its side, its column and at most one {@link Defense}.
 */
public class DefenseSlot {

    //-------------------- CONSTANTS --------------------
    // The slots line up with the columns of the field: the last one is Board.COLUMNS, never a 5 copied here.
    private static final int FIRST_COLUMN = 1;
    private static final int LAST_COLUMN = Board.COLUMNS;

    //-------------------- FIELDS --------------------
    // side and column never change. defense changes over time; null only means "empty" inside this class.
    private final SlotSide side;
    private final int column;
    private Defense defense;

    //-------------------- CONSTRUCTOR --------------------
    // Called by DefenseSlots. A wrong column is a programming error, reported right away.
    /**
     * Creates an empty slot.
     *
     * @param side the side of the field
     * @param column the column, from 1 to 5
     * @throws IllegalArgumentException if the column is not between 1 and 5
     */
    public DefenseSlot(SlotSide side, int column) {
        if (column < FIRST_COLUMN || column > LAST_COLUMN) {
            throw new IllegalArgumentException("column must be between 1 and " + LAST_COLUMN + ", got " + column);
        }
        this.side = side;
        this.column = column;
    }

    //-------------------- QUERIES --------------------
    // Read by the catapatate to know what it can reach, and by the view to draw the slot.
    /**
     * Returns the side of this slot.
     *
     * @return the side
     */
    public SlotSide getSide() {
        return side;
    }

    /**
     * Returns the column of this slot.
     *
     * @return the column, from 1 to 5
     */
    public int getColumn() {
        return column;
    }

    // Optional.ofNullable turns the internal null into Optional.empty(): callers never see null.
    /**
     * Returns the defense placed on this slot.
     *
     * @return the defense, or an empty {@code Optional} if the slot is free
     */
    public Optional<Defense> getDefense() {
        return Optional.ofNullable(defense);
    }

    // Shortcut for callers who only need to know if the slot is free.
    /**
     * Tells whether this slot holds no defense.
     *
     * @return {@code true} if it is free
     */
    public boolean isEmpty() {
        return defense == null;
    }

    //-------------------- ACTIONS --------------------
    // Called when the player buys a defense. Occupied: nothing is placed, and the caller must not charge the player.
    /**
     * Places a defense on this slot if it is free.
     *
     * @param newDefense the defense to place
     * @return {@code true} if it was placed, {@code false} if the slot was already occupied
     */
    public boolean place(Defense newDefense) {
        if (!isEmpty()) {
            return false;
        }
        defense = newDefense;
        return true;
    }

    // Called when a defense is destroyed. Without it, the slot would stay occupied forever.
    /**
     * Frees this slot by removing its defense, if any.
     */
    public void remove() {
        defense = null;
    }
}
