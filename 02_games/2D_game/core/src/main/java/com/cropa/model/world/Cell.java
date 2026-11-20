package com.cropa.model.world;

// Optional: lets getOccupant() say "nothing here" without ever returning null.
import java.util.Optional;

// A Cell only knows the Occupant interface, so it accepts a crop, a scarecrow or a bramble.
/**
 * One cell of the field: its row, its column and at most one {@link Occupant}.
 */
public class Cell {

  // -------------------- FIELDS --------------------
  // row and column are set once at creation and never change, so they are final.
  // occupant changes over time; null is used only inside the class to mean "empty".
  private final int row;
  private final int column;
  private Occupant occupant;

  // -------------------- CONSTRUCTOR --------------------
  // Called by Board when it builds the field. The new cell starts empty.
  /**
   * Creates an empty cell.
   *
   * @param row    the row of the cell on the field
   * @param column the column of the cell on the field
   */
  public Cell(int row, int column) {
    this.row = row;
    this.column = column;
  }

  // -------------------- ACCESSORS --------------------
  // Used to find a cell's position, for example to draw it or to match a click.
  /**
   * Returns the row of this cell.
   *
   * @return the row
   */
  public int getRow() {
    return row;
  }

  // Same as getRow, for the column.
  /**
   * Returns the column of this cell.
   *
   * @return the column
   */
  public int getColumn() {
    return column;
  }

  // Optional.ofNullable turns the internal null into Optional.empty(): callers never see null.
  /**
   * Returns what occupies this cell.
   *
   * @return the occupant, or an empty {@code Optional} if the cell is empty
   */
  public Optional<Occupant> getOccupant() {
    return Optional.ofNullable(occupant);
  }

  // Shortcut for callers who only need to know if the cell is free.
  /**
   * Tells whether this cell has no occupant.
   *
   * @return {@code true} if the cell is empty
   */
  public boolean isEmpty() {
    return occupant == null;
  }

  // -------------------- ACTIONS --------------------
  // Called when the player plants or builds on this cell.
  // Early return when occupied: nothing is placed, and the caller must not charge
  // the player.
  /**
   * Places an occupant on this cell if it is empty.
   *
   * @param newOccupant the occupant to place
   * @return {@code true} if it was placed, {@code false} if the cell was already
   *         occupied
   */
  public boolean place(Occupant newOccupant) {
    if (!isEmpty()) {
      return false;
    }
    occupant = newOccupant;
    return true;
  }

  // Called on harvest, when a mole eats a crop or when a defense is destroyed.
  // Without it, a cell would stay occupied forever.
  /**
   * Frees this cell by removing its occupant, if any.
   */
  public void remove() {
    occupant = null;
  }

  // Called by an enemy (Yohan) when it walks over this cell. The cell does not decide:
  // it tells its occupant, and frees itself only if the occupant says it leaves.
  /**
   * Lets an enemy cross this cell. The occupant reacts, and the cell is freed if
   * it leaves. Does nothing on an empty cell.
   *
   * @param crosser what crosses the cell
   */
  public void crossBy(Damageable crosser) {
    if (occupant != null && occupant.onCrossedBy(crosser)) {
      remove();
    }
  }
}
