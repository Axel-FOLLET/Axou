package com.cropa.model.defense;

// JUnit: the checks the tests use, and the annotation that marks a test.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

// No extends: JUnit finds the tests through @Test.
/** Tests for {@link Defense}. */
class DefenseTest {

    //-------------------- HELPERS --------------------
    // Defense is abstract: an empty subclass is enough to test what they all share.
    // It stands nowhere, so leavePlace only counts its calls.
    private static class TestDefense extends Defense {
        private int leaveCount;

        TestDefense() {
            super(DefenseType.CATAPATATE, new DefenseConfig());
        }

        @Override
        public void update(float delta) {
        }

        @Override
        protected void leavePlace() {
            leaveCount++;
        }

        // It stands nowhere: it reaches no cell.
        @Override
        public boolean reaches(int row, int column) {
            return false;
        }
    }

    private TestDefense newDefense() {
        return new TestDefense();
    }

    //-------------------- START --------------------
    // A new defense is level 1 and in perfect state.
    @Test
    void startsAtLevelOneAndFullDurability() {
        Defense defense = newDefense();

        assertEquals(DefenseType.CATAPATATE, defense.getType());
        assertEquals(1, defense.getLevel());
        assertEquals(100, defense.getDurability());
        assertFalse(defense.isDestroyed());
    }

    // Without this test, the damage could stop following the level.
    @Test
    void damageFollowsTheLevel() {
        Defense defense = newDefense();
        assertEquals(2, defense.getDamage());

        defense.upgrade();
        assertEquals(3, defense.getDamage());

        defense.upgrade();
        assertEquals(5, defense.getDamage());
    }

    //-------------------- WEAR --------------------
    // Wear lowers the durability; at 0 % the defense is destroyed.
    @Test
    void wearDownToZeroDestroysTheDefense() {
        Defense defense = newDefense();

        defense.wear(40);
        assertEquals(60, defense.getDurability());
        assertFalse(defense.isDestroyed());

        defense.wear(60);
        assertTrue(defense.isDestroyed());
    }

    // At 0 %, the defense leaves its place once: wearing it again does not make it leave twice.
    @Test
    void leavesItsPlaceOnceAtZero() {
        TestDefense defense = newDefense();

        defense.wear(99);
        assertEquals(0, defense.leaveCount);

        defense.wear(1);
        assertEquals(1, defense.leaveCount);

        defense.wear(10);
        assertEquals(1, defense.leaveCount);
    }

    //-------------------- UPGRADE --------------------
    // An upgrade also repairs the defense (rules, section 7).
    @Test
    void upgradeRaisesTheLevelAndRepairs() {
        Defense defense = newDefense();
        defense.wear(30);

        assertTrue(defense.upgrade());

        assertEquals(2, defense.getLevel());
        assertEquals(100, defense.getDurability());
    }

    // The shop reads the price of the next level: 100, then 200 for a catapatate.
    @Test
    void upgradePriceIsTheOneOfTheNextLevel() {
        Defense defense = newDefense();
        assertEquals(100, defense.getUpgradePrice());

        defense.upgrade();
        assertEquals(200, defense.getUpgradePrice());
    }

    // At level 3 nothing changes: the shop must not charge the player.
    @Test
    void cannotGoAboveLevelThree() {
        Defense defense = newDefense();
        defense.upgrade();
        defense.upgrade();
        defense.wear(10);

        assertFalse(defense.canUpgrade());
        assertFalse(defense.upgrade());
        assertEquals(3, defense.getLevel());
        assertEquals(90, defense.getDurability());
    }

    // There is no level 4 to buy: asking its price is a programming error.
    @Test
    void upgradePriceAtLevelThreeThrows() {
        Defense defense = newDefense();
        defense.upgrade();
        defense.upgrade();

        assertThrows(IllegalArgumentException.class, defense::getUpgradePrice);
    }
}
