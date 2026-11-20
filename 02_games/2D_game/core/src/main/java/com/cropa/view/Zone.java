package com.cropa.view;

// The two places where the player puts something: the cells of the field (crops, scarecrow, bramble) and the slots
// around it (catapatate). ShopWindow says which one the player is working on; OutlineRenderer draws its free places.
/**
 * A part of the board whose free places can be shown to the player.
 */
public enum Zone {
    /** The 15 cells of the field. */
    FIELD,
    /** The 10 defense slots, above and under the field. */
    SLOTS
}
