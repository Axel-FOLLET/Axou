package com.cropa.view;

// JUnit: the checks and the annotation that marks a test. Java: the recorded calls and their numeric arguments.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.StringTokenizer;
import org.junit.jupiter.api.Test;

// No window and no game: the renderer receives the phase and draws on a RecordingCanvas.
/** Tests for {@link NightRenderer}. */
class NightRendererTest {

    //-------------------- FIELDS --------------------
    private static final Bounds WORLD = new Bounds(0, 0, 560, 320);
    // An off-centre window also checks that the halo follows the point passed by the farm.
    private static final Point WINDOW = new Point(173.75f, 96.25f);
    private static final Bounds HALO = new Bounds(150.75f, 73.25f, 46f, 46f);
    private static final Bounds MOON = new Bounds(48, 248, 80, 32);
    private final RecordingCanvas canvas = new RecordingCanvas();
    private final NightRenderer renderer = new NightRenderer(WORLD, WINDOW);

    //-------------------- TESTS --------------------
    // Both layers cover the world; the warm window is the last call.
    @Test
    void coversTheWorldInTheMiddleOfTheNight() {
        renderer.render(canvas, true, 30f, 0f);

        assertTrue(canvas.calls.isEmpty());
        assertEquals(List.of("multiply " + WORLD + " 0.45 0.3875 0.925",
                "color " + WORLD + " 0.0 0.35 0.6 0.2",
                "light light_soft " + MOON + " 0.12 0.67 0.78 0.88",
                "light light_window " + HALO + " 0.85 1.0 0.58 0.18"), canvas.extras);
    }

    // Full daylight, including the first instant of dusk, leaves every pixel alone.
    @Test
    void drawsNothingInTheMiddleOfTheDay() {
        renderer.render(canvas, false, 30f, 0f);
        renderer.render(canvas, false, 3f, 0f);

        assertTrue(canvas.calls.isEmpty());
        assertTrue(canvas.extras.isEmpty());
    }

    // At the midpoint the multiplier is halfway from white and the halo is half strength.
    @Test
    void halfDarkAtDusk() {
        renderer.render(canvas, false, 3f, 0f);
        renderer.render(canvas, false, 1.5f, 1.5f);

        assertHalfDark();
    }

    // Dawn passes through rose-gold with half the night light, then fades out completely.
    @Test
    void halfDarkAtDawn() {
        renderer.render(canvas, true, 1.5f, 0f);

        assertHalfDark();
        assertEquals("color " + WORLD + " 1.0 0.65 0.48 0.2", canvas.extras.get(1));
        canvas.extras.clear();
        renderer.render(canvas, true, 0f, 1.5f);
        assertTrue(canvas.calls.isEmpty());
        assertTrue(canvas.extras.isEmpty());
    }

    // Check what both layers do to a neutral grey surface as the sun sets.
    @Test
    void duskTurnsOrangeThenVioletThenBlue() {
        float[] orange = greyAtDusk(2.25f);
        float[] violet = greyAtDusk(1.125f);
        float[] blue = greyAtDusk(0f);

        assertTrue(orange[0] > orange[1] && orange[1] > orange[2]);
        assertTrue(violet[2] > violet[0] && violet[0] > violet[1]);
        assertTrue(blue[2] > blue[1] && blue[1] > blue[0]);
    }

    // The last frame of dusk and the first frame of night agree, including the halo.
    @Test
    void haloStaysCentredAcrossNightfall() {
        renderer.render(canvas, false, 0f, 0f);
        List<String> dusk = List.copyOf(canvas.extras);
        canvas.extras.clear();
        renderer.render(canvas, true, 3f, 0f);

        assertEquals("light light_window " + HALO + " 0.85 1.0 0.58 0.18", dusk.get(3));
        assertEquals(dusk, canvas.extras);
    }

