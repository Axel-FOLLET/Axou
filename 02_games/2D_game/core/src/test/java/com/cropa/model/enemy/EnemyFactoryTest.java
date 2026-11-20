package com.cropa.model.enemy;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
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

// The only class that creates enemies: it gets the board, the farm, the config and the Random once,
// and gives them to every enemy it creates. Only the type and the row change from one enemy to the next.
class EnemyFactoryTest {

  // A defense line that does nothing: these tests are not about the wear (see LaneEnemyWearTest).
  private static final DefenseLine NO_WEAR = (row, column, percent) -> { };

  private final EnemyConfig config = new EnemyConfig();
  private final CropConfig cropConfig = new CropConfig();

  private Board board;
  private Farm farm;
  private EnemyFactory factory;

  @BeforeEach
  void createTheFactory() {
    board = new Board();
    farm = new Farm(config.getFarmHealth());
    factory = new EnemyFactory(board, farm, config, NO_WEAR, new Random(1));
  }

  // -------------------- ONE CLASS PER TYPE --------------------

  // The landmark of the day sheet.
  @Test
  void aWitchIsCreatedOnTheRowAsked() {
    Enemy witch = factory.create(EnemyType.WITCH, 3);

    assertInstanceOf(Witch.class, witch);
    assertEquals(EnemyType.WITCH, witch.getType());
    assertEquals(3, witch.getRow());
  }

  @Test
  void aBatIsCreatedOnTheRowAsked() {
    Enemy bat = factory.create(EnemyType.BAT, 1);

    assertInstanceOf(Bat.class, bat);
    assertEquals(EnemyType.BAT, bat.getType());
    assertEquals(1, bat.getRow());
  }

  // The mole chooses its crops itself: the row asked is ignored, it is always born on row 1, underground.
  @Test
  void aMoleIgnoresTheRowAsked() {
    Enemy mole = factory.create(EnemyType.MOLE, 3);

    assertInstanceOf(Mole.class, mole);
    assertEquals(EnemyType.MOLE, mole.getType());
    assertEquals(1, mole.getRow());
  }

  // Every enemy starts with the health of the config.
  @Test
  void everyEnemyStartsWithTheHealthOfTheConfig() {
    for (EnemyType type : EnemyType.values()) {
      assertEquals(config.getHealth(type), factory.create(type, 2).getHealth(), type.name());
    }
  }

  // Two calls, two enemies: a wave of 12 bats is 12 different objects.
  @Test
  void eachCallCreatesANewEnemy() {
    assertNotSame(factory.create(EnemyType.BAT, 2), factory.create(EnemyType.BAT, 2));
  }

  // The row of a bat or a witch is checked by the enemy itself: never on a flee row at birth.
  @Test
  void aBatOrAWitchCannotBeCreatedOnAFleeRow() {
    assertThrows(IllegalArgumentException.class, () -> factory.create(EnemyType.BAT, 0));
    assertThrows(IllegalArgumentException.class, () -> factory.create(EnemyType.WITCH, 4));
  }

  // -------------------- THE SAME WORLD FOR EVERY ENEMY --------------------

  // The witch walks to the factory's farm and hits it there: first hit the first delay after her arrival (at once
  // since day 11), the next one a cooldown (5 s) later, so 1 s after her first hit she has hit once.
  @Test
  void theWitchHitsTheFarmOfTheFactory() {
    Enemy witch = factory.create(EnemyType.WITCH, 2);
    float arrival = config.getSpawnCellsToFarm() / config.getSpeed(EnemyType.WITCH);

    witch.update(arrival + config.getFirstFarmHitDelay() + 1f);

    assertEquals(config.getFarmHealth() - config.getFarmDamage(EnemyType.WITCH), farm.getHealth());
  }

  // The bat looks at the factory's board: the garlic of row 2, column 5 turns it aside.
  @Test
  void theBatAvoidsTheGarlicOfTheFactorysBoard() {
    board.getCell(2, 5).place(new Crop(CropType.GARLIC, cropConfig));
    Enemy bat = factory.create(EnemyType.BAT, 2);

    // Column 5 is entered at 8 cells left: 2 cells from the spawn, at the bat's speed, plus a little.
    bat.update((config.getSpawnCellsToFarm() - 8f) / config.getSpeed(EnemyType.BAT) + 0.1f);

    assertNotEquals(2, bat.getRow());
  }

  // The mole eats on the factory's board: its only carrot, on row 3, column 2.
  @Test
  void theMoleEatsOnTheFactorysBoard() {
    board.getCell(3, 2).place(new Crop(CropType.CARROT, cropConfig));
    Enemy mole = factory.create(EnemyType.MOLE, 1);

    mole.update(0.1f);

    assertTrue(mole.isOnBoard());
    assertEquals(3, mole.getRow());
  }
}
