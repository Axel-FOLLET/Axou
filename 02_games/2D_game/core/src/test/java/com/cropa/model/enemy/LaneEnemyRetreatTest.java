package com.cropa.model.enemy;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
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

// When the 3 rows of a column block it (the team's rule), the enemy leaves the field by the nearest flee row,
// then goes back along it towards its starting point, at its own speed, and flees there. It never hits the farm.
class LaneEnemyRetreatTest {

  // A defense line that does nothing: these tests are not about the wear (see LaneEnemyWearTest).
  private static final DefenseLine NO_WEAR = (row, column, percent) -> { };

  private final EnemyConfig config = new EnemyConfig();
  private final CropConfig cropConfig = new CropConfig();
  private final float spawn = config.getSpawnCellsToFarm();
  private final float witchSpeed = config.getSpeed(EnemyType.WITCH);

  // Column 5 is entered at 8 cells left: 2 cells after the entry, at the witch's speed, plus a little margin.
  private final float witchPastColumnFive = 2f / witchSpeed + 0.2f;

  private Board board;
  private Farm farm;

  @BeforeEach
  void createAnEmptyBoard() {
    board = new Board();
    farm = new Farm(config.getFarmHealth());
  }

  private void closeColumnFiveWith(CropType type) {
    for (int row = 1; row <= 3; row++) {
      board.getCell(row, 5).place(new Crop(type, cropConfig));
    }
  }

  // The landmark of the day sheet, with the team's rule: the 3 rows of column 5 hold a turnip.
  @Test
  void witchOfRowOneLeavesByRowZeroAtTheEdgeOfTheColumn() {
    closeColumnFiveWith(CropType.TURNIP);
    Witch witch = new Witch(1, farm, board, config, NO_WEAR, new Random(1));

    witch.update(witchPastColumnFive);

    assertEquals(0, witch.getRow());
    assertEquals(8f, witch.getCellsToFarm(), 0.001f);
  }

  @Test
  void witchOfRowThreeLeavesByRowFour() {
    closeColumnFiveWith(CropType.TURNIP);
    Witch witch = new Witch(3, farm, board, config, NO_WEAR, new Random(1));

    witch.update(witchPastColumnFive);

    assertEquals(4, witch.getRow());
  }

  // Back along the flee row, at her own speed: one second takes her witchSpeed cell further from the farm.
  @Test
  void leavingWitchGoesBackAtHerOwnSpeed() {
    closeColumnFiveWith(CropType.TURNIP);
    Witch witch = new Witch(1, farm, board, config, NO_WEAR, new Random(1));

    witch.update(witchPastColumnFive);
    witch.update(1f);

    assertEquals(8f + witchSpeed, witch.getCellsToFarm(), 0.001f);
    assertFalse(witch.hasFled());
  }

  // From 8 back to 10 cells at her speed, then she has fled. The farm and the turnips are untouched.
  @Test
  void witchFleesWhenBackToHerStartingPoint() {
    closeColumnFiveWith(CropType.TURNIP);
    Witch witch = new Witch(1, farm, board, config, NO_WEAR, new Random(1));

    witch.update(witchPastColumnFive);
    witch.update((spawn - 8f) / witchSpeed);

    assertTrue(witch.hasFled());
    assertFalse(witch.isOnBoard());
    assertEquals(spawn, witch.getCellsToFarm(), 0.001f);
    assertEquals(config.getFarmHealth(), farm.getHealth());
    for (int row = 1; row <= 3; row++) {
      assertFalse(board.getCell(row, 5).isEmpty(), "turnip on row " + row);
    }
  }

  // Still drawn while it goes back: it is on the board until it has fled.
  @Test
  void leavingWitchIsStillOnTheBoard() {
    closeColumnFiveWith(CropType.TURNIP);
    Witch witch = new Witch(1, farm, board, config, NO_WEAR, new Random(1));

    witch.update(witchPastColumnFive);
    witch.update(1f);

    assertTrue(witch.isOnBoard());
  }

  // A long frame: the rest of the frame does not count once the column is closed, and the farm is never hit.
  @Test
  void aLongFrameNeverTakesALeavingWitchToTheFarm() {
    closeColumnFiveWith(CropType.TURNIP);
    Witch witch = new Witch(1, farm, board, config, NO_WEAR, new Random(1));

    witch.update(60f);
    witch.update(60f);

    assertTrue(witch.hasFled());
    assertEquals(config.getFarmHealth(), farm.getHealth());
  }

  // Leaving, it enters no cell any more: a carrot further on its old row is not crushed.
  @Test
  void leavingWitchCrushesNothingMore() {
    closeColumnFiveWith(CropType.TURNIP);
    board.getCell(1, 3).place(new Crop(CropType.CARROT, cropConfig));
    Witch witch = new Witch(1, farm, board, config, NO_WEAR, new Random(1));

    for (int frame = 0; frame < 600; frame++) {
      witch.update(0.05f);
    }

    assertTrue(witch.hasFled());
    assertFalse(board.getCell(1, 3).isEmpty());
  }

