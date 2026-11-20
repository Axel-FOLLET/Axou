package com.cropa.model.defense;

// JUnit: the three checks the tests use, and the annotation that marks a test.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

// No extends: JUnit finds the tests through @Test. No libGDX here: the model is tested without a window.
/** Tests for {@link Durability}. */
class DurabilityTest {

    //-------------------- TESTS --------------------
    // A new defense is in perfect state.
    @Test
    void startsAtOneHundredPercent() {
        Durability condition = new Durability();

        assertEquals(100, condition.getPercent());
    }

    // A bramble loses 20 % each time an enemy crosses it.
    @Test
    void wearLowersThePercent() {
        Durability condition = new Durability();
        condition.wear(20);

        assertEquals(80, condition.getPercent());
    }

    // Without this test, the durability bar could show a negative number.
    @Test
    void percentNeverGoesBelowZero() {
        Durability condition = new Durability();
        condition.wear(150);

        assertEquals(0, condition.getPercent());
    }

    // Without this test, a negative wear would repair the defense above 100 %.
    @Test
    void negativeWearIsIgnored() {
        Durability condition = new Durability();
        condition.wear(-10);

        assertEquals(100, condition.getPercent());
    }

    // At 1 %, the defense still stands.
    @Test
    void isNotZeroWhileSomePercentRemains() {
        Durability condition = new Durability();
        condition.wear(99);

        assertFalse(condition.isZero());
    }

    // At 0 %, the defense is destroyed (rules, section 7).
    @Test
    void isZeroWhenFullyWorn() {
        Durability condition = new Durability();
        condition.wear(100);

        assertTrue(condition.isZero());
    }

    // Upgrading a defense puts its durability back to 100 % (rules, section 7).
    @Test
    void resetGoesBackToOneHundredPercent() {
        Durability condition = new Durability();
        condition.wear(70);
        condition.reset();

        assertEquals(100, condition.getPercent());
    }
}
