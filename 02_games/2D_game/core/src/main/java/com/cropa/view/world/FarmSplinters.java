package com.cropa.view.world;

import com.cropa.view.Bounds;
import com.cropa.view.Canvas;
import java.util.ArrayList;
import java.util.List;

/** Draws independent bursts of wooden fragments from the farm wall. */
public final class FarmSplinters {
    // Five trajectories fan out symmetrically from the wall, in world units.
    private static final int COUNT = 5;
    private static final float LIFE = .6f, SIZE = 4f, GRAVITY = 165f;
    private static final float SPREAD = 18f, LIFT = 52f, SPIN = 210f;
    private final List<Float> ages = new ArrayList<>();

    /** Starts a burst at the wall on this frame. */
    public void hit() {
        ages.add(0f);
    }

    /** Advances every burst, including overlapping hits. */
    public void advance(float delta) {
        for (int i = ages.size() - 1; i >= 0; i--) {
            float age = ages.get(i) + delta;
            if (age >= LIFE) ages.remove(i);
            else ages.set(i, age);
        }
    }

    /** Draws each fragment on its ballistic arc. */
    public void draw(Canvas canvas, Bounds wall) {
        for (float age : ages) {
            for (int i = 0; i < COUNT; i++) {
                int lane = i - COUNT / 2;
                float x = wall.x() + wall.width() / 2 + lane * (SIZE + SPREAD * age);
                float y = wall.y() + wall.height() / 2 + (LIFT - Math.abs(lane) * SIZE) * age
                        - GRAVITY * age * age / 2;
                canvas.drawParticle("farm_splinter", x, y, SIZE, lane * SPIN * age, 1f - age / LIFE);
            }
        }
    }
}
