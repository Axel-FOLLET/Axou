package com.cropa.view;

// An enum and not the Color of libGDX: the view names a color, and only view.gdx knows how to draw it.
// GREEN and YELLOW: the debug view of F1. WHITE: what the player can use now, the buttons of the shop and the free
// places of the zone he works on (ShopWindow.highlightedZone).
/**
 * The colors of the outlines.
 */
public enum OutlineColor {
    /** The cells of the field, in the debug view (F1). */
    GREEN,
    /** The defense slots, in the debug view (F1). */
    YELLOW,
    /** What the player can use now: the shop buttons and the free places of the zone he works on. */
    WHITE
}
