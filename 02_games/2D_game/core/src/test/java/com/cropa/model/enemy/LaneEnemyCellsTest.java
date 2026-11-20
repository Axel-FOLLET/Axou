package com.cropa.model.enemy;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cropa.model.world.Board;
import com.cropa.model.world.Crop;
import com.cropa.model.world.CropConfig;
import com.cropa.model.world.CropType;
import com.cropa.model.world.Damageable;
import com.cropa.model.world.DefenseLine;
import com.cropa.model.world.Farm;
import com.cropa.model.world.Occupant;
import java.util.Random;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

// A lane enemy tells each cell of its row it enters (onEnterCell): the witch walks on them, the bat flies over.
// Column c is entered when the cells left to the farm reach c + 3: column 5 at 8, column 1 at 4.
class LaneEnemyCellsTest {

  // A defense line that does nothing: these tests are not about the wear (see LaneEnemyWearTest).
  private static final DefenseLine NO_WEAR = (row, column, percent) -> { };

  // The real bramble comes with the defenses: this fake one hurts whoever crosses it, and stays.
  private static class FakeBramble implements Occupant {
    private final int damage;

    FakeBramble(int damage) {
      this.damage = damage;
    }

    @Override
    public boolean onCrossedBy(Damageable crosser) {
      crosser.takeDamage(damage);
      return false;
    }

    @Override
    public boolean onBittenByMole() {
      return false;
    }

    @Override
    public String spriteKey() {
      return "bramble";
    }
  }

  private final EnemyConfig config = new EnemyConfig();
  private final CropConfig cropConfig = new CropConfig();

  // The witch walks 0.5 cell/s from 10 cells: column 3 is entered at 6 cells left, after (10 - 6) / 0.5 = 8 s.
  private final float timeToColumnThree =
      (config.getSpawnCellsToFarm() - 6) / config.getSpeed(EnemyType.WITCH);

  private Board board;
  private Farm farm;

  @BeforeEach
  void createAnEmptyBoard() {
    board = new Board();
    farm = new Farm(config.getFarmHealth());
  }

  private Crop carrot() {
    return new Crop(CropType.CARROT, cropConfig);
  }

  @Test
  void witchCrushesTheCarrotOnHerRowWhenSheReachesIt() {
    board.getCell(2, 3).place(carrot());
    Witch witch = new Witch(2, farm, board, config, NO_WEAR, new Random(1));

    witch.update(timeToColumnThree - 0.1f);

    assertFalse(board.getCell(2, 3).isEmpty());

    witch.update(0.2f);

    assertTrue(board.getCell(2, 3).isEmpty());
  }

  @Test
  void batDoesNotCrushTheCarrotItFliesOver() {
    board.getCell(2, 3).place(carrot());
    Bat bat = new Bat(2, farm, board, config, NO_WEAR, new Random(1));

    bat.update(30f);

    assertFalse(board.getCell(2, 3).isEmpty());
  }

  @Test
  void witchLeavesTheOtherRowsAlone() {
    board.getCell(1, 3).place(carrot());
    board.getCell(3, 3).place(carrot());
    Witch witch = new Witch(2, farm, board, config, NO_WEAR, new Random(1));

    witch.update(30f);

    assertFalse(board.getCell(1, 3).isEmpty());
    assertFalse(board.getCell(3, 3).isEmpty());
  }

  // A single long frame crosses the 5 columns: none is skipped.
  @Test
  void oneLongFrameCrossesEveryColumn() {
    for (int column = 1; column <= 5; column++) {
      board.getCell(2, column).place(carrot());
    }
    Witch witch = new Witch(2, farm, board, config, NO_WEAR, new Random(1));

    witch.update(30f);

    for (int column = 1; column <= 5; column++) {
      assertTrue(board.getCell(2, column).isEmpty(), "column " + column);
    }
  }

  // Each column is crossed once: a bramble does not hurt the witch again on the next frames.
  @Test
  void aCellIsCrossedOnlyOnce() {
    board.getCell(2, 5).place(new FakeBramble(3));
    Witch witch = new Witch(2, farm, board, config, NO_WEAR, new Random(1));

    for (int frame = 0; frame < 600; frame++) {
      witch.update(0.05f);
    }

    assertEquals(config.getHealth(EnemyType.WITCH) - 3, witch.getHealth());
  }

  // Killed on column 5, the witch never reaches column 4 nor the farm.
  @Test
  void witchKilledOnTheWayStopsCrossing() {
    board.getCell(2, 5).place(new FakeBramble(config.getHealth(EnemyType.WITCH)));
    board.getCell(2, 4).place(carrot());
    Witch witch = new Witch(2, farm, board, config, NO_WEAR, new Random(1));

    witch.update(60f);

    assertTrue(witch.isDead());
    assertFalse(board.getCell(2, 4).isEmpty());
    assertEquals(config.getFarmHealth(), farm.getHealth());
  }

  // The constructor without a board still works (GameSession uses it): the enemy crosses an empty board.
  // Day 11: 0.1 s after her first hit (the first delay after her arrival), she has hit once.
  @Test
  void enemyBuiltWithoutABoardStillWalksAndHits() {
    Witch witch = new Witch(2, farm, config);

    witch.update(config.getSpawnCellsToFarm() / config.getSpeed(EnemyType.WITCH) + config.getFirstFarmHitDelay() + 0.1f);

    assertEquals(config.getFarmHealth() - config.getFarmDamage(EnemyType.WITCH), farm.getHealth());
  }
}
