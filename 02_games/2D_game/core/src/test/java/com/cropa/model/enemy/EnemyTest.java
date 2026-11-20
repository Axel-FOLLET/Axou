package com.cropa.model.enemy;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cropa.model.world.Cell;
import org.junit.jupiter.api.Test;

class EnemyTest {

  // Enemy is abstract: this minimal subclass tests what Enemy does by itself.
  private static class TestEnemy extends Enemy {
    TestEnemy(EnemyType type, int row, EnemyConfig config) {
      super(type, row, config);
    }

    @Override
    public void update(float delta) {
    }

    @Override
    public String spriteKey() {
      return "test";
    }

    @Override
    public void onEnterCell(Cell cell) {
    }
  }

  private final EnemyConfig config = new EnemyConfig();

  @Test
  void enemyStartsWithTheHealthOfItsType() {
    Enemy enemy = new TestEnemy(EnemyType.WITCH, 2, config);

    assertEquals(config.getHealth(EnemyType.WITCH), enemy.getHealth());
  }

  @Test
  void enemyStartsAtTheEntryOfItsRow() {
    Enemy enemy = new TestEnemy(EnemyType.BAT, 2, config);

    assertEquals(config.getSpawnCellsToFarm(), enemy.getCellsToFarm(), 0.001f);
  }

  @Test
  void enemyKeepsItsTypeAndRow() {
    Enemy enemy = new TestEnemy(EnemyType.BAT, 3, config);

    assertEquals(EnemyType.BAT, enemy.getType());
    assertEquals(3, enemy.getRow());
  }

  @Test
  void rewardComesFromTheConfig() {
    Enemy enemy = new TestEnemy(EnemyType.WITCH, 1, config);

    assertEquals(config.getReward(EnemyType.WITCH), enemy.getReward());
  }

  @Test
  void rowMustBeBetweenOneAndThree() {
    assertThrows(IllegalArgumentException.class, () -> new TestEnemy(EnemyType.BAT, 0, config));
    assertThrows(IllegalArgumentException.class, () -> new TestEnemy(EnemyType.BAT, 4, config));
  }

  @Test
  void takeDamageLowersHealth() {
    Enemy enemy = new TestEnemy(EnemyType.WITCH, 2, config);
    int startHealth = enemy.getHealth();

    enemy.takeDamage(3);

    assertEquals(startHealth - 3, enemy.getHealth());
  }

  @Test
  void healthNeverGoesBelowZero() {
    Enemy enemy = new TestEnemy(EnemyType.BAT, 2, config);

    enemy.takeDamage(enemy.getHealth() + 10);

    assertEquals(0, enemy.getHealth());
  }

  @Test
  void negativeDamageIsIgnored() {
    Enemy enemy = new TestEnemy(EnemyType.WITCH, 2, config);
    int startHealth = enemy.getHealth();

    enemy.takeDamage(-5);

    assertEquals(startHealth, enemy.getHealth());
  }

  @Test
  void enemyIsAliveWhileHealthIsAboveZero() {
    Enemy enemy = new TestEnemy(EnemyType.WITCH, 2, config);

    enemy.takeDamage(enemy.getHealth() - 1);

    assertFalse(enemy.isDead());
  }

  @Test
  void enemyIsDeadAtZeroHealth() {
    Enemy enemy = new TestEnemy(EnemyType.WITCH, 2, config);

    enemy.takeDamage(enemy.getHealth());

    assertTrue(enemy.isDead());
  }

  @Test
  void enemyHasNotFledAtFirst() {
    Enemy enemy = new TestEnemy(EnemyType.BAT, 2, config);

    assertFalse(enemy.hasFled());
  }

  @Test
  void fleeMakesTheEnemyLeave() {
    Enemy enemy = new TestEnemy(EnemyType.BAT, 2, config);

    enemy.flee();

    assertTrue(enemy.hasFled());
  }

  @Test
  void moveTowardsFarmLowersTheCellsLeft() {
    Enemy enemy = new TestEnemy(EnemyType.BAT, 2, config);

    enemy.moveTowardsFarm(2.5f);

    assertEquals(config.getSpawnCellsToFarm() - 2.5f, enemy.getCellsToFarm(), 0.001f);
  }

  @Test
  void moveTowardsFarmStopsInFrontOfTheFarm() {
    Enemy enemy = new TestEnemy(EnemyType.BAT, 2, config);

    enemy.moveTowardsFarm(config.getSpawnCellsToFarm() + 5f);

    assertEquals(0f, enemy.getCellsToFarm(), 0.001f);
  }

