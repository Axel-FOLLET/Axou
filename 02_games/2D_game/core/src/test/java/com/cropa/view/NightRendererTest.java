package com.cropa.view;

// JUnit: the checks the tests use, and the annotation that marks a test. Java: the expected list of calls.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;

// No window and no game: the renderer receives night or day and the time left, and draws on a RecordingCanvas.
// The fade lasts 3 s: with 1.5 s left, the phase is halfway through it, and half of 0.5 is 0.25.
/** Tests for {@link NightRenderer}. */
class NightRendererTest {

    //-------------------- FIELDS --------------------
    private static final Bounds WORLD = new Bounds(0, 0, 560, 320);
    private final RecordingCanvas canvas = new RecordingCanvas();
    private final NightRenderer renderer = new NightRenderer(WORLD);

    //-------------------- TESTS --------------------
    // 30 s left in the night: far from the dawn, the veil is at its darkest.
    @Test
    void coversTheWorldInTheMiddleOfTheNight() {
        renderer.render(canvas, true, 30f);

        assertEquals(List.of("veil " + WORLD + " 0.5"), canvas.calls);
    }

    // 30 s left in the day: nothing is drawn, not even an invisible veil.
    @Test
    void drawsNothingInTheMiddleOfTheDay() {
        renderer.render(canvas, false, 30f);

        assertTrue(canvas.calls.isEmpty());
    }

    // 1.5 s before the night: the dusk is halfway.
    @Test
    void halfDarkAtDusk() {
        renderer.render(canvas, false, 1.5f);

        assertEquals(List.of("veil " + WORLD + " 0.25"), canvas.calls);
    }

    // 1.5 s before the day: the dawn is halfway.
    @Test
    void halfDarkAtDawn() {
        renderer.render(canvas, true, 1.5f);

        assertEquals(List.of("veil " + WORLD + " 0.25"), canvas.calls);
    }
}
