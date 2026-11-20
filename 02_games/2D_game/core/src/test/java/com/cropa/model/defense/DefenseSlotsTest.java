package com.cropa.model.defense;

// JUnit: the checks the tests use, and the annotation that marks a test. Cell: a cell of the field, for the
// scarecrow and the bramble. DefenseLine: the type the wearAt tests hold DefenseSlots as, like LaneEnemy will.
// Crop, CropConfig, CropType: a carrot planted on the cell a defense left.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cropa.model.world.Cell;
import com.cropa.model.world.Crop;
import com.cropa.model.world.CropConfig;
import com.cropa.model.world.CropType;
import com.cropa.model.world.DefenseLine;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

// No extends: JUnit finds the tests through @Test.
/** Tests for {@link DefenseSlots}. */
class DefenseSlotsTest {

    //-------------------- FIELDS --------------------
    private final DefenseSlots slots = new DefenseSlots();

    //-------------------- HELPERS --------------------
    private Defense newDefense() {
        return new Catapatate(new DefenseSlot(SlotSide.TOP, 1), new DefenseConfig(), new ArrayList<>());
    }

    // A catapatate on the very slot of DefenseSlots: the one wearAt must find.
    private Defense placeCatapatate(SlotSide side, int column) {
        DefenseSlot slot = slots.getSlot(side, column);
        Defense catapatate = new Catapatate(slot, new DefenseConfig(), new ArrayList<>());
        slot.place(catapatate);
        return catapatate;
    }

    //-------------------- TESTS --------------------
    // Each of the 10 slots knows its own side and column.
    @Test
    void everySlotKnowsItsPlace() {
        for (SlotSide side : SlotSide.values()) {
            for (int column = 1; column <= 5; column++) {
                DefenseSlot slot = slots.getSlot(side, column);

                assertEquals(side, slot.getSide());
                assertEquals(column, slot.getColumn());
            }
        }
    }

    // The same values give the same slot: what is placed there stays there.
    @Test
    void sameValuesGiveTheSameSlot() {
        assertSame(slots.getSlot(SlotSide.TOP, 3), slots.getSlot(SlotSide.TOP, 3));
        assertNotSame(slots.getSlot(SlotSide.TOP, 3), slots.getSlot(SlotSide.BOTTOM, 3));
    }

    // Outside the columns is a programming error.
    @Test
    void columnOutsideTheFieldThrows() {
        assertThrows(IllegalArgumentException.class, () -> slots.getSlot(SlotSide.TOP, 0));
        assertThrows(IllegalArgumentException.class, () -> slots.getSlot(SlotSide.BOTTOM, 6));
    }

    // No defense yet: the game has nothing to update.
    @Test
    void noDefenseAtTheStart() {
        assertTrue(slots.getDefenses().isEmpty());
    }

    // The game updates what is placed, whatever the side.
    @Test
    void getDefensesGivesThePlacedDefenses() {
        Defense top = newDefense();
        Defense bottom = newDefense();
        slots.getSlot(SlotSide.TOP, 1).place(top);
        slots.getSlot(SlotSide.BOTTOM, 5).place(bottom);

        List<Defense> defenses = slots.getDefenses();

        assertEquals(2, defenses.size());
        assertTrue(defenses.contains(top));
        assertTrue(defenses.contains(bottom));
    }

    // Without this test, emptying the returned list could empty the slots.
    @Test
    void changingTheListDoesNotChangeTheSlots() {
        slots.getSlot(SlotSide.TOP, 1).place(newDefense());

        slots.getDefenses().clear();

        assertEquals(1, slots.getDefenses().size());
    }

    // The loop of the game: a catapatate destroyed during the loop leaves its slot, without stopping the loop.
    @Test
    void aDefenseCanLeaveItsSlotDuringTheLoop() {
        DefenseSlot left = slots.getSlot(SlotSide.TOP, 1);
        DefenseSlot right = slots.getSlot(SlotSide.TOP, 2);
        left.place(new Catapatate(left, new DefenseConfig(), new ArrayList<>()));
        right.place(new Catapatate(right, new DefenseConfig(), new ArrayList<>()));

        for (Defense defense : slots.getDefenses()) {
            defense.wear(100);
        }

        assertTrue(left.isEmpty());
        assertTrue(right.isEmpty());
    }

