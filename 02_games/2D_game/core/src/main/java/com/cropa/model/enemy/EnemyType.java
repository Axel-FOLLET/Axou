package com.cropa.model.enemy;

// The closed list of the kinds of enemies. An enum, not a String: a typo like "BATT" does not compile.
// EnemyConfig reads its numbers by type, WaveTable says which types come each night,
// and EnemyFactory turns a type into the right object (MOLE -> Mole, BAT -> Bat, WITCH -> Witch).
// Adding an enemy starts here: EnemyConfig then stops compiling until its numbers are written.
/**
 * The kinds of enemies of the game.
 */
public enum EnemyType {
    /** Moves underground and eats a random crop; never hits the farm. */
    MOLE,
    /** Flies fast along its row; blocked by garlic. */
    BAT,
    /** Walks slowly along its row and crushes crops; blocked by turnips. */
    WITCH
}
