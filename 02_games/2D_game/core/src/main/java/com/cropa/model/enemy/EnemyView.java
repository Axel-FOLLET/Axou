package com.cropa.model.enemy;

// What the view is allowed to read from an enemy, and nothing more: no takeDamage, no flee, no update.
// EnemyRenderer receives EnemyView objects, so the compiler forbids it to change the model.
// Enemy implements it; a new enemy only has to give its spriteKey to be drawn.
/**
 * The read-only face of an enemy, as the view sees it.
 */
public interface EnemyView {

    /**
     * Returns the row the enemy is on.
     *
     * @return the row, from 1 to 3 on the field, 0 and 4 for the flee rows
     */
    int getRow();

    /**
     * Returns the number of cells left between the enemy and the farm.
     *
     * @return the cells left: 10 at the entry of the row, 0 in front of the farm
     */
    float getCellsToFarm();

    /**
     * Returns the key of the sprite to draw, as listed in the sprite catalog of the view.
     *
     * @return the sprite key, for example {@code "bat"} or {@code "bat_attack"}
     */
    String spriteKey();

    /**
     * Tells whether the enemy is still on the board: neither dead nor fled.
     *
     * @return {@code true} if the enemy must be drawn
     */
    boolean isOnBoard();

    // Read by EnemyRenderer to turn the enemy red for a short instant when it drops. Enemy already has it (Damageable).
    /**
     * Returns the current health of the enemy.
     *
     * @return the current health, never negative
     */
    int getHealth();
}
