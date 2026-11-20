package com.cropa.model.world;

// JUnit: assertion helpers and the @Test marker. Optional: what Cell.getOccupant() returns.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Optional;
import java.util.OptionalInt;
import org.junit.jupiter.api.Test;

/**
 * Tests for {@link Cell}.
 */
class CellTest {

  // -------------------- HELPERS --------------------
  // Minimal Occupant so Cell can be tested without Crop. It says whether it leaves when crossed.
  /** An occupant with no behavior, used only to fill a cell. */
  private static class DummyOccupant implements Occupant {
    private final boolean leavesWhenCrossed;

    DummyOccupant() {
      this(false);
    }

    DummyOccupant(boolean leavesWhenCrossed) {
      this.leavesWhenCrossed = leavesWhenCrossed;
    }

    @Override
    public boolean onCrossedBy(Damageable crosser) {
      return leavesWhenCrossed;
    }

    @Override
    public boolean onBittenByMole() {
      return false;
    }

    @Override
    public String spriteKey() {
      return "dummy";
    }
  }

  // Something that crosses the cell, like a witch. Damageable has two methods: no lambda, a small class.
  /** A crosser with no behavior. */
  private static class DummyCrosser implements Damageable {
    @Override
    public void takeDamage(int amount) {
    }

    @Override
    public int getHealth() {
      return 20;
    }
  }

  // -------------------- TESTS --------------------
  // A cell that was never filled has no occupant: Optional.empty(), never null.
  /** A new cell is empty. */
  @Test
  void newCellIsEmpty() {
    Cell cell = new Cell(1, 1);

    assertTrue(cell.isEmpty());
    assertTrue(cell.getOccupant().isEmpty());
  }

  // place on an empty cell returns true and the occupant can be read back.
  /** Placing an occupant on an empty cell succeeds. */
  @Test
  void placeOnEmptyCellSucceeds() {
    Cell cell = new Cell(1, 1);
    Occupant occupant = new DummyOccupant();

    assertTrue(cell.place(occupant));
    assertEquals(Optional.of(occupant), cell.getOccupant());
  }

  // Two distinct occupants: if the second replaced the first, the last assertion would fail.
  /** Placing on an occupied cell returns false and keeps the first occupant. */
  @Test
  void placeOnOccupiedCellFails() {
    Cell cell = new Cell(1, 1);
    Occupant first = new DummyOccupant();
    Occupant second = new DummyOccupant();
    cell.place(first);

    assertFalse(cell.place(second));
    assertEquals(Optional.of(first), cell.getOccupant());
  }

  // remove is what a harvest or an eaten crop calls: the cell can be used again.
  /** Removing the occupant frees the cell. */
  @Test
  void removeFreesTheCell() {
    Cell cell = new Cell(1, 1);
    cell.place(new DummyOccupant());

    cell.remove();

    assertTrue(cell.isEmpty());
  }

  // Row and column come from the constructor and never change.
  /** A cell keeps the row and column it was created with. */
  @Test
  void cellKeepsItsRowAndColumn() {
    Cell cell = new Cell(2, 4);

    assertEquals(2, cell.getRow());
    assertEquals(4, cell.getColumn());
  }

  // The occupant decides: Cell only empties itself when the occupant says it leaves.
  /** An occupant that leaves when crossed frees the cell. */
  @Test
  void crossingAnOccupantThatLeavesEmptiesTheCell() {
    Cell cell = new Cell(1, 1);
    cell.place(new DummyOccupant(true));

    cell.crossBy(new DummyCrosser());

    assertTrue(cell.isEmpty());
  }

  // A bramble stays on its cell when a witch crosses it.
  /** An occupant that stays when crossed keeps the cell. */
  @Test
  void crossingAnOccupantThatStaysKeepsIt() {
    Cell cell = new Cell(1, 1);
    DummyOccupant occupant = new DummyOccupant(false);
    cell.place(occupant);

    cell.crossBy(new DummyCrosser());

    assertEquals(Optional.of(occupant), cell.getOccupant());
  }

  // Without this test, crossing an empty cell could throw.
  /** Crossing an empty cell does nothing. */
  @Test
  void crossingAnEmptyCellDoesNothing() {
    Cell cell = new Cell(1, 1);

    cell.crossBy(new DummyCrosser());

    assertTrue(cell.isEmpty());
  }

  // The expected result of the day: a witch crushes a carrot, which leaves its cell.
  /** A crossed carrot leaves its cell. */
  @Test
  void crossedCarrotLeavesItsCell() {
    Cell cell = new Cell(1, 1);
    cell.place(new Crop(CropType.CARROT, new CropConfig()));

    cell.crossBy(new DummyCrosser());

    assertTrue(cell.isEmpty());
  }

  // DummyOccupant does not override the default methods: it cannot be sold and stops nobody.
  /** By default, an occupant brings no money when harvested and blocks no enemy. */
  @Test
  void occupantDefaultsAreNoHarvestAndNoBlock() {
    Occupant occupant = new DummyOccupant();

    assertEquals(OptionalInt.empty(), occupant.onHarvested());
    assertFalse(occupant.blocks(CropType.CARROT));
  }
}
