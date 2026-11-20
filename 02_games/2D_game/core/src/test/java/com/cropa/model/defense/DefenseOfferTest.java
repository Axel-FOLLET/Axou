package com.cropa.model.defense;

// JUnit: the checks the tests use, and the annotation that marks a test. Cell: a cell of the field.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cropa.model.world.Cell;
import java.util.ArrayList;
import org.junit.jupiter.api.Test;

// No extends: JUnit finds the tests through @Test. Each test uses its own slots and cell.
/** Tests for {@link DefenseOffer}. */
class DefenseOfferTest {

    //-------------------- FIELDS --------------------
    private final DefenseConfig config = new DefenseConfig();
    private final DefenseSlots slots = new DefenseSlots();
    private final DefenseSlot slot = slots.getSlot(SlotSide.TOP, 1);
    private final Cell cell = new Cell(2, 3);

    //-------------------- HELPERS --------------------
    private DefenseOffer offerOf(DefenseType type) {
        return new DefenseOffer(type, config, new ArrayList<>(), slots);
    }

    //-------------------- THE OFFER --------------------
    // The prices of the rules (section 10), and where each defense goes.
    @Test
    void knowsItsPriceAndWhereItGoes() {
        assertEquals(150, offerOf(DefenseType.CATAPATATE).getPrice());
        assertEquals(120, offerOf(DefenseType.SCARECROW).getPrice());
        assertEquals(40, offerOf(DefenseType.BRAMBLE).getPrice());
        assertFalse(offerOf(DefenseType.CATAPATATE).isPlacedOnField());
        assertTrue(offerOf(DefenseType.SCARECROW).isPlacedOnField());
        assertTrue(offerOf(DefenseType.BRAMBLE).isPlacedOnField());
        assertEquals(DefenseType.BRAMBLE, offerOf(DefenseType.BRAMBLE).getType());
    }

    //-------------------- ON A SLOT --------------------
    @Test
    void aCatapatateGoesOnAFreeSlot() {
        assertTrue(offerOf(DefenseType.CATAPATATE).placeOn(slot));

        assertInstanceOf(Catapatate.class, slot.getDefense().orElseThrow());
    }

    // The slot refuses a second defense: nothing is placed, the shop will not charge.
    @Test
    void aTakenSlotRefuses() {
        offerOf(DefenseType.CATAPATATE).placeOn(slot);

        assertFalse(offerOf(DefenseType.CATAPATATE).placeOn(slot));
    }

    @Test
    void aDefenseOfTheFieldDoesNotGoOnASlot() {
        assertFalse(offerOf(DefenseType.SCARECROW).placeOn(slot));
        assertFalse(offerOf(DefenseType.BRAMBLE).placeOn(slot));

        assertTrue(slot.isEmpty());
    }

    //-------------------- ON A CELL --------------------
    @Test
    void aCatapatateDoesNotGoOnACell() {
        assertFalse(offerOf(DefenseType.CATAPATATE).placeOn(cell));

        assertTrue(cell.isEmpty());
    }

    // The scarecrow goes in the cell, and DefenseSlots keeps it for the game.
    @Test
    void aScarecrowGoesOnACell() {
        assertTrue(offerOf(DefenseType.SCARECROW).placeOn(cell));

        assertInstanceOf(Scarecrow.class, cell.getOccupant().orElseThrow());
        assertInstanceOf(Scarecrow.class, slots.getDefenseOn(cell).orElseThrow());
    }

    @Test
    void aBrambleGoesOnACell() {
        assertTrue(offerOf(DefenseType.BRAMBLE).placeOn(cell));

        assertInstanceOf(Bramble.class, slots.getDefenseOn(cell).orElseThrow());
    }

    @Test
    void aTakenCellRefuses() {
        offerOf(DefenseType.BRAMBLE).placeOn(cell);

        assertFalse(offerOf(DefenseType.SCARECROW).placeOn(cell));

        assertInstanceOf(Bramble.class, cell.getOccupant().orElseThrow());
    }
}