  // The same rule for the bat, with the garlic.
  @Test
  void batLeavesWhenTheColumnIsFullOfGarlic() {
    closeColumnFiveWith(CropType.GARLIC);
    Bat bat = new Bat(2, farm, board, config, NO_WEAR, new Random(1));

    for (int frame = 0; frame < 600; frame++) {
      bat.update(0.05f);
    }

    assertTrue(bat.hasFled());
    assertEquals(config.getFarmHealth(), farm.getHealth());
  }

  // -------------------- SEEN FROM BEHIND (day 14) --------------------

  // Feedback of the mid-term jury: an enemy that leaves by a flee row went back "in moonwalk", still turned to the
  // farm. While it goes back, its key is the one seen from behind: "witch_back" (east-witch.png in SpriteCatalog).
  @Test
  void leavingWitchIsSeenFromBehind() {
    closeColumnFiveWith(CropType.TURNIP);
    Witch witch = new Witch(1, farm, board, config, NO_WEAR, new Random(1));

    witch.update(witchPastColumnFive);
    witch.update(1f);

    assertEquals(0, witch.getRow());
    assertEquals("witch_back", witch.spriteKey());
  }

  @Test
  void leavingBatIsSeenFromBehind() {
    closeColumnFiveWith(CropType.GARLIC);
    Bat bat = new Bat(1, farm, board, config, NO_WEAR, new Random(1));

    bat.update(batPastColumnFive());

    assertEquals(0, bat.getRow());
    assertEquals("bat_back", bat.spriteKey());
  }

  // While a row is still free, it walks on, turned to the farm: its walking key, never the one from behind.
  @Test
  void witchThatTurnsAsideIsNotSeenFromBehind() {
    board.getCell(1, 5).place(new Crop(CropType.TURNIP, cropConfig));
    Witch witch = new Witch(1, farm, board, config, NO_WEAR, new Random(1));

    witch.update(witchPastColumnFive);

    assertEquals(2, witch.getRow());
    assertEquals("witch", witch.spriteKey());
  }

  // -------------------- THE DAWN --------------------

  // Column 5 is entered at 8 cells left: the bat is past it after 2 cells at its own speed, plus a little.
  private float batPastColumnFive() {
    return (spawn - 8f) / config.getSpeed(EnemyType.BAT) + 0.1f;
  }

  // The dawn (§3) comes while the bat goes back along its flee row: flee() ends the way back at once.
  // It stays gone: the next frames neither move it nor throw, and the farm is never hit.
  @Test
  void batGoingBackWhenTheDayBreaksStaysGone() {
    closeColumnFiveWith(CropType.GARLIC);
    Bat bat = new Bat(2, farm, board, config, NO_WEAR, new Random(1));
    bat.update(batPastColumnFive());
    bat.update(0.5f);
    assertTrue(bat.getRow() == Enemy.TOP_FLEE_ROW || bat.getRow() == Enemy.BOTTOM_FLEE_ROW);
    assertFalse(bat.hasFled());
    float cellsAtDawn = bat.getCellsToFarm();

    bat.flee();

    assertDoesNotThrow(() -> {
      for (int frame = 0; frame < 600; frame++) {
        bat.update(0.05f);
      }
    });
    assertTrue(bat.hasFled());
    assertFalse(bat.isOnBoard());
    assertEquals(cellsAtDawn, bat.getCellsToFarm(), 0.001f);
    assertEquals(config.getFarmHealth(), farm.getHealth());
  }

  // Back at its starting point, it had already fled by itself: the flee() of the dawn changes nothing.
  @Test
  void batAlreadyBackAtItsStartWhenTheDayBreaksStaysGone() {
    closeColumnFiveWith(CropType.GARLIC);
    Bat bat = new Bat(2, farm, board, config, NO_WEAR, new Random(1));
    bat.update(batPastColumnFive());
    bat.update(60f);
    assertTrue(bat.hasFled());

    assertDoesNotThrow(bat::flee);
    bat.update(1f);

    assertTrue(bat.hasFled());
    assertEquals(spawn, bat.getCellsToFarm(), 0.001f);
  }

  // Two turnips only (rows 1 and 2): with the team's rule, she does not flee, she goes to row 3.
  @Test
  void witchDoesNotLeaveWhileOneRowIsFree() {
    board.getCell(1, 5).place(new Crop(CropType.TURNIP, cropConfig));
    board.getCell(2, 5).place(new Crop(CropType.TURNIP, cropConfig));
    Witch witch = new Witch(1, farm, board, config, NO_WEAR, new Random(1));

    witch.update(witchPastColumnFive);

    assertEquals(3, witch.getRow());
  }
}
