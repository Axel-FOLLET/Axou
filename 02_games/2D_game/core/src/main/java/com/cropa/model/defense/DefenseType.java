package com.cropa.model.defense;

// The closed list of the kinds of defenses. An enum, not a String: a typo like "BRAMBEL" does not compile.
// DefenseConfig reads its numbers by type, and a Defense keeps its type to find them.
// Adding a defense starts here: DefenseConfigTest then fails until its numbers are written.
/**
 * The kinds of defenses of the game.
 */
public enum DefenseType {
    /** Sits on a defense slot and throws potatoes at the enemies in range. */
    CATAPATATE,
    /** Sits on a cell of the field and punches the enemies next to it. */
    SCARECROW,
    /** Grows on a cell of the field and hurts the enemies that cross it. */
    BRAMBLE
}
