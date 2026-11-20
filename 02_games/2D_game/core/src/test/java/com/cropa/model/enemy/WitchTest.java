package com.cropa.model.enemy;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cropa.model.world.Farm;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class WitchTest {

  private final EnemyConfig config = new EnemyConfig();

  // Expected values are computed from the config, so a rebalancing only breaks EnemyConfigTest.
  private final float speed = config.getSpeed(EnemyType.WITCH);
  private final int damage = config.getFarmDamage(EnemyType.WITCH);
  // Time to walk from the entry to the farm: 10 / 0.3, about 33.3 s with the rules' numbers.
  private final float arrivalTime = config.getSpawnCellsToFarm() / speed;
  private final float cooldown = config.getFarmHitCooldown();
  // The first hit comes sooner than the next ones (day 11): as soon as she arrives (0 s), then every 5 s.
  private final float firstDelay = config.getFirstFarmHitDelay();

  private Farm farm;
  private Witch witch;

  @BeforeEach
  void createWitchOnRowTwo() {
    farm = new Farm(config.getFarmHealth());
    witch = new Witch(2, farm, config);
  }

  @Test
  void witchIsOfTypeWitch() {
    assertEquals(EnemyType.WITCH, witch.getType());
  }

  @Test
  void witchHasTheHealthOfAWitch() {
    assertEquals(config.getHealth(EnemyType.WITCH), witch.getHealth());
  }

  @Test
  void witchWalksAtHerSpeed() {
    witch.update(1f);

    assertEquals(config.getSpawnCellsToFarm() - speed, witch.getCellsToFarm(), 0.001f);
  }

  @Test
  void witchReachesTheFarmAtHerArrivalTime() {
    witch.update(arrivalTime - 0.1f);

    assertTrue(witch.getCellsToFarm() > 0);

    witch.update(0.1f);

    assertEquals(0f, witch.getCellsToFarm(), 0.001f);
  }

  // Spawned at t = 0, the witch arrives at about 33.3 s and hits the first delay later (at once since day 11), then
  // one cooldown after that (about 38.3 s), 20 HP each time.
  @Test
  void witchHitsTheFarmTheFirstDelayAfterArrivingThenEveryCooldown() {
    witch.update(arrivalTime + firstDelay + 0.1f);

    assertEquals(config.getFarmHealth() - damage, farm.getHealth());

    witch.update(cooldown);

    assertEquals(config.getFarmHealth() - 2 * damage, farm.getHealth());
  }

  @Test
  void witchDoesNotHitBeforeThirtySeconds() {
    witch.update(29.9f);

    assertEquals(config.getFarmHealth(), farm.getHealth());
  }

  @Test
  void walkingWitchShowsItsWalkingSprite() {
    assertEquals("witch", witch.spriteKey());
  }

  // Day 14: the attack image only during the 0.3 s after a hit (LaneEnemyAttackPoseTest). The first hit comes at the
  // arrival: 0.1 s later, the witch still shows it. Before day 14, arrivalTime + 1 s, when the image stayed on.
  @Test
  void witchJustAfterHittingTheFarmShowsItsAttackSprite() {
    witch.update(arrivalTime + firstDelay + 0.1f);

    assertEquals("witch_attack", witch.spriteKey());
  }

  @Test
  void deadWitchDoesNotHitTheFarm() {
    witch.takeDamage(witch.getHealth());

    witch.update(60f);

    assertEquals(config.getFarmHealth(), farm.getHealth());
  }

  // The dawn (§3): a witch in front of the farm, which has already hit it once, flees.
  // The rules: "an enemy that hits the farm stops". No other hit, however long the frames that follow.
  // Day 11: her first hit comes the first delay after her arrival (0 s); 0.1 s later, she has hit exactly once
  // (the next hit is one cooldown away).
  @Test
  void witchFleeingAtDawnInFrontOfTheFarmHitsNoMore() {
    witch.update(arrivalTime + firstDelay + 0.1f);
    int healthAtDawn = config.getFarmHealth() - damage;
    assertEquals(healthAtDawn, farm.getHealth());

    witch.flee();
    witch.update(5 * config.getFarmHitCooldown());

    assertEquals(healthAtDawn, farm.getHealth());
    assertTrue(witch.hasFled());
    assertFalse(witch.isOnBoard());
  }
}
