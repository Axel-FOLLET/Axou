package com.cropa.model.enemy;

// An enum: the only four directions old Garry can face, one per image of him standing (assets/farmer). No libGDX and
// no file name here: FarmRenderer turns a direction into a sprite key ("farmer_" + the name in lower case).
// East is the field, on the right of the screen; west is the farm, behind him; north and south are rows 1 and 3.
/**
 * A direction the farmer can face, as seen on the screen.
 */
public enum Facing {
    /** Towards row 1, at the top of the screen. */
    NORTH,
    /** Towards the field, where the enemies come from. */
    EAST,
    /** Towards row 3, at the bottom of the screen. */
    SOUTH,
    /** Towards the farm, behind him. */
    WEST
}
