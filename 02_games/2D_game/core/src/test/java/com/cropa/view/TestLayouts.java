package com.cropa.view;

// Java: the tables given to BoardLayout.
import java.util.HashMap;
import java.util.Map;

// final with a private constructor: tables shared by the tests of the view.
/**
 * The places of map_v1.tmx once libGDX has read it, y going up: column 1 starts at x = 160,
 * row 1 is the highest row (y = 176), and the top slots are above it.
 */
public final class TestLayouts {

    //-------------------- CONSTANTS --------------------
    // The size of one tile of the map, in pixels.
    public static final float TILE_SIZE = 16;

    private TestLayouts() {
    }

    //-------------------- TABLES --------------------
    /** Returns the 15 cells, by name. */
    public static Map<String, Bounds> cells() {
        Map<String, Bounds> cells = new HashMap<>();
        for (int column = 1; column <= 5; column++) {
            for (int row = 1; row <= 3; row++) {
                cells.put("r" + row + "c" + column, new Bounds(columnX(column), 192 - row * TILE_SIZE, TILE_SIZE, TILE_SIZE));
            }
        }
        return cells;
    }

    /** Returns the 10 defense slots, by name. */
    public static Map<String, Bounds> slots() {
        Map<String, Bounds> slots = new HashMap<>();
        for (int column = 1; column <= 5; column++) {
            slots.put("top" + column, new Bounds(columnX(column), 192, TILE_SIZE, TILE_SIZE));
            slots.put("bottom" + column, new Bounds(columnX(column), 128, TILE_SIZE, TILE_SIZE));
        }
        return slots;
    }

    /** Returns the 3 spots, by name. */
    public static Map<String, Point> spots() {
        Map<String, Point> spots = new HashMap<>();
        spots.put("farm", new Point(80, 160));
        spots.put("farmer", new Point(136, 160));
        spots.put("cat", new Point(120, 192));
        return spots;
    }

    /** Returns a complete layout. */
    public static BoardLayout layout() {
        return new BoardLayout(cells(), slots(), spots());
    }

    // Called for each cell and slot: the five columns follow one another from x = 160.
    private static float columnX(int column) {
        return 160 + (column - 1) * TILE_SIZE;
    }
}