    //-------------------- THE FIELD --------------------
    // placeOnField puts the defense in the cell, and keeps it for the game and for the click.
    @Test
    void placeOnFieldKeepsTheDefenseOfTheCell() {
        Cell cell = new Cell(2, 3);
        Bramble bramble = new Bramble(cell, new DefenseConfig());

        assertTrue(slots.placeOnField(cell, bramble));

        assertSame(bramble, cell.getOccupant().orElseThrow());
        assertSame(bramble, slots.getDefenseOn(cell).orElseThrow());
        assertTrue(slots.getDefenses().contains(bramble));
    }

    // Like Cell.place: a taken cell refuses, and DefenseSlots keeps nothing.
    @Test
    void placeOnFieldRefusesATakenCell() {
        Cell cell = new Cell(2, 3);
        Bramble first = new Bramble(cell, new DefenseConfig());
        Bramble second = new Bramble(cell, new DefenseConfig());
        slots.placeOnField(cell, first);

        assertFalse(slots.placeOnField(cell, second));

        assertSame(first, slots.getDefenseOn(cell).orElseThrow());
        assertFalse(slots.getDefenses().contains(second));
    }

    // Expected by the sheet of the day: once the cell is freed (a witch, a harvest), the game no longer gets it.
    @Test
    void aFreedCellNoLongerGivesItsDefense() {
        Cell cell = new Cell(2, 3);
        Bramble bramble = new Bramble(cell, new DefenseConfig());
        slots.placeOnField(cell, bramble);

        cell.remove();

        assertFalse(slots.getDefenses().contains(bramble));
        assertTrue(slots.getDefenseOn(cell).isEmpty());
        assertTrue(slots.getFieldDefenses().isEmpty());
    }

    // The cell of a destroyed bramble takes a carrot: the cell is not empty, but it no longer holds that bramble.
    // DefenseSlots compares the very object (==), so it forgets the bramble instead of keeping it under the carrot.
    @Test
    void aCellTakenByACropNoLongerGivesItsDefense() {
        Cell cell = new Cell(2, 3);
        Bramble bramble = new Bramble(cell, new DefenseConfig());
        slots.placeOnField(cell, bramble);
        cell.remove();
        cell.place(new Crop(CropType.CARROT, new CropConfig()));

        assertTrue(slots.getDefenseOn(cell).isEmpty());
        assertFalse(slots.getDefenses().contains(bramble));
    }

    // Without this test, emptying the returned map could make the game forget the defenses of the field.
    @Test
    void changingTheFieldMapDoesNotChangeTheSlots() {
        Cell cell = new Cell(2, 3);
        slots.placeOnField(cell, new Bramble(cell, new DefenseConfig()));

        slots.getFieldDefenses().clear();

        assertEquals(1, slots.getFieldDefenses().size());
    }

    //-------------------- THE DEFENSE LINE --------------------
    // Expected by the sheet of the day: row 0 is the row of the TOP slots.
    // The test holds DefenseSlots as a DefenseLine, the way LaneEnemy will: it only sees wearAt.
    @Test
    void wearAtRowZeroWearsTheTopDefense() {
        Defense top = placeCatapatate(SlotSide.TOP, 3);
        DefenseLine line = slots;

        line.wearAt(0, 3, 20);

        assertEquals(80, top.getDurability());
    }

    // Row 4 is the row of the BOTTOM slots. Without this test, row 4 could wear the TOP defense of the column.
    @Test
    void wearAtRowFourWearsTheBottomDefense() {
        Defense top = placeCatapatate(SlotSide.TOP, 3);
        Defense bottom = placeCatapatate(SlotSide.BOTTOM, 3);
        DefenseLine line = slots;

        line.wearAt(4, 3, 20);

        assertEquals(80, bottom.getDurability());
        assertEquals(100, top.getDurability());
    }

    // Expected by the sheet of the day: rows 1 to 3 are the field, with no slot, so nothing is worn.
    @Test
    void wearAtAFieldRowDoesNothing() {
        Defense top = placeCatapatate(SlotSide.TOP, 3);
        Defense bottom = placeCatapatate(SlotSide.BOTTOM, 3);
        DefenseLine line = slots;

        line.wearAt(2, 3, 20);

        assertEquals(100, top.getDurability());
        assertEquals(100, bottom.getDurability());
    }
}
