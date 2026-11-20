package com.cropa.model.enemy;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cropa.model.world.Cell;
import com.cropa.model.world.Crop;
import com.cropa.model.world.CropConfig;
import com.cropa.model.world.CropType;
import com.cropa.model.world.Damageable;
import com.cropa.model.world.Farm;
import com.cropa.model.world.Occupant;
import com.cropa.model.world.Updatable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

// Flying or walking is a behaviour: the common code calls onEnterCell(cell), and each enemy does what it can.
// Nobody asks "is it flying?": a walker lets the cell react, a flyer triggers nothing.
class CellCrosserTest {

  // The real bramble comes with the defenses: this fake one hurts whoever crosses it by 3, and stays.
  private static class FakeBramble implements Occupant {
    @Override
    public boolean onCrossedBy(Damageable crosser) {
      crosser.takeDamage(3);
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

  private Witch witch;
  private Bat bat;

  @BeforeEach
  void createAWitchAndABat() {
    Farm farm = new Farm(config.getFarmHealth());
    witch = new Witch(2, farm, config);
    bat = new Bat(2, farm, config);
  }

  @Test
  void witchCrossingABrambleLosesThreeHealth() {
    Cell cell = new Cell(2, 3);
    cell.place(new FakeBramble());

    witch.onEnterCell(cell);

    assertEquals(config.getHealth(EnemyType.WITCH) - 3, witch.getHealth());
  }

  @Test
  void batFlyingOverABrambleIsNotHurt() {
    Cell cell = new Cell(2, 3);
    cell.place(new FakeBramble());

    bat.onEnterCell(cell);

    assertEquals(config.getHealth(EnemyType.BAT), bat.getHealth());
  }

  @Test
  void witchCrushesACarrot() {
    Cell cell = new Cell(2, 3);
    cell.place(new Crop(CropType.CARROT, new CropConfig()));

    witch.onEnterCell(cell);

    assertTrue(cell.isEmpty());
  }

  @Test
  void batDoesNotCrushACarrot() {
    Cell cell = new Cell(2, 3);
    cell.place(new Crop(CropType.CARROT, new CropConfig()));

    bat.onEnterCell(cell);

    assertFalse(cell.isEmpty());
  }

  @Test
  void crossingAnEmptyCellChangesNothing() {
    Cell cell = new Cell(2, 3);

    witch.onEnterCell(cell);

    assertEquals(config.getHealth(EnemyType.WITCH), witch.getHealth());
    assertTrue(cell.isEmpty());
  }

  // The rest of the game only knows the interfaces: a defense hurts a Damageable, the game updates an Updatable.
  @Test
  void anEnemyIsDamageableAndUpdatable() {
    Damageable target = witch;
    Updatable moving = witch;

    target.takeDamage(5);
    moving.update(1f);

    assertEquals(config.getHealth(EnemyType.WITCH) - 5, witch.getHealth());
    assertEquals(config.getSpawnCellsToFarm() - config.getSpeed(EnemyType.WITCH), witch.getCellsToFarm(), 0.001f);
  }
}
