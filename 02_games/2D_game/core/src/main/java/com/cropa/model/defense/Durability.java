package com.cropa.model.defense;

// No extends, no implements, no libGDX: a small value owned by a defense, tested without a window.
// Defense keeps one Durability and only says "wear" or "reset": the rules of the percentage live here, once.
/**
 * The state of a defense, in percent: from 100 (new) down to 0 (destroyed).
 */
public class Durability {

    //-------------------- CONSTANTS --------------------
    // A percentage scale, not a balancing number: the wear of each defense is in DefenseConfig.
    private static final int FULL_PERCENT = 100;

    //-------------------- FIELDS --------------------
    // Between 0 and FULL_PERCENT. Set here, so a new defense starts in perfect state without a constructor.
    private int percent = FULL_PERCENT;

    //-------------------- CONSTRUCTOR --------------------
    /**
     * Creates the durability of a new defense, at 100 percent.
     */
    public Durability() {
    }

    //-------------------- ACTIONS --------------------
    // Called each time a defense is used or crossed. Same choices as Farm.takeDamage:
    // negative wear is ignored, otherwise it would repair the defense above 100 %,
    // and Math.max(0, ...) keeps the percentage at 0 instead of going negative.
    /**
     * Lowers the percentage. It never goes below 0, and negative wear is ignored.
     *
     * @param amount the percentage to remove; ignored if negative
     */
    public void wear(int amount) {
        if (amount < 0) {
            return;
        }
        percent = Math.max(0, percent - amount);
    }

    // Called when the defense is upgraded (rules, section 7).
    /**
     * Puts the percentage back to 100.
     */
    public void reset() {
        percent = FULL_PERCENT;
    }

    //-------------------- QUERIES --------------------
    // Read by the view to draw the durability bar.
    /**
     * Returns the current percentage.
     *
     * @return the percentage, from 0 to 100
     */
    public int getPercent() {
        return percent;
    }

    // At 0 %, the defense is destroyed and removed (rules, section 7).
    /**
     * Tells whether the defense has no durability left.
     *
     * @return {@code true} if the percentage is 0
     */
    public boolean isZero() {
        return percent == 0;
    }
}
