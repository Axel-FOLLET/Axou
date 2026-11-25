package com.cropa.view.fx;

import com.cropa.view.Canvas;
import com.cropa.view.TextStyle;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/** Short-lived effects. Only update advances them, so a paused game keeps the same pose. */
public final class Effects {
    public static final float SMALL_SHAKE = 1.5f;
    public static final float BIG_SHAKE = 3f;

    private abstract static class Timed {
        float age;
        final float life;

        Timed(float delay, float life) {
            age = 0f - delay;
            this.life = life;
        }

        boolean advance(float delta) {
            age += delta;
            return age >= life;
        }
    }

    private static final class Speck extends Timed {
        final Particle kind;
        final float x, y, vx, vy, gravity, spin;

        Speck(Particle kind, float x, float y, float vx, float vy, float gravity,
              float spin, float delay, float life) {
            super(delay, life);
            this.kind = kind;
            this.x = x;
            this.y = y;
            this.vx = vx;
            this.vy = vy;
            this.gravity = gravity;
            this.spin = spin;
        }

        void draw(Canvas canvas) {
            if (age < 0) return;
            float fraction = age / life;
            float size = kind == Particle.SMOKE ? kind.size * (1 + fraction) : kind.size;
            canvas.drawParticle(kind.key, x + vx * age, y + vy * age - gravity * age * age / 2,
                    size, spin * age, 1 - fraction);
        }
    }

    private static final class NumberText extends Timed {
        final String text;
        final float x, y;
        final TextStyle style;

        NumberText(String text, float x, float y, TextStyle style) {
            super(0, 0.9f);
            this.text = text;
            this.x = x;
            this.y = y;
            this.style = style;
        }
    }

    private final Random random;
    private final List<Speck> particles = new ArrayList<>();
    private final List<NumberText> texts = new ArrayList<>();
    private float pendingShake;

    public Effects(Random random) {
        this.random = random;
    }

    public void burst(Particle kind, float x, float y, int count) {
        for (int i = 0; i < count; i++) {
            float vx = (2 * random.nextFloat() - 1) * kind.speed;
            float vy = (0.5f + random.nextFloat()) * kind.speed;
            float spin = (2 * random.nextFloat() - 1) * 240;
            particles.add(new Speck(kind, x, y, vx, vy, kind.gravity, spin, 0, 0.5f + 0.4f * random.nextFloat()));
        }
    }

    public void coinsTo(float fromX, float fromY, float toX, float toY, int count) {
        for (int i = 0; i < count; i++) {
            float life = 0.6f + 0.2f * random.nextFloat();
            float height = 12 + 8 * random.nextFloat();
            // The arc adds 4 * height * t * (1 - t) to the straight path, with t from 0 to 1.
            particles.add(new Speck(Particle.COIN, fromX, fromY, (toX - fromX) / life,
                    (toY - fromY + 4 * height) / life, 8 * height / (life * life), 360, i * 0.05f, life));
        }
    }

    public void floatText(String text, float centerX, float y, TextStyle style) {
        texts.add(new NumberText(text, centerX, y, style));
    }

    public void shake(float strength) {
        pendingShake = Math.max(pendingShake, strength);
    }

    public void update(float delta) {
        if (delta <= 0) return;
        particles.removeIf(particle -> particle.advance(delta));
        texts.removeIf(text -> text.advance(delta));
    }

    public void renderParticles(Canvas canvas) {
        for (Speck particle : particles) particle.draw(canvas);
    }

    public void renderTexts(Canvas canvas) {
        for (NumberText text : texts) {
            float fraction = text.age / text.life;
            canvas.drawFloatingText(text.text, text.x, text.y + 12 * fraction, 1 - fraction, text.style);
        }
        if (pendingShake > 0) {
            canvas.shake(pendingShake);
            pendingShake = 0;
        }
    }

    public boolean isEmpty() {
        return particles.isEmpty() && texts.isEmpty() && pendingShake == 0;
    }
}
