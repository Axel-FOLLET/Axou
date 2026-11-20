package com.cropa.view;

// No import: it only receives plain values (night or day, the time left) and talks to Canvas.
// It does not read the cycle itself, so a test gives it any moment of the day without building a game.
/**
 * Darkens the world at night, with a fade at dusk and at dawn.
 */
public class NightRenderer {

    //-------------------- CONSTANTS --------------------
    // The darkest the night gets: half opaque, so the field, the enemies and the defenses stay readable.
    private static final float MAX_OPACITY = 0.5f;
    // The fade lasts the last 3 seconds of a phase: the night falls at the end of the day, and lifts at the end of the night.
    private static final float FADE_SECONDS = 3f;

    //-------------------- FIELDS --------------------
    // The whole world, 560 x 320: the veil covers everything, the HUD is drawn after it.
    private final Bounds world;

    //-------------------- CONSTRUCTOR --------------------
    // Called once by GameScreen.show().
    /**
     * Creates the renderer of the night.
     *
     * @param world the area the veil covers, in world pixels
     */
    public NightRenderer(Bounds world) {
        this.world = world;
    }

    //-------------------- DRAWING --------------------
    // Called on every frame by GameScreen, after the front trees and before the HUD.
    // fade goes from 1 (more than 3 s left) down to 0 (end of the phase). At night the darkness follows it down: the dawn.
    // By day it goes the other way, 1 - fade, from 0 up to 1: the dusk. Middle of the day: darkness 0, nothing is drawn.
    /**
     * Draws the night veil, if the moment of the cycle needs one.
     *
     * @param canvas where to draw
     * @param night {@code true} during a night
     * @param timeLeft the seconds left in the current phase
     */
    public void render(Canvas canvas, boolean night, float timeLeft) {
        float fade = Math.min(1f, timeLeft / FADE_SECONDS);
        float darkness = night ? fade : 1f - fade;
        if (darkness > 0) {
            canvas.drawNightVeil(world, MAX_OPACITY * darkness);
        }
    }
}
