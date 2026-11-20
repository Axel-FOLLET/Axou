package com.cropa.view;

// Java: the maps that give a rectangle or a point by its name. SlotSide: the side of a defense slot, from the model.
// DefenseSlot and DefenseSlots: the slot found under a click, among the 10 of the game. Optional: "no slot there" without null.
// Board and Cell: the cell of the field found under a click; Board also gives the size of the field.
import com.cropa.model.defense.DefenseSlot;
import com.cropa.model.defense.DefenseSlots;
import com.cropa.model.defense.SlotSide;
import com.cropa.model.world.Board;
import com.cropa.model.world.Cell;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

// No extends, no implements, no libGDX: it receives plain tables, so a test creates it without a map file.
/**
 * Bridge between the places read from the map and the model: the only class that turns rows,
 * columns and cells left to the farm into world pixels.
 */
public class BoardLayout {

    //-------------------- CONSTANTS --------------------
    private static final String[] SPOT_NAMES = {"farm", "farmer", "cat"};
    // The size of the field is no longer copied here (L5): Board.ROWS and Board.COLUMNS, written once in the model,
    // are read by this class and by every renderer that goes through the cells and the slots.
    // One numbering for all the rows: 1 to 3 are the field; 0 and 4 (Board.ROWS + 1) are the rows enemies flee by,
    // along the defense slots.
    private static final int TOP_FLEE_ROW = 0;
    private static final int BOTTOM_FLEE_ROW = Board.ROWS + 1;
    // The left edge of column 1 is 3 cells away from the farm (rules, section 4).
    private static final int FIELD_LEFT_CELLS_TO_FARM = 3;

    //-------------------- FIELDS --------------------
    // Filled once by the constructor, then only read. Bounds and Point cannot be changed, so giving them out is safe.
    private final Bounds[][] cells = new Bounds[Board.ROWS][Board.COLUMNS];
    private final Bounds[] topSlots = new Bounds[Board.COLUMNS];
    private final Bounds[] bottomSlots = new Bounds[Board.COLUMNS];
    private final Map<String, Point> spots = new HashMap<>();

    //-------------------- CONSTRUCTOR --------------------
    // Called once by TiledLayoutReader, right after the map is read.
    // Looks for the 28 names (15 cells, 10 slots, 3 spots); without this early check,
    // a missing name would only show up when an enemy reaches that cell.
    /**
     * Keeps the cells, slots and spots of the map.
     *
     * @param cellAreas the cells, by name: {@code r1c1} to {@code r3c5}
     * @param slotAreas the defense slots, by name: {@code top1} to {@code top5}, {@code bottom1} to {@code bottom5}
     * @param spotPoints the spots, by name: {@code farm}, {@code farmer}, {@code cat}
     * @throws IllegalArgumentException if a name is missing
     */
    public BoardLayout(Map<String, Bounds> cellAreas, Map<String, Bounds> slotAreas, Map<String, Point> spotPoints) {
        for (int row = 1; row <= Board.ROWS; row++) {
            for (int column = 1; column <= Board.COLUMNS; column++) {
                cells[row - 1][column - 1] = find(cellAreas, "r" + row + "c" + column);
            }
        }
        for (int column = 1; column <= Board.COLUMNS; column++) {
            topSlots[column - 1] = find(slotAreas, "top" + column);
            bottomSlots[column - 1] = find(slotAreas, "bottom" + column);
        }
        for (String name : SPOT_NAMES) {
            spots.put(name, find(spotPoints, name));
        }
    }

    // Generic: the same search for a Bounds and for a Point. Map.get gives null for an unknown name: the exception names it.
    private static <T> T find(Map<String, T> places, String name) {
        T place = places.get(name);
        if (place == null) {
            throw new IllegalArgumentException("Object missing from the map: " + name);
        }
        return place;
    }

    //-------------------- GETTERS --------------------
    // The model counts from 1, the arrays from 0: hence the - 1.
    /**
     * Gives the rectangle of a field cell.
     *
     * @param row the row, from 1 to 3
     * @param column the column, from 1 to 5
     * @return the cell's rectangle, in world pixels
     */
    public Bounds getCellBounds(int row, int column) {
        return cells[row - 1][column - 1];
    }

