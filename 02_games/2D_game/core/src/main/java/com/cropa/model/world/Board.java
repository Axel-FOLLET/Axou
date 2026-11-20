package com.cropa.model.world;

// ArrayList and List: the constructor builds the list of the cells, getCrops a new list of the crops it finds.
// Optional: spriteAt gives "nothing here" without null.
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

// The field: 3 rows x 5 columns of Cell.
// Rows and columns are numbered from 1, like r1c1 to r3c5 on the map, even though the array below starts at 0.
/**
 * The field: 15 cells, 3 rows by 5 columns.
 * Rows go from 1 to 3 and columns from 1 to 5.
 */
public class Board implements FieldView {

  // -------------------- FIELDS --------------------
  // Number of rows and columns, named so no magic number appears in the logic.
  // Public: the enemies (Yohan) and the view (Axel) read them here instead of keeping their own copy.
  // cells holds the 15 cells; it is final because the grid never changes, only the cells' content.
  // cellList holds the same cells, row by row, read-only: built once, since the grid never changes.
  /** Number of rows of the field. */
  public static final int ROWS = 3;
  /** Number of columns of the field. */
  public static final int COLUMNS = 5;
  private final Cell[][] cells = new Cell[ROWS][COLUMNS];
  private final List<Cell> cellList;

  // -------------------- CONSTRUCTOR --------------------
  // Called once when a game starts.
  // Each cell knows its 1-based row and column; the array index is one less (cells[0][0] is r1c1).
  // The same cells go into a list, row by row; List.copyOf makes it read-only.
  /** Creates an empty field of 3 rows and 5 columns. */
  public Board() {
    List<Cell> list = new ArrayList<>();
    for (int row = 1; row <= ROWS; row++) {
      for (int column = 1; column <= COLUMNS; column++) {
        Cell cell = new Cell(row, column);
        cells[row - 1][column - 1] = cell;
        list.add(cell);
      }
    }
    cellList = List.copyOf(list);
  }

  // -------------------- ACCESSORS --------------------
  // Used by the game to plant, and by the screen to find the clicked cell.
  // Outside the field is a programming error, so it fails right away instead of returning null.
  /**
   * Returns the cell at the given row and column.
   * The same numbers always give the same cell.
   *
   * @param row    the row, from 1 to 3
   * @param column the column, from 1 to 5
   * @return the cell at this position
   * @throws IllegalArgumentException if the row is not in 1..3 or the column is
   *                                  not in 1..5
   */
  public Cell getCell(int row, int column) {
    if (row < 1 || row > ROWS || column < 1 || column > COLUMNS) {
      throw new IllegalArgumentException(
          "Cell outside the field: row " + row + ", column " + column
              + " (rows 1.." + ROWS + ", columns 1.." + COLUMNS + ")");
    }
    return cells[row - 1][column - 1];
  }

  // Used by the game and the view to walk the whole field without two loops of their own.
  // Read-only: a caller can change what sits on a cell, never add or remove a cell.
  /**
   * Returns the 15 cells of the field, row by row, from r1c1 to r3c5.
   *
   * @return a read-only list of the cells
   */
  public List<Cell> getCells() {
    return cellList;
  }

  // Called at each dawn: the game calls grow() on every crop returned here.
  // One walk of the field: getCells, instead of two loops of its own on the array.
  // instanceof Crop filters out defenses (scarecrow, bramble): they are Occupants but not crops.
  // It stays on purpose: a grow() in Occupant would make the bramble grow twice at dawn,
  // once here and once through Defense.onDawn.
  // A new list is built each time, so the caller cannot change the board through it.
  /**
   * Returns the crops planted on the field. Defenses are not included.
   *
   * @return a new list of the crops, empty if there are none
   */
  public List<Crop> getCrops() {
    List<Crop> crops = new ArrayList<>();
    for (Cell cell : getCells()) {
      cell.getOccupant().ifPresent(occupant -> {
        if (occupant instanceof Crop crop) {
          crops.add(crop);
        }
      });
    }
    return crops;
  }

  // -------------------- FIELD VIEW --------------------
  // Read by WorldRenderer at each frame, through FieldView: the view gets a key, never the cell.
  // map turns Optional<Occupant> into Optional<String>: an empty cell stays empty, without any if.
  /**
   * Returns the sprite key of what occupies the cell.
   *
   * @param row    the row, from 1 to 3
   * @param column the column, from 1 to 5
   * @return the sprite key, or an empty {@code Optional} if the cell is empty
   */
  @Override
  public Optional<String> spriteAt(int row, int column) {
    return getCell(row, column).getOccupant().map(Occupant::spriteKey);
  }
}
