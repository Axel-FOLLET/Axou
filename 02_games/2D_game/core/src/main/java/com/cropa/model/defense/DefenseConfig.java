package com.cropa.model.defense;

// EnumMap: a Map made for enum keys (here DefenseType), fast and ordered by declaration.
import java.util.EnumMap;
import java.util.Map;

// All the balancing numbers of track C, from the rules (section 10), in one place:
// they can be tuned during playtests without touching the logic of the defenses.
// Not static: one object is created and passed to whoever needs it, so a test can give its own numbers.
/**
 * Balancing numbers of the defenses: price, damage, cooldown, wear, range and upgrade prices.
 */
public class DefenseConfig {

    //-------------------- CONSTANTS --------------------
    // damages starts at level 1, upgradePrices at level 2: level 1 comes with the defense.
    private static final int FIRST_LEVEL = 1;
    private static final int FIRST_LEVEL_TO_BUY = 2;
    private static final int BRAMBLE_GROWTH_NIGHTS = 1;

    //-------------------- TABLE --------------------
    // A record: Java writes the constructor and the accessors. One line of the table of section 10.
    // Private: the outside only sees the getters below.
    private record Numbers(int price, int[] damages, float cooldown, int wearPerUse, int[] upgradePrices, int range) {
    }

    // One entry per DefenseType, filled once by the constructor, then only read.
    private final Map<DefenseType, Numbers> numbers = new EnumMap<>(DefenseType.class);

    //-------------------- CONSTRUCTOR --------------------
    // Called once when a game starts. A table rather than one switch per getter: the numbers of a defense stay on one line.
    // The bramble only acts when an enemy crosses it: its cooldown and its range are 0.
    /**
     * Creates the configuration with the numbers of the rules.
     */
    public DefenseConfig() {
        numbers.put(DefenseType.CATAPATATE, new Numbers(150, new int[] {2, 3, 5}, 1f, 2, new int[] {100, 200}, 2));
        numbers.put(DefenseType.SCARECROW, new Numbers(120, new int[] {4, 6, 9}, 1.5f, 10, new int[] {80, 160}, 1));
        numbers.put(DefenseType.BRAMBLE, new Numbers(40, new int[] {3, 5, 8}, 0f, 20, new int[] {60, 120}, 0));
    }

    //-------------------- QUERIES --------------------
    /**
     * Returns the price of a defense.
     *
     * @param type the kind of defense
     * @return its price, in coins
     */
    public int getPrice(DefenseType type) {
        return numbers.get(type).price();
    }

    /**
     * Returns the damage of a defense at a level.
     *
     * @param type the kind of defense
     * @param level the level, from 1 to 3
     * @return the damage of one hit
     * @throws IllegalArgumentException if the level is not between 1 and 3
     */
    public int getDamage(DefenseType type, int level) {
        return valueAt(numbers.get(type).damages(), level, FIRST_LEVEL);
    }

    /**
     * Returns the time between two attacks of a defense.
     *
     * @param type the kind of defense
     * @return the cooldown, in seconds (0 for the bramble, which only acts when crossed)
     */
    public float getCooldown(DefenseType type) {
        return numbers.get(type).cooldown();
    }

    // Per shot for the catapatate, per enemy crossing for the scarecrow and the bramble.
    /**
     * Returns the durability a defense loses each time it is used.
     *
     * @param type the kind of defense
     * @return the durability lost, in percent
     */
    public int getWearPerUse(DefenseType type) {
        return numbers.get(type).wearPerUse();
    }

    // level is the level being bought: going to level 2 costs the first price.
    /**
     * Returns the price of an upgrade.
     *
     * @param type the kind of defense
     * @param level the level to buy, 2 or 3
     * @return the price of this upgrade, in coins
     * @throws IllegalArgumentException if the level is not 2 or 3
     */
    public int getUpgradePrice(DefenseType type, int level) {
        return valueAt(numbers.get(type).upgradePrices(), level, FIRST_LEVEL_TO_BUY);
    }

    /**
     * Returns the range of a defense.
     *
     * @param type the kind of defense
     * @return the range, in cells (0 for the bramble, which only touches its own cell)
     */
    public int getRange(DefenseType type) {
        return numbers.get(type).range();
    }

    /**
     * Returns the nights a bramble needs before it stings.
     *
     * @return the number of nights
     */
    public int getBrambleGrowthNights() {
        return BRAMBLE_GROWTH_NIGHTS;
    }

    //-------------------- INTERNALS --------------------
    // Turns a game level into an array index. A level outside the array is a programming error:
    // it fails right away with a clear message instead of an ArrayIndexOutOfBoundsException.
    private static int valueAt(int[] values, int level, int firstLevel) {
        int index = level - firstLevel;
        if (index < 0 || index >= values.length) {
            throw new IllegalArgumentException(
                    "Level " + level + " outside " + firstLevel + ".." + (firstLevel + values.length - 1));
        }
        return values[index];
    }
}
