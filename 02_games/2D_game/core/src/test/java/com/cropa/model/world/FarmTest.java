package com.cropa.model.world;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class FarmTest {

  @Test
  void farmStartsWithOneHundredHealth() {
    Farm farm = new Farm(100);

    assertEquals(100, farm.getHealth());
  }

  @Test
  void takeDamageLowersHealth() {
    Farm farm = new Farm(100);

    farm.takeDamage(5);

    assertEquals(95, farm.getHealth());
  }

  @Test
  void damageAddsUpAcrossHits() {
    Farm farm = new Farm(100);

    farm.takeDamage(5);
    farm.takeDamage(15);

    assertEquals(80, farm.getHealth());
  }

  @Test
  void farmIsNotDestroyedWhileHealthIsAboveZero() {
    Farm farm = new Farm(100);

    farm.takeDamage(99);

    assertFalse(farm.isDestroyed());
  }

  @Test
  void farmIsDestroyedAtZeroHealth() {
    Farm farm = new Farm(100);

    farm.takeDamage(100);

    assertTrue(farm.isDestroyed());
  }

  @Test
  void healthCanNotBeNegative() {
    Farm farm = new Farm(5);

    farm.takeDamage(10);

    assertEquals(0, farm.getHealth());
    assertTrue(farm.isDestroyed());
  }

  @Test
  void negativeDamageIgnored() {
    Farm farm = new Farm(100);

    farm.takeDamage(-10);

    assertEquals(100, farm.getHealth());
  }

  // Through Damageable, the farm takes the hit like any other target: the caller does not know it is a Farm.
  @Test
  void farmCanBeHitAsADamageable() {
    Damageable target = new Farm(100);

    target.takeDamage(10);

    assertEquals(90, target.getHealth());
  }
}
