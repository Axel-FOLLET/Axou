package com.cropa.model.enemy;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cropa.model.world.Board;
import com.cropa.model.world.Crop;
import com.cropa.model.world.CropConfig;
import com.cropa.model.world.CropType;
import com.cropa.model.world.DefenseLine;
import com.cropa.model.world.Farm;
import java.util.Random;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

// A lane enemy asks its MoveStrategy for its row before entering each column: the witch avoids the turnip,
// the bat the garlic. The cell is then entered on the new row.
class LaneEnemyDeviationTest {

  // A defense line that does nothing: these tests are not about the wear (see LaneEnemyWearTest).
  private static final DefenseLine NO_WEAR = (row, column, percent) -> { };

  private final EnemyConfig config = new EnemyConfig();
  private final CropConfig cropConfig = new CropConfig();

  // Column 5 is entered at 8 cells left: 2 cells after the entry. The times come from the speeds of the config
  // (about 6.7 s for the witch, 5.7 s for the bat since the rebalance of day 9), plus a little margin.
  private final float witchPastColumnFive = 2f / config.getSpeed(EnemyType.WITCH) + 0.2f;
  private final float batPastColumnFive = 2f / config.getSpeed(EnemyType.BAT) + 0.3f;

  private Board board;
  private Farm farm;

  @BeforeEach
  void createAnEmptyBoard() {
    board = new Board();
    farm = new Farm(config.getFarmHealth());
  }

  private void plant(CropType type, int row, int column) {
    board.getCell(row, column).place(new Crop(type, cropConfig));
  }

  // The landmark of the day sheet: a witch of row 1, a turnip in r1c5, a carrot in r2c5.
  @Test
  void witchTurnsAsideFromATurnipAndCrushesTheCarrotOnHerNewRow() {
    plant(CropType.TURNIP, 1, 5);
    plant(CropType.CARROT, 2, 5);
    Witch witch = new Witch(1, farm, board, config, NO_WEAR, new Random(1));

    witch.update(witchPastColumnFive);

    assertEquals(2, witch.getRow());
    assertFalse(board.getCell(1, 5).isEmpty());
    assertTrue(board.getCell(2, 5).isEmpty());
  }

  @Test
  void batDoesNotTurnAsideFromATurnip() {
    plant(CropType.TURNIP, 2, 5);
    Bat bat = new Bat(2, farm, board, config, NO_WEAR, new Random(1));

    bat.update(batPastColumnFive);

    assertEquals(2, bat.getRow());
  }

  @Test
  void batTurnsAsideFromGarlic() {
    plant(CropType.GARLIC, 1, 5);
    Bat bat = new Bat(1, farm, board, config, NO_WEAR, new Random(1));

    bat.update(batPastColumnFive);

    assertEquals(2, bat.getRow());
  }

  // The team's example: garlic on rows 1 and 2, none on row 3: the bat of row 1 goes to row 3.
  @Test
  void batJumpsToTheOnlyFreeRowOfTheColumn() {
    plant(CropType.GARLIC, 1, 5);
    plant(CropType.GARLIC, 2, 5);
    Bat bat = new Bat(1, farm, board, config, NO_WEAR, new Random(1));

    bat.update(batPastColumnFive);

    assertEquals(3, bat.getRow());
  }

  // On her new row, the witch keeps checking: a turnip further on row 2 sends her aside again.
  @Test
  void witchChecksEveryColumnOnHerCurrentRow() {
    plant(CropType.TURNIP, 1, 5);
    plant(CropType.TURNIP, 2, 3);
    Witch witch = new Witch(1, farm, board, config, NO_WEAR, new Random(1));

    witch.update(30f);

    assertTrue(witch.getRow() == 1 || witch.getRow() == 3);
    assertFalse(board.getCell(2, 3).isEmpty());
  }

  // Without a board, nothing ever blocks: the old constructor still walks its row.
  @Test
  void enemyBuiltWithoutABoardKeepsItsRow() {
    Witch witch = new Witch(2, farm, config);

    witch.update(30f);

    assertEquals(2, witch.getRow());
  }
}
