package com.cropa.model.defense;

// JUnit: the three checks the tests use, and the annotation that marks a test.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

// No extends: JUnit finds the tests through @Test. Every expected number is copied from section 10 of the rules.
/** Tests for {@link DefenseConfig}. */
class DefenseConfigTest {

    //-------------------- FIELDS --------------------
    // One config for all the tests: it is only read. Floats are compared with a small tolerance.
    private static final float TOLERANCE = 0.001f;
    private final DefenseConfig config = new DefenseConfig();

    //-------------------- NUMBERS OF THE RULES --------------------
    // Without this test, a typo in a number would only show up during a playtest.
    @Test
    void catapatateNumbersMatchTheRules() {
        assertEquals(150, config.getPrice(DefenseType.CATAPATATE));
        assertEquals(2, config.getDamage(DefenseType.CATAPATATE, 1));
        assertEquals(3, config.getDamage(DefenseType.CATAPATATE, 2));
        assertEquals(5, config.getDamage(DefenseType.CATAPATATE, 3));
        assertEquals(1f, config.getCooldown(DefenseType.CATAPATATE), TOLERANCE);
        assertEquals(2, config.getWearPerUse(DefenseType.CATAPATATE));
        assertEquals(2, config.getRange(DefenseType.CATAPATATE));
        assertEquals(100, config.getUpgradePrice(DefenseType.CATAPATATE, 2));
        assertEquals(200, config.getUpgradePrice(DefenseType.CATAPATATE, 3));
    }

    // Same check for the scarecrow: range 1, the cross around its cell.
    @Test
    void scarecrowNumbersMatchTheRules() {
        assertEquals(120, config.getPrice(DefenseType.SCARECROW));
        assertEquals(4, config.getDamage(DefenseType.SCARECROW, 1));
        assertEquals(6, config.getDamage(DefenseType.SCARECROW, 2));
        assertEquals(9, config.getDamage(DefenseType.SCARECROW, 3));
        assertEquals(1.5f, config.getCooldown(DefenseType.SCARECROW), TOLERANCE);
        assertEquals(10, config.getWearPerUse(DefenseType.SCARECROW));
        assertEquals(1, config.getRange(DefenseType.SCARECROW));
        assertEquals(80, config.getUpgradePrice(DefenseType.SCARECROW, 2));
        assertEquals(160, config.getUpgradePrice(DefenseType.SCARECROW, 3));
    }

    // The bramble only acts when an enemy crosses it: no cooldown and no range, so both are 0.
    @Test
    void brambleNumbersMatchTheRules() {
        assertEquals(40, config.getPrice(DefenseType.BRAMBLE));
        assertEquals(3, config.getDamage(DefenseType.BRAMBLE, 1));
        assertEquals(5, config.getDamage(DefenseType.BRAMBLE, 2));
        assertEquals(8, config.getDamage(DefenseType.BRAMBLE, 3));
        assertEquals(0f, config.getCooldown(DefenseType.BRAMBLE), TOLERANCE);
        assertEquals(20, config.getWearPerUse(DefenseType.BRAMBLE));
        assertEquals(0, config.getRange(DefenseType.BRAMBLE));
        assertEquals(60, config.getUpgradePrice(DefenseType.BRAMBLE, 2));
        assertEquals(120, config.getUpgradePrice(DefenseType.BRAMBLE, 3));
    }

    // Planted on day 1, a bramble stings from night 2 (rules, section 7).
    @Test
    void brambleGrowsInOneNight() {
        assertEquals(1, config.getBrambleGrowthNights());
    }

    //-------------------- LEVELS --------------------
    // Levels go from 1 to 3: anything else is a programming error, reported right away.
    @Test
    void damageOutsideTheLevelsThrows() {
        assertThrows(IllegalArgumentException.class, () -> config.getDamage(DefenseType.CATAPATATE, 0));
        assertThrows(IllegalArgumentException.class, () -> config.getDamage(DefenseType.CATAPATATE, 4));
    }

    // Only levels 2 and 3 can be bought: level 1 comes with the defense, and there is no level 4.
    @Test
    void upgradePriceOutsideTheLevelsToBuyThrows() {
        assertThrows(IllegalArgumentException.class, () -> config.getUpgradePrice(DefenseType.CATAPATATE, 1));
        assertThrows(IllegalArgumentException.class, () -> config.getUpgradePrice(DefenseType.CATAPATATE, 4));
    }

    //-------------------- EVERY TYPE --------------------
    // Without this test, a new value in DefenseType could reach the game with no numbers.
    @Test
    void everyDefenseTypeHasNumbers() {
        for (DefenseType type : DefenseType.values()) {
            assertTrue(config.getPrice(type) > 0, type + " has no price");
        }
    }
}