    // Clicking the button jumps the model straight to night. Each frame still has its own light level.
    @Test
    void startingNightEarlyShowsOrangeThenVioletBeforeMoonlight() {
        renderer.render(canvas, false, 30f, 0f);
        assertEquals("color " + WORLD + " 1.0 0.48 0.16 0.25", skyAfter(true, 40f, 0.75f));
        assertEquals("color " + WORLD + " 0.6 0.29 0.94 0.34", skyAfter(true, 39f, 1.125f));
        assertEquals("color " + WORLD + " 0.0 0.35 0.6 0.2", skyAfter(true, 38f, 1.125f));
    }

    // The wave ends with twelve seconds left. Gold is visible even though the new phase is already day.
    @Test
    void endingNightEarlyShowsDawnForThreeSeconds() {
        renderer.render(canvas, true, 12f, 0f);
        skyAfter(false, 60f, 0.75f);
        assertEquals("color " + WORLD + " 1.0 0.65 0.48 0.2", skyAfter(false, 59f, 0.75f));
        assertHalfDark();
        List<String> halfway = List.copyOf(canvas.extras);
        skyAfter(false, 59f, 0f);
        assertEquals(halfway, canvas.extras);
        canvas.extras.clear();
        renderer.render(canvas, false, 57f, 1.5f);
        assertTrue(canvas.extras.isEmpty());
    }

    // GameScreen.show creates a fresh renderer, including when returning from the title.
    @Test
    void firstFrameAdoptsItsTargetWithoutAStartUpFade() {
        renderer.render(canvas, true, 30f, 0f);
        canvas.extras.clear();
        new NightRenderer(WORLD, WINDOW).render(canvas, false, 1.5f, 0f);
        assertHalfDark();
    }

    // Character colours cool gradually and return to daylight at dawn.
    @Test
    void charactersFollowTheSameFadeWithALighterTint() {
        renderer.render(canvas, false, 30f, 0f);
        assertEquals(new NightRenderer.Grade(1, 1, 1, 0, 0, 0), renderer.characterGrade());
        renderer.render(canvas, true, 30f, 3f);
        assertEquals(new NightRenderer.Grade(0.80f, 0.84f, 0.92f, 0, 0, 0), renderer.characterGrade());
        renderer.render(canvas, false, 30f, 1.5f);
        assertEquals(0.90f, renderer.characterGrade().r(), 0.0001f);
        assertEquals(0.92f, renderer.characterGrade().g(), 0.0001f);
        assertEquals(0.96f, renderer.characterGrade().b(), 0.0001f);
    }

    //-------------------- INTERNALS --------------------
    // Read only the sky drawn in this frame, keeping the renderer's history from previous frames.
    private String skyAfter(boolean night, float timeLeft, float delta) {
        canvas.extras.clear();
        renderer.render(canvas, night, timeLeft, delta);
        return canvas.extras.get(1);
    }

    // At either midpoint, red is halfway between the daylight and full-night multipliers.
    private void assertHalfDark() {
        assertTrue(canvas.calls.isEmpty());
        assertEquals(0.725f, values(0, "multiply", 3)[0], 0.0001f);
        assertEquals("light light_soft " + MOON + " 0.06 0.67 0.78 0.88", canvas.extras.get(2));
        assertEquals("light light_window " + HALO + " 0.425 1.0 0.58 0.18", canvas.extras.get(3));
    }

    // Apply the recorded multiplier and alpha blend to grey (0.5 in every channel).
    private float[] greyAtDusk(float timeLeft) {
        canvas.extras.clear();
        renderer.render(canvas, false, timeLeft, 3f);
        float[] rgb = values(0, "multiply", 3);
        float[] sky = values(1, "color", 4);
        for (int i = 0; i < rgb.length; i++) {
            rgb[i] = 0.5f * rgb[i] * (1f - sky[3]) + sky[i] * sky[3];
        }
        return rgb;
    }

    // Bounds contains spaces, so skip the entire expected prefix before reading the numbers.
    private float[] values(int index, String operation, int count) {
        String line = canvas.extras.get(index);
        String prefix = operation + " " + WORLD + " ";
        assertTrue(line.startsWith(prefix));
        StringTokenizer tokens = new StringTokenizer(line.substring(prefix.length()));
        float[] result = new float[count];
        for (int i = 0; i < count; i++) {
            result[i] = Float.parseFloat(tokens.nextToken());
        }
        return result;
    }
}
