package com.cropa.model.world;

// Optional: an empty cell gives Optional.empty(), never null.
import java.util.Optional;

// What the view may know about the field: the sprite of each cell, nothing more.
// The view gets this type instead of Board, so it can read the field but never plant or remove.
// One method only: a test writes a FieldView as a lambda, (row, column) -> ...
/**
 * A read-only view of the field: the sprite key of what stands on each cell.
 */
public interface FieldView {

  // Called by WorldRenderer for each of the 15 cells, at each frame.
  /**
   * Returns the sprite key of what occupies the cell, for example {@code "carrot_0"}.
   *
   * @param row    the row, from 1 to 3
   * @param column the column, from 1 to 5
   * @return the sprite key, or an empty {@code Optional} if the cell is empty
   */
  Optional<String> spriteAt(int row, int column);
}