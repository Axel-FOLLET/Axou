package com.cropa.view;

/** A black overlay that clears as the newly displayed phase plays. */
public final class Transition {
    //-------------------- CONSTANTS --------------------
    private static final float DURATION = 0.4f;

    //-------------------- FIELDS --------------------
    // The overlay covers the same rectangle as the scene.
    private final Bounds world;
    // The first frame establishes the displayed scene.
    private Object previous;
    // Two images can belong to the same scene.
    private int previousImage;
    // The fade ends when its time runs out.
    private float remaining;

    //-------------------- CONSTRUCTOR --------------------
    /**
     * Creates a fade covering the given world.
     *
     * @param world the rectangle to fade
     */
    public Transition(Bounds world) {
        this.world = world;
    }

    //-------------------- TIME --------------------
    // The first frame establishes the starting screen without a transition.
    /**
     * Tracks the displayed scene and image after input and model updates.
     *
     * @param scene the displayed scene
     * @param image its zero-based image index
     * @param delta elapsed time in seconds
     */
    public void update(Object scene, int image, float delta) {
        if (previous != null && (scene != previous || image != previousImage)) {
            remaining = DURATION;
        } else {
            remaining = Math.max(0f, remaining - delta);
        }
        previous = scene;
        previousImage = image;
    }

    //-------------------- DRAWING --------------------
    // Draw last so even the labels fade with the image.
    /**
     * Draws the remaining black overlay.
     *
     * @param canvas where to draw
     */
    public void render(Canvas canvas) {
        if (remaining > 0f) {
            canvas.drawColorLayer(world, 0, 0, 0, remaining / DURATION);
        }
    }
}