  @Test
  void moveToChangesTheRowAndTheCellsLeft() {
    Enemy enemy = new TestEnemy(EnemyType.WITCH, 2, config);

    enemy.moveTo(3, 5.5f);

    assertEquals(3, enemy.getRow());
    assertEquals(5.5f, enemy.getCellsToFarm(), 0.001f);
  }

  // Rows 0 and 4 are the flee rows: an enemy can go there on its way, never be born there.
  @Test
  void moveToAcceptsTheFleeRows() {
    Enemy enemy = new TestEnemy(EnemyType.WITCH, 2, config);

    enemy.moveTo(0, 8f);
    assertEquals(0, enemy.getRow());

    enemy.moveTo(4, 8f);
    assertEquals(4, enemy.getRow());
  }

  @Test
  void moveToRefusesARowOutsideTheBoard() {
    Enemy enemy = new TestEnemy(EnemyType.WITCH, 2, config);

    assertThrows(IllegalArgumentException.class, () -> enemy.moveTo(-1, 8f));
    assertThrows(IllegalArgumentException.class, () -> enemy.moveTo(5, 8f));
  }

  @Test
  void newEnemyIsOnTheBoard() {
    Enemy enemy = new TestEnemy(EnemyType.BAT, 2, config);

    assertTrue(enemy.isOnBoard());
  }

  @Test
  void deadEnemyIsNoLongerOnTheBoard() {
    Enemy enemy = new TestEnemy(EnemyType.BAT, 2, config);

    enemy.takeDamage(enemy.getHealth());

    assertFalse(enemy.isOnBoard());
  }

  @Test
  void fledEnemyIsNoLongerOnTheBoard() {
    Enemy enemy = new TestEnemy(EnemyType.BAT, 2, config);

    enemy.flee();

    assertFalse(enemy.isOnBoard());
  }

  @Test
  void enemyIsTargetableByDefault() {
    Enemy enemy = new TestEnemy(EnemyType.WITCH, 2, config);

    assertTrue(enemy.isTargetable());
  }

  // -------------------- REWARD (rules §8) --------------------
  // Killing an enemy brings coins, once. An enemy that flees brings nothing.
  // The amounts come from the config: EnemyConfigTest checks they are 20, 30 and 80.

  private Enemy killed(EnemyType type) {
    Enemy enemy = new TestEnemy(type, 2, config);
    enemy.takeDamage(enemy.getHealth());
    return enemy;
  }

  // The landmark of the day sheet: 30 for a killed bat, then 0 on the second call.
  @Test
  void killedBatPaysItsRewardOnlyOnce() {
    Enemy bat = killed(EnemyType.BAT);

    assertEquals(config.getReward(EnemyType.BAT), bat.collectReward());
    assertEquals(0, bat.collectReward());
  }

  @Test
  void killedMoleAndWitchPayTheirReward() {
    assertEquals(config.getReward(EnemyType.MOLE), killed(EnemyType.MOLE).collectReward());
    assertEquals(config.getReward(EnemyType.WITCH), killed(EnemyType.WITCH).collectReward());
  }

  @Test
  void livingEnemyPaysNothing() {
    Enemy enemy = new TestEnemy(EnemyType.WITCH, 2, config);
    enemy.takeDamage(1);

    assertEquals(0, enemy.collectReward());
  }

  @Test
  void fledEnemyPaysNothing() {
    Enemy enemy = new TestEnemy(EnemyType.WITCH, 2, config);
    enemy.flee();

    assertEquals(0, enemy.collectReward());
  }

  // Noted by Yohan on day 10: an enemy that fled, then took the last hit, left the board alive: no reward.
  @Test
  void fledThenKilledEnemyPaysNothing() {
    Enemy enemy = new TestEnemy(EnemyType.WITCH, 2, config);
    enemy.flee();
    enemy.takeDamage(enemy.getHealth());

    assertEquals(0, enemy.collectReward());
  }

  // Asking while it is alive takes nothing: the reward is still there once it is killed.
  @Test
  void askingBeforeTheDeathDoesNotUseTheReward() {
    Enemy enemy = new TestEnemy(EnemyType.BAT, 2, config);

    assertEquals(0, enemy.collectReward());
    enemy.takeDamage(enemy.getHealth());

    assertEquals(config.getReward(EnemyType.BAT), enemy.collectReward());
  }

  // Hit again after its death (two defenses in the same frame): still paid only once.
  @Test
  void hittingADeadEnemyAgainDoesNotPayTwice() {
    Enemy bat = killed(EnemyType.BAT);
    bat.collectReward();

    bat.takeDamage(5);

    assertEquals(0, bat.collectReward());
  }
}
