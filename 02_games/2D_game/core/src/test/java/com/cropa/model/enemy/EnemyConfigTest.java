package com.cropa.model.enemy;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class EnemyConfigTest {

  private final EnemyConfig config = new EnemyConfig();

  // The numbers of the rebalance of day 9 (rules.md §10): slower, tougher, harder hits.
  @Test
  void batStatsMatchTheRules() {
    assertEquals(20, config.getHealth(EnemyType.BAT));
    assertEquals(0.35f, config.getSpeed(EnemyType.BAT), 0.001f);
    assertEquals(10, config.getFarmDamage(EnemyType.BAT));
    assertEquals(30, config.getReward(EnemyType.BAT));
    assertEquals(10, config.getDefenseWear(EnemyType.BAT));
  }

  @Test
  void witchStatsMatchTheRules() {
    assertEquals(45, config.getHealth(EnemyType.WITCH));
    assertEquals(0.3f, config.getSpeed(EnemyType.WITCH), 0.001f);
    assertEquals(20, config.getFarmDamage(EnemyType.WITCH));
    assertEquals(80, config.getReward(EnemyType.WITCH));
    assertEquals(20, config.getDefenseWear(EnemyType.WITCH));
  }

  @Test
  void moleStatsMatchTheRules() {
    assertEquals(5, config.getHealth(EnemyType.MOLE));
    assertEquals(0, config.getFarmDamage(EnemyType.MOLE));
    assertEquals(20, config.getReward(EnemyType.MOLE));
    assertEquals(0, config.getDefenseWear(EnemyType.MOLE));
  }

  @Test
  void moleDoesNotWalkAlongARow() {
    assertEquals(0f, config.getSpeed(EnemyType.MOLE), 0.001f);
  }

  // Day 11: the enemies hit the farm as soon as they arrive (no delay), then every 5 s.
  @Test
  void enemiesHitTheFarmAsSoonAsTheyArrive() {
    assertEquals(0f, config.getFirstFarmHitDelay(), 0.001f);
  }

  @Test
  void enemiesHitTheFarmEveryFiveSeconds() {
    assertEquals(5f, config.getFarmHitCooldown(), 0.001f);
  }

  @Test
  void enemiesEnterTenCellsFromTheFarm() {
    assertEquals(10f, config.getSpawnCellsToFarm(), 0.001f);
  }

  @Test
  void moleEatsForThreeSeconds() {
    assertEquals(3f, config.getMoleMealDuration(), 0.001f);
  }

  @Test
  void moleWaitsElevenSecondsUnderground() {
    assertEquals(11f, config.getMoleWaitDuration(), 0.001f);
  }

  // Rebalanced on day 10 after whole games were simulated: 2 meals (was 3), farm 150 (was 100), pitchfork 4 (was 5).
  @Test
  void moleEatsTwiceAtMost() {
    assertEquals(2, config.getMoleMaxMeals());
  }

  @Test
  void farmHasOneHundredAndFiftyHealth() {
    assertEquals(150, config.getFarmHealth());
  }

  @Test
  void farmerPitchforkDealsFourDamage() {
    assertEquals(4, config.getFarmerDamage());
  }

  // Rules §10: the farmer hits once per second.
  @Test
  void farmerHitsOncePerSecond() {
    assertEquals(1f, config.getFarmerCooldown(), 0.001f);
  }

  @Test
  void everyEnemyTypeHasHealthAndAReward() {
    for (EnemyType type : EnemyType.values()) {
      assertTrue(config.getHealth(type) > 0, type + " has no health");
      assertTrue(config.getReward(type) > 0, type + " has no reward");
    }
  }

  // Day 10 (L5): the numbers are a table with one line per enemy. The switch without default refused to compile
  // when an enemy had no numbers; a table cannot, so this test does it: a new value of EnemyType without its line
  // makes the five getters fail here, before the game does.
  @Test
  void everyEnemyTypeHasItsLineInTheTable() {
    for (EnemyType type : EnemyType.values()) {
      assertDoesNotThrow(() -> config.getHealth(type), type + ": health");
      assertDoesNotThrow(() -> config.getSpeed(type), type + ": speed");
      assertDoesNotThrow(() -> config.getFarmDamage(type), type + ": farm damage");
      assertDoesNotThrow(() -> config.getReward(type), type + ": reward");
      assertDoesNotThrow(() -> config.getDefenseWear(type), type + ": defense wear");
    }
  }
}
