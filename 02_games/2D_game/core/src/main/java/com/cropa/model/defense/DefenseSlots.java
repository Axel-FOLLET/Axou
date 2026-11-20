package com.cropa.model.defense;

// Cell: a cell of the field, where the scarecrow and the bramble stand. Occupant: what a cell accepts.
// DefenseLine: the interface the enemies wear the slots through, without knowing this class.
// Board: the size of the field, written once in the model (L5).
import com.cropa.model.world.Board;
import com.cropa.model.world.Cell;
import com.cropa.model.world.DefenseLine;
import com.cropa.model.world.Occupant;
// ArrayList and List: the list of defenses given to the game. EnumMap and Map: one row of slots per side.
// LinkedHashMap: the defenses of the field, in the order they were placed. Optional: "no defense here" without null.
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

// All the defenses of the game, in one place: the 10 slots around the field, and the defenses placed on its cells.
// The scarecrow and the bramble are Occupants of a Cell, but the game must still update them and the screen
// must find them on a click: this class keeps them too, so nobody asks a cell's occupant what it is (no instanceof).
// implements DefenseLine: a fleeing enemy wears the slots of its row through wearAt, and imports nothing from defense.
/**
 * The 10 defense slots, 5 above the field and 5 under it, and the defenses placed on the
 * cells of the field.
 */
public class DefenseSlots implements DefenseLine {

    //-------------------- CONSTANTS --------------------
    // The rows of the slots, as the enemies count them: 0 above the field, the row after the last one under it
    // (Board.ROWS + 1, so 4: rows 1 to 3 are the field). The columns are those of the field: Board.COLUMNS.
    private static final int TOP_ROW = 0;
    private static final int BOTTOM_ROW = Board.ROWS + 1;

    //-------------------- FIELDS --------------------
    // One array per side. The column is 1-based and the array index is one less: slots[0] is column 1.
    private final Map<SlotSide, DefenseSlot[]> slots = new EnumMap<>(SlotSide.class);
    // Cell -> the defense placed on it. Cell has no equals: the key is the very cell of the Board.
    private final Map<Cell, Defense> fieldDefenses = new LinkedHashMap<>();

    //-------------------- CONSTRUCTOR --------------------
    // Called once when a game starts.
    /**
     * Creates the 10 empty slots.
     */
    public DefenseSlots() {
        for (SlotSide side : SlotSide.values()) {
            DefenseSlot[] row = new DefenseSlot[Board.COLUMNS];
            for (int column = 1; column <= Board.COLUMNS; column++) {
                row[column - 1] = new DefenseSlot(side, column);
            }
            slots.put(side, row);
        }
    }

    //-------------------- QUERIES --------------------
    // Used by the game to place a defense, and by the screen to find the clicked slot.
    // Outside the columns is a programming error, so it fails right away instead of returning null.
    /**
     * Returns the slot at the given side and column.
     * The same values always give the same slot.
     *
     * @param side the side of the field
     * @param column the column, from 1 to 5
     * @return the slot at this place
     * @throws IllegalArgumentException if the column is not between 1 and 5
     */
    public DefenseSlot getSlot(SlotSide side, int column) {
        if (column < 1 || column > Board.COLUMNS) {
            throw new IllegalArgumentException("column must be between 1 and " + Board.COLUMNS + ", got " + column);
        }
        return slots.get(side)[column - 1];
    }

    // Called by the game on every frame, to call update on each defense: those of the slots, then those of the field.
    // A new list each time, so the caller cannot change the slots through it, and a defense destroyed
    // during the loop can leave its place: the loop walks this copy, not the slots nor the map.
    /**
     * Returns the defenses placed on the slots and on the field.
     *
     * @return a new list of the defenses, empty if there are none
     */
    public List<Defense> getDefenses() {
        purgeField();
        List<Defense> defenses = new ArrayList<>();
        for (DefenseSlot[] row : slots.values()) {
            for (DefenseSlot slot : row) {
                slot.getDefense().ifPresent(defenses::add);
            }
        }
        defenses.addAll(fieldDefenses.values());
        return defenses;
    }

    // Used by the screen on a click on a cell: the defense of that cell, if any, without asking the occupant.
    /**
     * Returns the defense placed on the given cell of the field.
     *
     * @param cell the cell of the field
     * @return the defense, or an empty {@code Optional} if the cell holds none
     */
    public Optional<Defense> getDefenseOn(Cell cell) {
        purgeField();
        return Optional.ofNullable(fieldDefenses.get(cell));
    }

    // Used by the screen to draw the durability of each defense of the field above its cell.
    // A copy: the caller cannot add or remove a defense through it.
    /**
     * Returns the defenses of the field, with the cell each one stands on.
     *
     * @return a new map, cell to defense, in the order they were placed
     */
    public Map<Cell, Defense> getFieldDefenses() {
        purgeField();
        return new LinkedHashMap<>(fieldDefenses);
    }

    //-------------------- ACTIONS --------------------
    // Called by DefenseOffer when the player buys a scarecrow or a bramble.
    // <D extends Defense & Occupant>: the parameter must be both, so it can go into the Cell (Occupant)
    // and into the map (Defense). A crop (Occupant only) or a catapatate (Defense only) does not compile.
    // The cell decides: occupied, nothing is placed, nothing is kept, and the shop does not charge the player.
    /**
     * Places a defense of the field on the given cell, if the cell is empty.
     *
     * @param cell the cell of the field
     * @param defense the scarecrow or the bramble to place
     * @param <D> a defense that can sit on a cell
     * @return {@code true} if it was placed, {@code false} if the cell was already occupied
     */
    public <D extends Defense & Occupant> boolean placeOnField(Cell cell, D defense) {
        if (!cell.place(defense)) {
            return false;
        }
        fieldDefenses.put(cell, defense);
        return true;
    }

    // Called by LaneEnemy while it flees along row 0 or row 4, for each column it enters (Yohan, this afternoon).
    // Row 0 gives the TOP side, row 4 the BOTTOM side; any other row is the field, so nothing is worn and it returns.
    // ifPresent: an empty slot has nothing to wear. The lambda reads percent, the parameter of wearAt.
    // wear() keeps its own rules: at 0 %, the defense leaves its slot.
    /**
     * Wears the defense of the slot at this row and column, if there is one.
     * Row 0 is the slots above the field, row 4 the slots under it; any other row does nothing.
     *
     * @param row the row, 0 or 4 for a slot
     * @param column the column, from 1 to 5
     * @param percent the durability to remove, in percent
     * @throws IllegalArgumentException if the row is 0 or 4 and the column is not between 1 and 5
     */
    @Override
    public void wearAt(int row, int column, int percent) {
        SlotSide side;
        if (row == TOP_ROW) {
            side = SlotSide.TOP;
        } else if (row == BOTTOM_ROW) {
            side = SlotSide.BOTTOM;
        } else {
            return;
        }
        getSlot(side, column).getDefense().ifPresent(d -> d.wear(percent));
    }

    //-------------------- INTERNALS --------------------
    // A witch, a harvest or a destroyed defense frees the cell without telling DefenseSlots:
    // each read first removes the entries whose cell no longer holds that very defense.
    // filter keeps the occupant only if it is this defense (==, the same object); isEmpty then means "gone".
    private void purgeField() {
        fieldDefenses.entrySet().removeIf(e -> e.getKey().getOccupant().filter(o -> o == e.getValue()).isEmpty());
    }
}
