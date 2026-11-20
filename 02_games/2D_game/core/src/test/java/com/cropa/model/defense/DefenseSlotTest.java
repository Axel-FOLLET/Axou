package com.cropa.model.defense;

// JUnit: the checks the tests use, and the annotation that marks a test.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import org.junit.jupiter.api.Test;

// No extends: JUnit finds the tests through @Test.
/** Tests for {@link DefenseSlot}. */
class DefenseSlotTest {

    //-------------------- HELPERS --------------------
    private Defense newDefense() {
        return new Catapatate(new DefenseSlot(SlotSide.TOP, 1), new DefenseConfig(), new ArrayList<>());
    }

    //-------------------- TESTS --------------------
    // A new slot knows its place and holds nothing.
    @Test
    void startsEmptyAtItsPlace() {
        DefenseSlot slot = new DefenseSlot(SlotSide.BOTTOM, 4);

        assertEquals(SlotSide.BOTTOM, slot.getSide());
        assertEquals(4, slot.getColumn());
        assertTrue(slot.isEmpty());
        assertTrue(slot.getDefense().isEmpty());
    }

    // The slots line up with the 5 columns of the field.
    @Test
    void columnOutsideTheFieldThrows() {
        assertThrows(IllegalArgumentException.class, () -> new DefenseSlot(SlotSide.TOP, 0));
        assertThrows(IllegalArgumentException.class, () -> new DefenseSlot(SlotSide.TOP, 6));
    }

    // Placing a defense makes it readable.
    @Test
    void placeHoldsTheDefense() {
        DefenseSlot slot = new DefenseSlot(SlotSide.TOP, 2);
        Defense defense = newDefense();

        assertTrue(slot.place(defense));

        assertFalse(slot.isEmpty());
        assertSame(defense, slot.getDefense().orElseThrow());
    }

    // Without this test, a second purchase would replace the first defense and the player would pay twice.
    @Test
    void occupiedSlotRefusesASecondDefense() {
        DefenseSlot slot = new DefenseSlot(SlotSide.TOP, 2);
        Defense first = newDefense();
        slot.place(first);

        assertFalse(slot.place(newDefense()));
        assertSame(first, slot.getDefense().orElseThrow());
    }

    // A destroyed defense leaves its slot free again.
    @Test
    void removeFreesTheSlot() {
        DefenseSlot slot = new DefenseSlot(SlotSide.TOP, 2);
        slot.place(newDefense());

        slot.remove();

        assertTrue(slot.isEmpty());
    }
}
