package com.cropa.model.world;

// Whatever can take a hit: the farm, and the enemies (Yohan, on Enemy).
// The one who hits only knows this interface: a bramble hurts a witch without knowing it is a witch.
/**
 * Something that can take damage and has health left.
 */
public interface Damageable {

  // Called by whoever hits: an enemy on the farm, a defense on an enemy.
  /**
   * Removes health. Negative damage is ignored, and health never goes below 0.
   *
   * @param amount the damage dealt
   */
  void takeDamage(int amount);

  /**
   * Returns the health left.
   *
   * @return the current health, never negative
   */
  int getHealth();
}