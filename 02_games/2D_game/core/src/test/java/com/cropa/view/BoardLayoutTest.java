package com.cropa.view;

// JUnit: the four checks the tests use, and the annotation that marks a test.
// Java: a table to remove a name from. SlotSide: the side of a defense slot. DefenseSlots: the 10 slots a click is looked for in.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cropa.model.defense.Bramble;
import com.cropa.model.defense.DefenseConfig;
import com.cropa.model.defense.DefenseSlots;
import com.cropa.model.defense.SlotSide;
import com.cropa.model.world.Board;
import com.cropa.model.world.Cell;
import java.util.Map;
import org.junit.jupiter.api.Test;

// No extends: JUnit finds the tests through @Test. No libGDX here: the layout only receives plain tables.
/**
 * Tests BoardLayout on the places of the real map.
 */
class BoardLayoutTest {

    //-------------------- BOUNDS AND SPOTS --------------------
    // Run by JUnit because of @Test, like every test below.
    // Row 2, column 2 is at x = 176, y = 160: assertEquals compares the values of the two records.
    // Without this test, swapping the row and the column would only show up on the screen.
    @Test
    void cellBoundsMatchTheMapObject() {
        Bounds expected = new Bounds(176, 160, TestLayouts.TILE_SIZE, TestLayouts.TILE_SIZE);
        assertEquals(expected, TestLayouts.layout().getCellBounds(2, 2));
    }

    // One slot per side, at both ends of the field: top1 and bottom5.
    // Without this test, getSlotBounds could give the other side's slot and nothing would fail.
    @Test
    void slotBoundsMatchTheMapObject() {
        BoardLayout layout = TestLayouts.layout();
        assertEquals(new Bounds(160, 192, TestLayouts.TILE_SIZE, TestLayouts.TILE_SIZE), layout.getSlotBounds(SlotSide.TOP, 1));
        assertEquals(new Bounds(224, 128, TestLayouts.TILE_SIZE, TestLayouts.TILE_SIZE), layout.getSlotBounds(SlotSide.BOTTOM, 5));
    }

    // A spot has no size, so the expected value is a Point and not a rectangle.
    // Without this test, nothing would check the spots.
    @Test
    void spotPositionMatchesTheMapObject() {
        assertEquals(new Point(136, 160), TestLayouts.layout().getSpot("farmer"));
    }

    // Without this test, a typo on a spot name could reach the screen as a null.
    @Test
    void unknownSpotFails() {
        Exception error = assertThrows(IllegalArgumentException.class, () -> TestLayouts.layout().getSpot("barn"));
        assertTrue(error.getMessage().contains("barn"));
    }

    //-------------------- MISSING NAME --------------------
    // Removes one name, then builds the layout: assertThrows runs the lambda and gives the exception back.
    // Without the check on the message, an exception naming another object would pass too.
    @Test
    void missingCellNameFails() {
        Map<String, Bounds> cells = TestLayouts.cells();
        cells.remove("r2c3");
        Exception error = assertThrows(IllegalArgumentException.class,
                () -> new BoardLayout(cells, TestLayouts.slots(), TestLayouts.spots()));
        assertTrue(error.getMessage().contains("r2c3"));
    }

    //-------------------- MODEL TO SCREEN --------------------
    // 10 cells left is where enemies spawn: x = 160 + (10 - 3) * 16 = 272, y = middle of row 2.
    // Without this test, enemies could spawn in the wrong place and nothing would fail.
    @Test
    void toScreenAtTenIsTheSpawnPoint() {
        assertEquals(new Point(272, 168), TestLayouts.layout().toScreen(2, 10));
    }

    // 0 cells left is in front of the farm: x = 160 + (0 - 3) * 16 = 112, on the left of the field.
    // Together with the test above, it checks both ends of the enemies' path.
    @Test
    void toScreenAtZeroIsInFrontOfTheFarm() {
        assertEquals(new Point(112, 168), TestLayouts.layout().toScreen(2, 0));
    }

    // Rows 0 and 4 have no cells, only slots: their middles are y = 200 and y = 136.
    // Without this test, the code of these two rows would run for the first time in the game.
    @Test
    void toScreenReachesTheFleeRows() {
        BoardLayout layout = TestLayouts.layout();
        assertEquals(new Point(272, 200), layout.toScreen(0, 10));
        assertEquals(new Point(272, 136), layout.toScreen(4, 10));
    }

    //-------------------- SCREEN TO MODEL --------------------
    // (200, 200) is inside top3 (x 192 to 208, y 192 to 208). assertSame: the very slot of the game, not a copy,
    // because the shop will place or upgrade the defense on it.
    // Without this test, a click could open the shop of the wrong slot.
    @Test
    void findSlotGivesTheClickedTopSlot() {
        DefenseSlots slots = new DefenseSlots();
        assertSame(slots.getSlot(SlotSide.TOP, 3), TestLayouts.layout().findSlot(200, 200, slots).orElseThrow());
    }

    // (230, 130) is inside bottom5 (x 224 to 240, y 128 to 144): the search also goes through the bottom side.
    @Test
    void findSlotGivesTheClickedBottomSlot() {
        DefenseSlots slots = new DefenseSlots();
        assertSame(slots.getSlot(SlotSide.BOTTOM, 5), TestLayouts.layout().findSlot(230, 130, slots).orElseThrow());
    }

    // x = 208 is the right edge of top3 and the left edge of top4: the click belongs to top4 only.
    // Without this test, a click on the line between two slots could pick the wrong one.
    @Test
    void findSlotGivesTheBorderToTheNextSlot() {
        DefenseSlots slots = new DefenseSlots();
        assertSame(slots.getSlot(SlotSide.TOP, 4), TestLayouts.layout().findSlot(208, 200, slots).orElseThrow());
    }

    // Expected by the sheet of the day: a click outside the slots gives an empty Optional.
    // (200, 170) is a field cell (row 2), (10, 10) is far from the field.
    @Test
    void findSlotIsEmptyOutsideTheSlots() {
        DefenseSlots slots = new DefenseSlots();
        BoardLayout layout = TestLayouts.layout();
        assertTrue(layout.findSlot(200, 170, slots).isEmpty());
        assertTrue(layout.findSlot(10, 10, slots).isEmpty());
    }

    // (200, 170) is inside r2c3 (x 192 to 208, y 160 to 176). assertSame: the very cell of the board, where the
    // defense stands, because DefenseSlots finds a defense by its cell.
    @Test
    void findCellGivesTheClickedCell() {
        Board board = new Board();
        assertSame(board.getCell(2, 3), TestLayouts.layout().findCell(200, 170, board).orElseThrow());
    }

    // Expected by the sheet of the day: a click outside the field gives an empty Optional.
    // (200, 200) is the slot top3, above the field; (10, 10) is far from it.
    @Test
    void findCellIsEmptyOutsideTheField() {
        Board board = new Board();
        BoardLayout layout = TestLayouts.layout();
        assertTrue(layout.findCell(200, 200, board).isEmpty());
        assertTrue(layout.findCell(10, 10, board).isEmpty());
    }

    // The chain of GameScreen after the slots: the clicked cell, then the defense DefenseSlots keeps on it.
    @Test
    void aClickOnAFieldDefenseFindsIt() {
        Board board = new Board();
        DefenseSlots slots = new DefenseSlots();
        Cell cell = board.getCell(2, 3);
        Bramble bramble = new Bramble(cell, new DefenseConfig());
        slots.placeOnField(cell, bramble);

        assertSame(bramble, TestLayouts.layout().findCell(200, 170, board).flatMap(slots::getDefenseOn).orElseThrow());
    }
}
