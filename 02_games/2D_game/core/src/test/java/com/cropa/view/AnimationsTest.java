package com.cropa.view;

import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;

class AnimationsTest {
    @Test
    void unknownSpritesLoopEveryFifteenHundredthsPerFrame() {
        assertTrue(Animations.loops("new"));
        assertEquals(0.15f, Animations.frameDuration("new", 3));
        assertEquals(0.45f, Animations.duration("new", 3), 0.00001f);
        assertEquals(1, Animations.frameAt("new", 3, 0.15f));
        assertEquals(0, Animations.frameAt("new", 3, 0.46f));
        assertEquals(0, Animations.frameAt("new", 3, -1f));
    }

    @Test
    void dirtUsesIndividualDurationsAndHoldsItsLastFrame() {
        assertFalse(Animations.loops("fx_dirt"));
        assertEquals(0.36f, Animations.duration("fx_dirt", 3), 0.00001f);
        assertEquals(1, Animations.frameAt("fx_dirt", 3, 0.08f));
        assertEquals(1, Animations.frameAt("fx_dirt", 3, 0.19f));
        assertEquals(2, Animations.frameAt("fx_dirt", 3, 4f));
    }
}
