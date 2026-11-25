package com.cropa.view;

import com.cropa.text.Language;
import com.cropa.text.Texts;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/** Checks the overlays against the same world used by the scenes. */
class ScreenEffectsTest {
    private static final Bounds WORLD = new Bounds(0, 0, 560, 320);

    // An image change restarts a running fade, even in the same cinematic.
    @Test
    void fadeTracksSceneAndImage() {
        Transition fade = new Transition(WORLD);
        RecordingCanvas canvas = new RecordingCanvas();
        Object title = new Object();
        Object intro = new Object();
        fade.update(title, 0, 1f);
        fade.render(canvas);
        assertTrue(canvas.extras.isEmpty());
        fade.update(intro, 0, 1f);
        fade.render(canvas);
        assertEquals("color " + WORLD + " 0.0 0.0 0.0 1.0", canvas.extras.get(0));
        fade.update(intro, 0, 0.2f);
        fade.render(canvas);
        assertTrue(canvas.extras.get(1).endsWith(" 0.5"));
        fade.update(intro, 1, 0.1f);
        fade.render(canvas);
        assertEquals(canvas.extras.get(0), canvas.extras.get(2));
        fade.update(intro, 1, 0.4f);
        fade.render(canvas);
        assertEquals(3, canvas.extras.size());
    }

    // The first wave has only bats; a configured final night uses its own wave.
    @Test
    void duskShowsOnlyPresentEnemiesAndFadesWithTheirCounts() {
        Texts texts = Texts.of(Language.ENGLISH);
        NightCard card = new NightCard(WORLD, TestLayouts.layout(), 3, texts);
        RecordingCanvas canvas = new RecordingCanvas();
        card.onNightStarted(1);
        card.update(0.15f);
        card.render(canvas);
        assertTrue(canvas.extras.stream().anyMatch(s -> s.startsWith("float Night 1 ") && s.endsWith("0.5 NORMAL")));
        assertTrue(canvas.extras.stream().anyMatch(s -> s.startsWith("float 2 ")));
        assertEquals(1L, canvas.extras.stream().filter(s -> s.startsWith("styled ")).count());
        assertTrue(canvas.extras.stream().anyMatch(s -> s.startsWith("styled bat ") && s.contains(" 0.0 ")));
        card.onNightStarted(3);
        card.update(1f);
        canvas.extras.clear();
        card.render(canvas);
        assertTrue(canvas.extras.stream().anyMatch(s -> s.startsWith("float Last night! ")));
        for (String key : new String[]{"mole", "bat", "witch"}) {
            assertTrue(canvas.extras.stream().anyMatch(s -> s.startsWith("styled " + key + " ")));
        }
        assertTrue(canvas.extras.stream().anyMatch(s -> s.startsWith("float 5 ")));
        card.update(0.8f);
        canvas.extras.clear();
        card.render(canvas);
        assertFalse(canvas.extras.stream().anyMatch(s -> s.startsWith("float ") && s.endsWith("1.0 NORMAL")));
        card.update(0.3f);
        canvas.extras.clear();
        card.render(canvas);
        assertTrue(canvas.extras.isEmpty());
    }
}