    /**
     * Gives the rectangle of a defense slot.
     *
     * @param side the side of the field the slot is on
     * @param column the column, from 1 to 5
     * @return the slot's rectangle, in world pixels
     */
    public Bounds getSlotBounds(SlotSide side, int column) {
        if (side == SlotSide.TOP) {
            return topSlots[column - 1];
        }
        return bottomSlots[column - 1];
    }

    // Map.get gives null for an unknown name: the exception stops it from reaching the screen.
    /**
     * Gives a point of the map.
     *
     * @param name {@code farm}, {@code farmer} or {@code cat}
     * @return the point, in world pixels
     * @throws IllegalArgumentException if the name is not one of the three
     */
    public Point getSpot(String name) {
        Point spot = spots.get(name);
        if (spot == null) {
            throw new IllegalArgumentException("Unknown spot: " + name);
        }
        return spot;
    }

    //-------------------- MODEL TO SCREEN --------------------
    // Called on every frame for each enemy, from the J5 on.
    // 3 cells left is the left edge of column 1, and each cell left moves the enemy one cell wide:
    // 0 gives x = 192, 8 gives x = 320, 10 gives x = 352.
    // Thus the result is the middle of the enemy: at 3.5, it is the centre of column 1.
    /**
     * Turns the place of an enemy into a point on the screen.
     *
     * @param row the row, from 0 to 4, the flee rows included
     * @param cellsToFarm the cells left to the farm, from 10 (spawn) to 0 (in front of the farm)
     * @return the point at the middle of the enemy, in world pixels
     */
    public Point toScreen(int row, float cellsToFarm) {
        Bounds firstCell = cells[0][0];
        Bounds rowBounds = firstBoundsOfRow(row);
        float x = firstCell.x() + (cellsToFarm - FIELD_LEFT_CELLS_TO_FARM) * firstCell.width();
        float y = rowBounds.y() + rowBounds.height() / 2;
        return new Point(x, y);
    }

    //-------------------- SCREEN TO MODEL --------------------
    // Called by GameScreen on a click, with the point already in world pixels (unproject).
    // Goes through the 10 slot rectangles; the first one that contains the point gives the slot of the same side
    // and column in the model. None: an empty Optional, and the screen does nothing.
    /**
     * Finds the defense slot under a point of the world.
     *
     * @param x the x of the point, in world pixels
     * @param y the y of the point, in world pixels
     * @param slots the 10 slots of the game
     * @return the slot under the point, or an empty Optional outside the slots
     */
    public Optional<DefenseSlot> findSlot(float x, float y, DefenseSlots slots) {
        for (SlotSide side : SlotSide.values()) {
            for (int column = 1; column <= Board.COLUMNS; column++) {
                if (getSlotBounds(side, column).contains(x, y)) {
                    return Optional.of(slots.getSlot(side, column));
                }
            }
        }
        return Optional.empty();
    }

    // Called by GameScreen on a click that found no defense on a slot. The same search as findSlot, on the 15 cells:
    // the first rectangle that contains the point gives the cell of the same row and column on the board.
    // Bounds.contains keeps the left and bottom edges: a click on the line between two cells belongs to one only.
    /**
     * Finds the cell of the field under a point of the world.
     *
     * @param x the x of the point, in world pixels
     * @param y the y of the point, in world pixels
     * @param board the field of the game
     * @return the cell under the point, or an empty Optional outside the field
     */
    public Optional<Cell> findCell(float x, float y, Board board) {
        for (int row = 1; row <= Board.ROWS; row++) {
            for (int column = 1; column <= Board.COLUMNS; column++) {
                if (getCellBounds(row, column).contains(x, y)) {
                    return Optional.of(board.getCell(row, column));
                }
            }
        }
        return Optional.empty();
    }

    // Rows 1 to 3 are field cells; rows 0 and 4 only exist as defense slots.
    private Bounds firstBoundsOfRow(int row) {
        if (row == TOP_FLEE_ROW) {
            return topSlots[0];
        }
        if (row == BOTTOM_FLEE_ROW) {
            return bottomSlots[0];
        }
        return cells[row - 1][0];
    }
}
