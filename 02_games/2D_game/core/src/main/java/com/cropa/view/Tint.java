package com.cropa.view;

// An enum and not the Color of libGDX, like OutlineColor: the view names a tint, and only view.gdx knows how to apply it.
/**
 * How a sprite is colored when it is drawn.
 */
public enum Tint {
    // The image as it is.
    /** The image as it is, without tint. */
    NORMAL,
    // Red, for a short instant after a hit.
    /** Red, just after a hit. */
    HURT,
    // Blue, for a short instant after an upgrade.
    /** Blue, just after an upgrade. */
    UPGRADED,
    // The image as it is, partly transparent: the ghost defense of the tutorial (day 14), which shows a defense that
    // is not in the game.
    /** The image as it is, partly transparent: a defense shown, not placed. */
    GHOST
}
