package com.cropa.view.fx;

import static org.junit.jupiter.api.Assertions.*;
import com.cropa.view.RecordingCanvas;
import com.cropa.view.TextStyle;
import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.Test;

class EffectsTest {
    private final RecordingCanvas canvas = new RecordingCanvas();
    private final Effects effects = new Effects(new Random() {
        @Override public float nextFloat() { return 0.5f; }
    });

    @Test
    void burstsStayStillWhenPausedThenRiseTurnFadeAndExpire() {
        effects.burst(Particle.DIRT, 4, 8, 1);
        effects.burst(Particle.SMOKE, 4, 8, 1);
        effects.renderParticles(canvas);
        var first = List.copyOf(canvas.extras);
        effects.update(0);
        canvas.extras.clear();
        effects.renderParticles(canvas);
        assertEquals(first, canvas.extras);
        canvas.extras.clear();
        effects.update(0.25f);
        effects.renderParticles(canvas);
        assertTrue(canvas.extras.get(0).startsWith("particle fx_dirt 4.0 14.0 4.0 "));
        String[] smoke = canvas.extras.get(1).split(" ");
        assertEquals(10.5f, Float.parseFloat(smoke[3]));
        assertTrue(Float.parseFloat(smoke[4]) > 8);
        assertTrue(Float.parseFloat(smoke[6]) < 1);
        effects.update(0.66f);
        assertTrue(effects.isEmpty());
    }

    @Test
    void coinsStartApartAndPassAboveTheStraightLine() {
        effects.coinsTo(2, 4, 22, 14, 2);
        effects.renderParticles(canvas);
        assertEquals(List.of("particle fx_coin 2.0 4.0 4.0 0.0 1.0"), canvas.extras);
        canvas.extras.clear();
        effects.update(0.35f);
        effects.renderParticles(canvas);
        assertEquals(2, canvas.extras.size());
        String[] first = canvas.extras.get(0).split(" ");
        assertEquals(12, Float.parseFloat(first[2]), 0.001);
        assertEquals(25, Float.parseFloat(first[3]), 0.001);
        assertTrue(Float.parseFloat(canvas.extras.get(1).split(" ")[2]) < 12);
        effects.update(0.5f);
        assertTrue(effects.isEmpty());
    }

    @Test
    void numbersRiseAndShakeIsDeliveredOnceAfterTheText() {
        assertTrue(effects.isEmpty());
        effects.floatText("+5", 3, 10, TextStyle.RIPE);
        effects.shake(Effects.BIG_SHAKE);
        effects.shake(Effects.SMALL_SHAKE);
        effects.update(0.45f);
        effects.renderParticles(canvas);
        assertTrue(canvas.extras.isEmpty());
        assertFalse(effects.isEmpty());
        effects.renderTexts(canvas);
        assertEquals(List.of("float +5 3.0 16.0 0.5 RIPE", "shake 3.0"), canvas.extras);
        canvas.extras.clear();
        effects.renderTexts(canvas);
        assertEquals(List.of("float +5 3.0 16.0 0.5 RIPE"), canvas.extras);
        effects.update(0.45f);
        assertTrue(effects.isEmpty());
    }
}
