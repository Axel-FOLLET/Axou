package com.cropa.view.fx;

/** Burst speed and downward acceleration are measured in world units and seconds. */
public enum Particle {
    DIRT("fx_dirt", 4, 36, 96),
    LEAF("fx_leaf", 4, 24, 44),
    COIN("fx_coin", 4, 40, 96),
    SMOKE("fx_smoke", 8, 10, 0);

    final String key;
    final float size;
    final float speed;
    final float gravity;

    Particle(String key, float size, float speed, float gravity) {
        this.key = key;
        this.size = size;
        this.speed = speed;
        this.gravity = gravity;
    }
}
