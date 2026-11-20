package com.cropa.view;

// An enum and not the Color of libGDX, like OutlineColor: the view names a style, and only view.gdx knows how to draw it.
/**
 * How a line of text is drawn.
 */
public enum TextStyle {
    /** White: the usual text. */
    NORMAL,
    /** Grey: a choice that is not the current one, or that cannot be used now. */
    GREYED,
    /** Red: a warning the player must not miss, like the last night. */
    ALERT,
    /** Red: a crop that is still a seed (also the color of its dot, see {@link Growth}). */
    SEED,
    /** Orange: a crop that grows but is not ripe yet. */
    GROWING,
    /** Green: a ripe crop, worth its full price. */
    RIPE
}
