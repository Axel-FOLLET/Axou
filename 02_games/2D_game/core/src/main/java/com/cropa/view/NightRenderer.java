package com.cropa.view;

// No import: the cycle supplies plain values and Canvas handles the drawing.
// One renderer belongs to one screen, so a new game starts at its own light level.
/**
 * Tints the world at dusk, at night and at dawn, and lights the farm window.
 */
public class NightRenderer {

    //-------------------- CONSTANTS --------------------
    // A full change of light takes three seconds, even when the cycle skips ahead.
    private static final float FADE_SECONDS = 3f;
    // Darkness increases at dusk and decreases at dawn. These are the peaks of the passing colours.
    private static final float ORANGE_AT = 0.25f;
    private static final float VIOLET_AT = 0.625f;
    private static final float DAWN_GOLD_AT = 0.5f;
    // At full night, output = a * daylight + b: a=(0.360, 0.310, 0.740), b=(0.000, 0.070, 0.120).
    private static final float NIGHT_RED = 0.45f;
    private static final float NIGHT_GREEN = 0.3875f;
    private static final float NIGHT_BLUE = 0.925f;
    // Overlay colours and their opacity at the turning points of the cycle.
    private static final TintLayer CLEAR = new TintLayer(1f, 1f, 1f, 0f);
    private static final TintLayer ORANGE = new TintLayer(1f, 0.48f, 0.16f, 0.25f);
    private static final TintLayer VIOLET = new TintLayer(0.60f, 0.29f, 0.94f, 0.34f);
    private static final TintLayer MOONLIGHT = new TintLayer(0f, 0.35f, 0.60f, 0.20f);
    private static final TintLayer DAWN_GOLD = new TintLayer(1f, 0.65f, 0.48f, 0.20f);
    // The warm sprite has a transparent rim; its additive centre stays below full strength.
    private static final float WINDOW_SIZE = 46f;
    private static final float WINDOW_ALPHA = 0.85f;
    // Amber tint for the halo drawn on the wall around the panes.
    private static final float HALO_RED = 1f;
    private static final float HALO_GREEN = 0.58f;
    private static final float HALO_BLUE = 0.18f;

    //-------------------- FIELDS --------------------
    // The filters cover the map; the two lights stay on their own small patches.
    private final Bounds world;
    private final Bounds window;
    private final Bounds moon;
    // A negative value means this screen has not drawn a frame yet. Keep the last direction while paused.
    private float darkness = -1f;
    private boolean dawn;

    //-------------------- CONSTRUCTOR --------------------
    // Called once by GameScreen.show().
    /**
     * Creates the lighting for the map.
     *
     * @param world the area to tint, in world pixels
     * @param windowCenter the centre of the farm window, in world pixels
     */
    public NightRenderer(Bounds world, Point windowCenter) {
        this.world = world;
        window = Bounds.centeredOn(windowCenter, WINDOW_SIZE);
        // Graze the upper-left canopy with a short, cool pool of moonlight.
        moon = new Bounds(world.x() + 48f, world.y() + world.height() - 72f, 80f, 32f);
    }

    //-------------------- DRAWING --------------------
    // fade drops from 1 to 0 in the last three seconds. By day the target is 1 - fade (dusk); at night it is fade (dawn).
    // A click or a defeated wave can jump the target. Follow it by at most delta / FADE_SECONDS per frame.
    /**
     * Draws the light for this moment of the cycle.
     *
     * @param canvas where to draw
     * @param night {@code true} during a night
     * @param timeLeft the seconds left in the current phase
     * @param delta the seconds elapsed since the previous frame
     */
    public void render(Canvas canvas, boolean night, float timeLeft, float delta) {
        renderBase(canvas, night, timeLeft, delta);
        renderLights(canvas);
    }

    /** Per-channel scale and offset for straight RGB; sprite alpha is preserved. */
    public record Grade(float r, float g, float b, float addR, float addG, float addB) {}

