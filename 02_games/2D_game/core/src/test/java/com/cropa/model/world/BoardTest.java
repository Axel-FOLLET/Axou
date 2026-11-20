package com.cropa.model.world;

// JUnit: assertion helpers and the @Test marker.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/**
 * Tests for {@link Board}.
 */
class BoardTest {

  // -------------------- HELPERS --------------------
  // A minimal defense (like a scarecrow or a bramble) to check that getCrops ignores it.
  /** An occupant that is a defense, used only to fill a cell. */
  private static class DummyDefense implements Occupant {
    @Override
    public boolean onCrossedBy(Damageable crosser) {
      return false;
    }

    @Override
    public boolean onBittenByMole() {
      return false;
    }

    @Override
    public String spriteKey() {
      return "dummy_defense";
    }
  }

  // -------------------- TESTS --------------------
  // Rows go from 1 to 3 and columns from 1 to 5: every pair must give a cell.
  /** The board has 15 cells, from (1, 1) to (3, 5). */
  @Test
  void boardHasFifteenCells() {
    Board board = new Board();
    int count = 0;

    for (int row = 1; row <= 3; row++) {
      for (int column = 1; column <= 5; column++) {
        assertNotNull(board.getCell(row, column));
        count++;
      }
    }

    assertEquals(15, count);
  }

  // Checks that the row/column offset (1-based numbers, 0-based array) is right,
  // corners included.
  /** getCell returns a cell that knows the row and column it was asked for. */
  @Test
  void getCellReturnsTheRightRowAndColumn() {
    Board board = new Board();

    assertEquals(2, board.getCell(2, 4).getRow());
    assertEquals(4, board.getCell(2, 4).getColumn());
    assertEquals(1, board.getCell(1, 1).getRow());
    assertEquals(1, board.getCell(1, 1).getColumn());
    assertEquals(3, board.getCell(3, 5).getRow());
    assertEquals(5, board.getCell(3, 5).getColumn());
  }

  // assertSame checks identity: a placed occupant must still be there at the next
  // call.
  /** The same numbers always give the same cell. */
  @Test
  void getCellReturnsTheSameCellForTheSameNumbers() {
    Board board = new Board();

    assertSame(board.getCell(2, 3), board.getCell(2, 3));
  }

  // Outside the field is a programming error: it fails right away with IllegalArgumentException.
  /** A row below 1 is refused. */
  @Test
  void getCellWithRowZeroThrows() {
    Board board = new Board();

    assertThrows(IllegalArgumentException.class, () -> board.getCell(0, 1));
  }

  /** A row above 3 is refused. */
  @Test
  void getCellWithRowFourThrows() {
    Board board = new Board();

    assertThrows(IllegalArgumentException.class, () -> board.getCell(4, 1));
  }

  /** A column below 1 is refused. */
  @Test
  void getCellWithColumnZeroThrows() {
    Board board = new Board();

    assertThrows(IllegalArgumentException.class, () -> board.getCell(1, 0));
  }

  /** A column above 5 is refused. */
  @Test
  void getCellWithColumnSixThrows() {
    Board board = new Board();

    assertThrows(IllegalArgumentException.class, () -> board.getCell(1, 6));
  }

  // An empty list, never null: the game can loop over it without a check.
  /** A new board has no crops. */
  @Test
  void getCropsIsEmptyOnANewBoard() {
    Board board = new Board();

    assertTrue(board.getCrops().isEmpty());
  }

  // Two crops on two different cells: both must be returned.
  /** getCrops returns every crop planted on the field. */
  @Test
  void getCropsReturnsThePlantedCrops() {
    Board board = new Board();
    CropConfig config = new CropConfig();
    Crop carrot = new Crop(CropType.CARROT, config);
    Crop pumpkin = new Crop(CropType.PUMPKIN, config);
    board.getCell(1, 1).place(carrot);
    board.getCell(3, 5).place(pumpkin);

    List<Crop> crops = board.getCrops();

    assertEquals(2, crops.size());
    assertTrue(crops.contains(carrot));
    assertTrue(crops.contains(pumpkin));
  }

  // The defense is on the field but is not a crop: only the carrot must come back.
  /** getCrops ignores defenses. */
  @Test
  void getCropsIgnoresDefenses() {
    Board board = new Board();
    Crop carrot = new Crop(CropType.CARROT, new CropConfig());
    board.getCell(2, 2).place(carrot);
    board.getCell(2, 3).place(new DummyDefense());

    assertEquals(List.of(carrot), board.getCrops());
  }

  // The view reads the field through FieldView: a carrot at stage 0 gives its key, nothing more.
  /** spriteAt gives the sprite key of the occupant. */
  @Test
  void spriteAtGivesTheKeyOfTheCrop() {
    Board board = new Board();
    board.getCell(1, 1).place(new Crop(CropType.CARROT, new CropConfig()));

    assertEquals(Optional.of("carrot_0"), board.spriteAt(1, 1));
  }

  // An empty cell gives Optional.empty(), never null: the renderer draws nothing there.
  /** spriteAt is empty on an empty cell. */
  @Test
  void spriteAtIsEmptyOnAnEmptyCell() {
    Board board = new Board();

    assertEquals(Optional.empty(), board.spriteAt(2, 3));
  }

  // -------------------- SIZE AND CELLS --------------------
  // The size of the field is public: the enemies and the view read it instead of keeping their own copy.
  /** The field has 3 rows and 5 columns. */
  @Test
  void sizeIsThreeRowsByFiveColumns() {
    assertEquals(3, Board.ROWS);
    assertEquals(5, Board.COLUMNS);
  }

  // Row by row: r1c1 to r1c5, then r2c1... assertSame: the very cells of the board, not copies.
  /** getCells gives the 15 cells row by row, from r1c1 to r3c5. */
  @Test
  void getCellsGivesTheFifteenCellsRowByRow() {
    Board board = new Board();

    List<Cell> cells = board.getCells();

    assertEquals(15, cells.size());
    assertSame(board.getCell(1, 1), cells.get(0));
    assertSame(board.getCell(2, 1), cells.get(5));
    assertSame(board.getCell(3, 5), cells.get(14));
  }

  // Read-only: the caller can read the cells and change what is on them, but not add or remove a cell.
  /** The list of the cells cannot be changed. */
  @Test
  void getCellsIsReadOnly() {
    Board board = new Board();

    assertThrows(UnsupportedOperationException.class, () -> board.getCells().add(board.getCell(1, 1)));
  }
}
