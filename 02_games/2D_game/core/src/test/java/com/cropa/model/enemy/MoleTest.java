package com.cropa.model.enemy;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cropa.model.world.Board;
import com.cropa.model.world.Cell;
import com.cropa.model.world.Crop;
import com.cropa.model.world.CropConfig;
import com.cropa.model.world.CropType;
import com.cropa.model.world.Damageable;
import com.cropa.model.world.Occupant;
import java.util.Random;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

// The mole (rules §8, §10): a crop at random, 3 s of meal, visible and attackable meanwhile, then 11 s underground
// where nothing touches it. 2 meals at most (3 before day 10). It ignores the farm and does not eat the bramble.
// The Random has a fixed seed: the same draws in every run, so the tests always give the same result.
class MoleTest {

  // The real bramble comes with the defenses: like it, this one is never eaten by a mole.
  private static class FakeBramble implements Occupant {
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
      return "bramble";
    }
  }

  private final EnemyConfig config = new EnemyConfig();
  private final CropConfig cropConfig = new CropConfig();

  private Board board;

  @BeforeEach
  void createAnEmptyBoard() {
    board = new Board();
  }

  private Crop carrot() {
    return new Crop(CropType.CARROT, cropConfig);
  }

  private Mole newMole() {
    return new Mole(board, config, new Random(1));
  }

  // -------------------- THE LANDMARKS OF THE DAY SHEET --------------------

  @Test
  void newMoleIsUndergroundAndNotDrawn() {
    Mole mole = newMole();

    assertFalse(mole.isTargetable());
    assertFalse(mole.isOnBoard());
  }

  // 5 carrots on row 1, new Random(1): the landmarks of the day sheet, step by step. 2 meals since day 10
  // (3 before, rebalanced after whole games were simulated): it leaves after the second one.
  @Test
  void moleEatsTwoCropsThenLeaves() {
    for (int column = 1; column <= 5; column++) {
      board.getCell(1, column).place(carrot());
    }
    Mole mole = newMole();

    mole.update(0.1f);
    assertTrue(mole.isTargetable());
    assertTrue(mole.isOnBoard());
    assertEquals(5, board.getCrops().size());

    mole.update(3f);
    assertFalse(mole.isTargetable());
    assertEquals(4, board.getCrops().size());

    mole.update(10.9f);
    assertFalse(mole.isTargetable());

    mole.update(0.2f);
    assertTrue(mole.isTargetable());

    mole.update(3f);
    assertEquals(3, board.getCrops().size());
    assertTrue(mole.hasFled());

    mole.update(11f);
    mole.update(3f);
    assertEquals(3, board.getCrops().size());
  }

  // Killed during its meal (5 damage = all its health), the mole stops: the pumpkin stays.
  @Test
  void deadMoleLeavesItsCropAlone() {
    board.getCell(2, 3).place(new Crop(CropType.PUMPKIN, cropConfig));
    Mole mole = newMole();

    mole.update(0.1f);
    mole.takeDamage(5);
    mole.update(3f);

    assertTrue(mole.isDead());
    assertFalse(board.getCell(2, 3).isEmpty());
  }

  // -------------------- PLACE, SPRITE, CELLS --------------------

  // The middle of the cell: column + 3 - 0.5 cells left. The catapatate finds the column with ceil(...) - 3.
  @Test
  void eatingMoleStandsInTheMiddleOfItsCell() {
    board.getCell(2, 3).place(carrot());
    Mole mole = newMole();

    mole.update(0.1f);

    assertEquals(2, mole.getRow());
    assertEquals(5.5f, mole.getCellsToFarm(), 0.001f);
    assertEquals(3, (int) Math.ceil(mole.getCellsToFarm()) - 3);
  }

  @Test
  void moleShowsTheMoleSprite() {
    assertEquals("mole", newMole().spriteKey());
  }

  // It follows no row: entering a cell does nothing, the carrot stays.
  @Test
  void enteringACellDoesNothing() {
    Cell cell = board.getCell(2, 3);
    cell.place(carrot());

    newMole().onEnterCell(cell);

    assertFalse(cell.isEmpty());
  }

  // -------------------- SPECIAL CASES --------------------

  // Nothing to eat: no meal, it stays underground and tries again at the next frame.
  @Test
  void moleWaitsUndergroundWhileThereIsNothingToEat() {
    Mole mole = newMole();

    mole.update(0.1f);
    assertFalse(mole.isTargetable());

    board.getCell(3, 4).place(carrot());
    mole.update(0.1f);

    assertTrue(mole.isTargetable());
  }

  @Test
  void moleDoesNotEatABramble() {
    board.getCell(2, 3).place(new FakeBramble());
    Mole mole = newMole();

    mole.update(0.1f);

    assertFalse(mole.isTargetable());
  }

  // The witch crushed the carrot during the meal, and another one was planted: the mole does not eat the new one.
  @Test
  void moleOnlyEatsTheCropItStartedOn() {
    Cell cell = board.getCell(2, 3);
    cell.place(carrot());
    Mole mole = newMole();

    mole.update(0.1f);
    cell.remove();
    Crop newCarrot = carrot();
    cell.place(newCarrot);
    mole.update(3f);

    assertEquals(newCarrot, cell.getOccupant().orElseThrow());
  }

  @Test
  void fledMoleDoesNothing() {
    board.getCell(2, 3).place(carrot());
    Mole mole = newMole();

    mole.flee();
    mole.update(0.1f);

    assertFalse(mole.isTargetable());
  }

  // The dawn (§3): DayState.enter calls flee() on every enemy. A mole in the middle of its meal leaves at once:
  // the end of the meal never comes, so the crop stays, and the mole is no longer drawn nor eats again.
  @Test
  void moleFleeingAtDawnDuringItsMealLeavesTheCrop() {
    Crop meal = carrot();
    board.getCell(2, 3).place(meal);
    Mole mole = newMole();
    mole.update(0.1f);
    assertTrue(mole.isTargetable());

    mole.flee();
    mole.update(config.getMoleMealDuration());

    assertEquals(meal, board.getCell(2, 3).getOccupant().orElseThrow());
    assertTrue(mole.hasFled());
    assertFalse(mole.isOnBoard());

    // Long after: no other meal either.
    mole.update(config.getMoleWaitDuration() + config.getMoleMealDuration());
    assertEquals(1, board.getCrops().size());
  }

  @Test
  void zeroOrNegativeDeltaIsIgnored() {
    board.getCell(2, 3).place(carrot());
    Mole mole = newMole();

    mole.update(0f);
    mole.update(-1f);

    assertFalse(mole.isTargetable());
  }

  // Killed during its meal, it is still "eating" but no longer drawn.
  @Test
  void moleKilledDuringItsMealIsNoLongerOnTheBoard() {
    board.getCell(2, 3).place(carrot());
    Mole mole = newMole();

    mole.update(0.1f);
    mole.takeDamage(mole.getHealth());

    assertFalse(mole.isOnBoard());
  }

  // It never goes to the farm: it does not hit it, whatever the time.
  @Test
  void moleNeverWalksToTheFarm() {
    board.getCell(2, 3).place(carrot());
    Mole mole = newMole();

    mole.update(0.1f);
    float cellsWhileEating = mole.getCellsToFarm();
    mole.update(3f);
    mole.update(5f);

    assertEquals(cellsWhileEating, mole.getCellsToFarm(), 0.001f);
  }
}
