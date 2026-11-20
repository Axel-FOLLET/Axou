package com.cropa.model.enemy;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cropa.model.world.Farm;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class BatTest {

  private final EnemyConfig config = new EnemyConfig();

  // Expected values are computed from the config, so a rebalancing only breaks EnemyConfigTest.
  private final float speed = config.getSpeed(EnemyType.BAT);
  private final float cooldown = config.getFarmHitCooldown();
  // The first hit comes sooner than the next ones (day 11): as soon as it arrives (0 s), then every 5 s.
  private final float firstDelay = config.getFirstFarmHitDelay();
  private final int damage = config.getFarmDamage(EnemyType.BAT);
  // Time to fly from the entry to the farm: 10 / 0.75, about 13.3 s with the rules' numbers.
  private final float arrivalTime = config.getSpawnCellsToFarm() / speed;

  private Farm farm;
  private Bat bat;

  @BeforeEach
  void createBatOnRowTwo() {
    farm = new Farm(config.getFarmHealth());
    bat = new Bat(2, farm, config);
  }

  @Test
  void batStartsTenCellsFromTheFarm() {
    assertEquals(config.getSpawnCellsToFarm(), bat.getCellsToFarm(), 0.001f);
  }

  @Test
  void batIsOfTypeBat() {
    assertEquals(EnemyType.BAT, bat.getType());
  }

  @Test
  void flyingBatShowsItsWalkingSprite() {
    assertEquals("bat", bat.spriteKey());
  }

  // Day 14: the attack image only during the 0.3 s after a hit (LaneEnemyAttackPoseTest). The first hit comes at the
  // arrival: 0.1 s later, the bat still shows it. Before day 14, arrivalTime + 1 s, when the image stayed on.
  @Test
  void batJustAfterHittingTheFarmShowsItsAttackSprite() {
    bat.update(arrivalTime + firstDelay + 0.1f);

    assertEquals("bat_attack", bat.spriteKey());
  }

  @Test
  void batMovesOneAndAHalfCellsPerSecond() {
    bat.update(1f);

    assertEquals(config.getSpawnCellsToFarm() - speed, bat.getCellsToFarm(), 0.001f);
  }

  @Test
  void batStaysOnItsRow() {
    bat.update(arrivalTime);

    assertEquals(2, bat.getRow());
  }

  @Test
  void batStopsInFrontOfTheFarm() {
    bat.update(arrivalTime + 5f);

    assertEquals(0f, bat.getCellsToFarm(), 0.001f);
  }

  @Test
  void batDoesNotHitTheFarmWhileFlying() {
    bat.update(arrivalTime - 0.1f);

    assertEquals(config.getFarmHealth(), farm.getHealth());
  }

  // Day 11: the first hit comes the first delay after the arrival (0 s: on arrival), no longer a whole cooldown.
  // Written from the arrival plus the delay, so it holds for any delay: just before, no hit; just after, one.
  @Test
  void firstHitComesTheFirstDelayAfterArrival() {
    bat.update(arrivalTime + firstDelay - 0.01f);

    assertEquals(config.getFarmHealth(), farm.getHealth());

    bat.update(0.02f);

    assertEquals(config.getFarmHealth() - damage, farm.getHealth());
  }

  // After the first hit, one hit every cooldown.
  @Test
  void batHitsTheFarmEveryCooldownAfterItsFirstHit() {
    bat.update(arrivalTime);
    bat.update(firstDelay);
    bat.update(cooldown);

    assertEquals(config.getFarmHealth() - 2 * damage, farm.getHealth());
  }

  // One long frame: the first hit, then two more, one cooldown apart.
  @Test
  void oneLongFrameCountsEveryHit() {
    bat.update(arrivalTime + firstDelay + 2 * cooldown + 0.01f);

    assertEquals(config.getFarmHealth() - 3 * damage, farm.getHealth());
  }

  // With no delay at all, the bat hits as soon as it arrives, but never from afar: the clock of the hits only runs
  // in front of the farm. A config of test with a first delay of 0 s.
  @Test
  void withNoFirstDelayTheBatHitsOnArrivalButNeverFromAfar() {
    EnemyConfig noDelay = new EnemyConfig() {
      @Override
      public float getFirstFarmHitDelay() {
        return 0f;
      }
    };
    Bat eager = new Bat(2, farm, noDelay);

    eager.update(0.1f);
    assertEquals(config.getFarmHealth(), farm.getHealth());

    eager.update(arrivalTime);
    assertEquals(config.getFarmHealth() - damage, farm.getHealth());
  }

  @Test
  void deadBatDoesNotHitTheFarm() {
    bat.takeDamage(bat.getHealth());

    bat.update(arrivalTime + 3 * cooldown);

    assertEquals(config.getFarmHealth(), farm.getHealth());
  }

  @Test
  void fledBatNeitherMovesNorHits() {
    bat.flee();

    bat.update(arrivalTime + 3 * cooldown);

    assertEquals(config.getSpawnCellsToFarm(), bat.getCellsToFarm(), 0.001f);
    assertEquals(config.getFarmHealth(), farm.getHealth());
  }

  @Test
  void batStopsHittingADestroyedFarm() {
    Farm weakFarm = new Farm(damage);
    Bat weakFarmBat = new Bat(2, weakFarm, config);

    weakFarmBat.update(arrivalTime + 5 * cooldown);

    assertTrue(weakFarm.isDestroyed());
    assertEquals(0, weakFarm.getHealth());
  }

  @Test
  void negativeDeltaIsIgnored() {
    bat.update(-1f);

    assertEquals(config.getSpawnCellsToFarm(), bat.getCellsToFarm(), 0.001f);
  }
}
