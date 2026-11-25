package com.cropa.view.world;

import com.cropa.view.Bounds;
import com.cropa.view.Canvas;
import com.cropa.view.SpriteStyle;
import java.util.Random;

/** Draws the daytime visitors and the lights above the night veil. */
public final class LivingDecor {
    // Meadow strips above and below the field, clear of the house and status text.
    private static final float[] MEADOW_X = {228, 268, 305, 342};
    private static final float[] MEADOW_Y = {211, 119, 210, 117};
    private static final float WINGS = 8f, GLOW = 4f, DRIFT_X = 12f, DRIFT_Y = 6f;
    // Cloud enters fully from the west before wrapping past the right of the map.
    private static final float WIDTH = 560f, CLOUD_W = 96f, CLOUD_H = 48f;
    private static final float CLOUD_Y = 140f, CLOUD_SPEED = 9f, CLOUD_ALPHA = 1f;
    private static final float FADE_SECONDS = 1f;
    private static final int LIGHTS = 10;
    private final float[] phases = new float[LIGHTS];
    private float clock, phaseAge;
    private boolean lastNight;

    /** Seeds the insect trajectories once so every visit can be replayed. */
    public LivingDecor() {
        Random random = new Random(21);
        for (int i = 0; i < phases.length; i++) phases[i] = random.nextFloat() * (float) (2 * Math.PI);
    }

    /** Advances the scenery clock and paints the day layer below the HUD. */
    public void renderDay(Canvas canvas, boolean night, float left, float delta) {
        clock += delta;
        phaseAge = (night == lastNight ? phaseAge : 0f) + delta;
        lastNight = night;
        if (night) return;
        float alpha = opacity(left);
        float x = (WIDTH / 2 + clock * CLOUD_SPEED) % (WIDTH + CLOUD_W) - CLOUD_W;
        canvas.drawSprite("cloud_shadow", new Bounds(x, CLOUD_Y, CLOUD_W, CLOUD_H), clock,
                SpriteStyle.NORMAL.withAlpha(CLOUD_ALPHA * alpha));
        for (int i = 0; i < MEADOW_X.length; i++) {
            float phase = phases[i] + clock;
            Bounds area = new Bounds(MEADOW_X[i] + DRIFT_X * sin(phase),
                    MEADOW_Y[i] + DRIFT_Y * sin(phase + sin(phase)), WINGS, WINGS);
            canvas.drawSprite(i % 2 == 0 ? "butterfly" : "butterfly_blue", area, phase,
                    SpriteStyle.NORMAL.withAlpha(alpha));
        }
    }

    /** Draws ten slowly drifting, pulsing lights after the veil. */
    public void renderLights(Canvas canvas, boolean night, float left) {
        if (!night) return;
        for (int i = 0; i < LIGHTS; i++) {
            float phase = phases[i] + clock / 2;
            int meadow = i % MEADOW_X.length;
            float x = MEADOW_X[meadow] + DRIFT_X * sin(phase);
            float y = MEADOW_Y[meadow] + DRIFT_Y * sin(phase + phases[i]);
            canvas.drawLight("firefly", new Bounds(x, y, GLOW, GLOW),
                    opacity(left) * (.65f + .35f * sin(phase)));
        }
    }

    private float opacity(float left) {
        return Math.max(0f, Math.min(1f, Math.min(phaseAge, left) / FADE_SECONDS));
    }

    private static float sin(float phase) {
        return (float) Math.sin(phase);
    }
}
