package com.cropa.model.enemy;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.cropa.model.world.Board;
import com.cropa.model.world.Crop;
import com.cropa.model.world.CropConfig;
import com.cropa.model.world.CropType;
import java.util.Random;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

// The team's rule: in front of a blocking crop, the enemy goes to the nearest free row of the same column
// (a free row is a cell that does not block it), at random if two are as near. It flees only when the 3 rows
// of the column block it: row 1 by row 0, row 3 by row 4, row 2 by row 0 or 4 at random.
class DeviateStrategyTest {

  // A Random whose coin always falls on the same side: both outcomes of a draw are tested on purpose.
  private static Random coinAlways(boolean side) {
    return new Random() {
      @Override
      public boolean nextBoolean() {
        return side;
      }
    };
  }

  private static final int COLUMN = 5;

  private final CropConfig cropConfig = new CropConfig();
  private final DeviateStrategy turnipAvoider = new DeviateStrategy(CropType.TURNIP);

  private Board board;

  @BeforeEach
  void createAnEmptyBoard() {
    board = new Board();
  }

  private void plant(CropType type, int row) {
    board.getCell(row, COLUMN).place(new Crop(type, cropConfig));
  }

  private int nextRow(int row, Random random) {
    return turnipAvoider.nextRow(row, COLUMN, board, random);
  }

  // -------------------- NOT BLOCKED --------------------

  @Test
  void emptyCellKeepsTheRow() {
    assertEquals(2, nextRow(2, new Random(1)));
  }

  @Test
  void aCropOfAnotherTypeDoesNotBlock() {
    plant(CropType.CARROT, 2);

    assertEquals(2, nextRow(2, new Random(1)));
  }

  // -------------------- TURNING ASIDE --------------------

  @Test
  void fromRowOneTheNearestFreeRowIsRowTwo() {
    plant(CropType.TURNIP, 1);

    assertEquals(2, nextRow(1, new Random(1)));
  }

  @Test
  void fromRowThreeTheNearestFreeRowIsRowTwo() {
    plant(CropType.TURNIP, 3);

    assertEquals(2, nextRow(3, new Random(1)));
  }

  // The team's example: blocked on rows 1 and 2, free on row 3: from row 1, it goes to row 3.
  @Test
  void fromRowOneItJumpsToRowThreeWhenRowTwoIsBlocked() {
    plant(CropType.TURNIP, 1);
    plant(CropType.TURNIP, 2);

    assertEquals(3, nextRow(1, new Random(1)));
  }

  @Test
  void fromRowThreeItJumpsToRowOneWhenRowTwoIsBlocked() {
    plant(CropType.TURNIP, 3);
    plant(CropType.TURNIP, 2);

    assertEquals(1, nextRow(3, new Random(1)));
  }

  @Test
  void fromRowTwoItTakesTheOnlyFreeNeighbour() {
    plant(CropType.TURNIP, 2);
    plant(CropType.TURNIP, 1);

    assertEquals(3, nextRow(2, new Random(1)));
  }

  // Rows 1 and 3 are as near to row 2: a coin decides.
  @Test
  void fromRowTwoBothNeighboursFreeTheCoinDecides() {
    plant(CropType.TURNIP, 2);

    assertEquals(1, nextRow(2, coinAlways(true)));
    assertEquals(3, nextRow(2, coinAlways(false)));
  }

  // A carrot on the free row does not stop the witch: she goes there (and will crush it).
  @Test
  void aRowWithACropOfAnotherTypeIsFree() {
    plant(CropType.TURNIP, 1);
    plant(CropType.CARROT, 2);

    assertEquals(2, nextRow(1, new Random(1)));
  }

  // -------------------- FLEEING --------------------

  @Test
  void allRowsBlockedFromRowOneItFleesByRowZero() {
    plant(CropType.TURNIP, 1);
    plant(CropType.TURNIP, 2);
    plant(CropType.TURNIP, 3);

    assertEquals(0, nextRow(1, new Random(1)));
  }

  @Test
  void allRowsBlockedFromRowThreeItFleesByRowFour() {
    plant(CropType.TURNIP, 1);
    plant(CropType.TURNIP, 2);
    plant(CropType.TURNIP, 3);

    assertEquals(4, nextRow(3, new Random(1)));
  }

  // Rows 0 and 4 are as far from row 2: a coin decides.
  @Test
  void allRowsBlockedFromRowTwoTheCoinChoosesTheFleeRow() {
    plant(CropType.TURNIP, 1);
    plant(CropType.TURNIP, 2);
    plant(CropType.TURNIP, 3);

    assertEquals(0, nextRow(2, coinAlways(true)));
    assertEquals(4, nextRow(2, coinAlways(false)));
  }

  // -------------------- ONE STRATEGY, TWO ENEMIES --------------------

  // The same class serves the bat: only its parameter changes.
  @Test
  void aGarlicAvoiderIgnoresTurnipsButAvoidsGarlic() {
    DeviateStrategy garlicAvoider = new DeviateStrategy(CropType.GARLIC);

    plant(CropType.TURNIP, 2);
    assertEquals(2, garlicAvoider.nextRow(2, COLUMN, board, new Random(1)));

    plant(CropType.GARLIC, 1);
    assertEquals(2, garlicAvoider.nextRow(1, COLUMN, board, new Random(1)));
  }
}
