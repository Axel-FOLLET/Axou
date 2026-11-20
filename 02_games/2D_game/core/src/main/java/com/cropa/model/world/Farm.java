package com.cropa.model.world;

// The farm on the left of the board: enemies that reach it hit it, and the game is lost at 0 health.
// Its health is given by whoever creates it (EnemyConfig.getFarmHealth(), 150 in the rules).
/**
 * The farm the player defends. Its health only goes down: it is never repaired.
 */
public class Farm implements Damageable {

    //-------------------- STATE --------------------
    // Current health, between 0 and the starting value.
    private int health;

    //-------------------- CONSTRUCTOR --------------------
    /**
     * Creates a farm with its starting health.
     *
     * @param health the starting health of the farm (150 in the rules)
     */
    public Farm(int health) {
        this.health = health;
    }

    //-------------------- ACTIONS --------------------
    // Negative damage is ignored: otherwise it would heal the farm, and the farm is never repaired.
    // Math.max(0, ...) keeps health at 0 instead of going negative: the HUD never shows a negative number.
    /**
     * Removes health from the farm.
     *
     * <p>Health never goes below 0: a hit stronger than the remaining health leaves the farm at 0.
     * Negative damage is ignored, so the farm is never healed.
     *
     * @param amount the damage dealt; ignored if negative
     */
    @Override
    public void takeDamage(int amount) {
        if (amount < 0) {
            return;
        }
        health = Math.max(0, health - amount);
    }

    //-------------------- QUERIES --------------------
    /**
     * Returns the current health of the farm.
     *
     * @return the current health, never negative
     */
    @Override
    public int getHealth() {
        return health;
    }

    // At 0 health the game is lost (rules, §2, defeat 1).
    /**
     * Tells whether the farm has no health left.
     *
     * @return {@code true} if the health is 0
     */
    public boolean isDestroyed() {
        return health == 0;
    }
}