    /**
     * Advances the cycle once and filters the background already on the canvas.
     * @param canvas the world canvas
     * @param night whether the model is in its night phase
     * @param timeLeft seconds left in the phase
     * @param delta elapsed seconds
     * @return the same transform for later scenery, or null in full daylight
     */
    public Grade renderBase(Canvas canvas, boolean night, float timeLeft, float delta) {
        float fade = Math.max(0f, Math.min(1f, timeLeft / FADE_SECONDS));
        float target = night ? fade : 1f - fade;
        if (darkness < 0f) {
            // Adopt the current light immediately, including when the first frame is already mid-transition.
            darkness = target;
            dawn = night;
        } else if (delta > 0f && target != darkness) {
            // Choose the sky from the movement: after a short night the model already says day.
            dawn = target < darkness;
            float step = delta / FADE_SECONDS;
            darkness = dawn ? Math.max(target, darkness - step) : Math.min(target, darkness + step);
        }
        if (darkness == 0f) {
            return null;
        }
        // Use the same two layers for the background and the scenery drawn over it.
        float r = mix(1f, NIGHT_RED, darkness);
        float g = mix(1f, NIGHT_GREEN, darkness);
        float b = mix(1f, NIGHT_BLUE, darkness);
        TintLayer sky = sky();
        canvas.drawMultiplyLayer(world, r, g, b);
        canvas.drawColorLayer(world, sky.red(), sky.green(), sky.blue(), sky.alpha());
        float keep = 1f - sky.alpha();
        return new Grade(r * keep, g * keep, b * keep,
                sky.red() * sky.alpha(), sky.green() * sky.alpha(), sky.blue() * sky.alpha());
    }

    /**
     * Keeps clothing, skin and fur readable as darkness increases.
     * @return the character RGB transform for the current frame
     */
    public Grade characterGrade() {
        float amount = Math.max(0f, darkness);
        return new Grade(mix(1f, 0.80f, amount), mix(1f, 0.84f, amount), mix(1f, 0.92f, amount), 0, 0, 0);
    }

    private TintLayer sky() {
        if (dawn) {
            if (darkness <= DAWN_GOLD_AT) {
                return tint(CLEAR, DAWN_GOLD, darkness / DAWN_GOLD_AT);
            } else {
                return tint(DAWN_GOLD, MOONLIGHT, (darkness - DAWN_GOLD_AT) / (1f - DAWN_GOLD_AT));
            }
        } else if (darkness <= ORANGE_AT) {
            return tint(CLEAR, ORANGE, darkness / ORANGE_AT);
        } else if (darkness <= VIOLET_AT) {
            return tint(ORANGE, VIOLET, (darkness - ORANGE_AT) / (VIOLET_AT - ORANGE_AT));
        } else {
            return tint(VIOLET, MOONLIGHT, (darkness - VIOLET_AT) / (1f - VIOLET_AT));
        }
    }

    /**
     * Adds local lights after all the world layers have been drawn.
     * @param canvas the world canvas
     */
    public void renderLights(Canvas canvas) {
        if (darkness <= 0f) {
            return;
        }
        canvas.drawLight("light_soft", moon, 0.12f * darkness, 0.67f, 0.78f, 0.88f);
        canvas.drawLight("light_window", window, WINDOW_ALPHA * darkness, HALO_RED, HALO_GREEN, HALO_BLUE);
    }

    //-------------------- INTERNALS --------------------
    // Independent RGB and alpha values for one sky colour.
    private record TintLayer(float red, float green, float blue, float alpha) {}

    // Interpolate the sky once for both rendering paths.
    private TintLayer tint(TintLayer from, TintLayer to, float progress) {
        return new TintLayer(mix(from.red(), to.red(), progress), mix(from.green(), to.green(), progress),
                mix(from.blue(), to.blue(), progress), mix(from.alpha(), to.alpha(), progress));
    }

    // A weighted sum keeps both endpoints exact, including at the day/night boundary.
    private static float mix(float from, float to, float progress) {
        return (1f - progress) * from + progress * to;
    }
}
