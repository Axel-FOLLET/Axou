package com.cropa.view;

// JUnit: the check the tests use, and the annotation that marks a test.
import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

// Plain objects stand for the farm and the enemies: HitFlash only needs something to tell them apart.
/** Tests for {@link HitFlash}. */
class HitFlashTest {

    //-------------------- FIELDS --------------------
    private static final float FRAME = 0.016f;
    private final HitFlash flash = new HitFlash();
    private final Object farm = new Object();

    //-------------------- TESTS --------------------
    // First sight: no previous value to compare with, so no red, even at 50.
    @Test
    void neverRedAtFirstSight() {
        assertEquals(Tint.NORMAL, flash.tintOf(farm, 50, FRAME));
    }

    // 100 then 95: the farm was just hit.
    @Test
    void redWhenTheValueDrops() {
        flash.tintOf(farm, 100, FRAME);

        assertEquals(Tint.HURT, flash.tintOf(farm, 95, FRAME));
    }

    // The red lasts 0.2 s: 0.15 s later it is still on (0.05 s left), 0.15 s more and it is gone.
    @Test
    void redStopsAfterItsDuration() {
        flash.tintOf(farm, 100, FRAME);
        flash.tintOf(farm, 95, FRAME);

        assertEquals(Tint.HURT, flash.tintOf(farm, 95, 0.15f));
        assertEquals(Tint.NORMAL, flash.tintOf(farm, 95, 0.15f));
    }

    // A value that goes up (a repair, later) is not a hit.
    @Test
    void notRedWhenTheValueRises() {
        flash.tintOf(farm, 90, FRAME);

        assertEquals(Tint.NORMAL, flash.tintOf(farm, 100, FRAME));
    }

    // Each object has its own red: hitting one enemy does not color the other.
    @Test
    void eachObjectHasItsOwnRed() {
        Object otherEnemy = new Object();
        flash.tintOf(farm, 100, FRAME);
        flash.tintOf(otherEnemy, 100, FRAME);
        flash.tintOf(farm, 95, FRAME);

        assertEquals(Tint.NORMAL, flash.tintOf(otherEnemy, 100, FRAME));
    }

    //-------------------- ON A RISE --------------------
    // Expected by the sheet of the day: watched on a rise, level 1 then 2 gives the blue of an upgrade.
    @Test
    void upgradedWhenTheValueRises() {
        HitFlash upgrade = new HitFlash(Tint.UPGRADED, true);
        Object defense = new Object();
        upgrade.tintOf(defense, 1, FRAME);

        assertEquals(Tint.UPGRADED, upgrade.tintOf(defense, 2, FRAME));
    }

    // Expected by the sheet of the day: watched on a rise, 2 then 1 gives nothing.
    @Test
    void notUpgradedWhenTheValueDrops() {
        HitFlash upgrade = new HitFlash(Tint.UPGRADED, true);
        Object defense = new Object();
        upgrade.tintOf(defense, 2, FRAME);

        assertEquals(Tint.NORMAL, upgrade.tintOf(defense, 1, FRAME));
    }
}
