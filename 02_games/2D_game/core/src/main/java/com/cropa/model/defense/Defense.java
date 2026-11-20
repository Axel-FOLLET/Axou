package com.cropa.model.defense;

// Updatable: the interface of whatever moves forward with time, from the world package.
import com.cropa.model.world.Updatable;

// abstract: what the catapatate, the scarecrow and the bramble have in common, written once.
// implements Updatable: the game moves every defense forward without knowing which one it is.
// Each subclass only writes update(), the way this defense acts.
/**
 * Base class of the three defenses: their type, level and durability.
 */
public abstract class Defense implements Updatable {

    //-------------------- CONSTANTS --------------------
    // A defense goes from level 1 to level 3 (rules, section 7). The prices and damages live in DefenseConfig.
    private static final int FIRST_LEVEL = 1;
    private static final int LAST_LEVEL = 3;
    // How long the attack image stays after a shot or a punch, in seconds (asked by Axel on day 14). Short next to the
    // cooldowns (1 s and more), so the defense is back to its still image before its next attack.
    private static final float ATTACK_POSE_SECONDS = 0.3f;

    //-------------------- FIELDS --------------------
    // type and config never change. The level only goes up, through upgrade().
    private final DefenseType type;
    private final DefenseConfig config;
    private final Durability durability = new Durability();
    private int level = FIRST_LEVEL;
    // Seconds left on the attack image. 0: the defense shows its still image. Set by startAttackPose, counted down by
    // countDownAttackPose, both called from the update of the subclass that attacks.
    private float attackPoseLeft;

    //-------------------- CONSTRUCTOR --------------------
    // protected: only subclasses call it, through super(...). A new defense is level 1 and at 100 %.
    /**
     * Creates a new defense, at level 1 and in perfect state.
     *
     * @param type the kind of defense
     * @param config the balancing numbers
     */
    protected Defense(DefenseType type, DefenseConfig config) {
        this.type = type;
        this.config = config;
    }

    //-------------------- QUERIES --------------------
    // Read by DefenseConfig lookups and by the view, to pick the sprite.
    /**
     * Returns the kind of this defense.
     *
     * @return its type
     */
    public DefenseType getType() {
        return type;
    }

    // Read by the view and the shop.
    /**
     * Returns the level of this defense.
     *
     * @return the level, from 1 to 3
     */
    public int getLevel() {
        return level;
    }

    // A number, not the Durability object: the view can show it but cannot wear the defense.
    /**
     * Returns the durability left.
     *
     * @return the percentage, from 0 to 100
     */
    public int getDurability() {
        return durability.getPercent();
    }

    // At 0 %, the defense is destroyed (rules, section 7). wear() then makes it leave its place.
    /**
     * Tells whether this defense has no durability left.
     *
     * @return {@code true} if it is destroyed
     */
    public boolean isDestroyed() {
        return durability.isZero();
    }

    // Read by the shop before showing "Upgrade".
    /**
     * Tells whether this defense can still go up a level.
     *
     * @return {@code false} at level 3
     */
    public boolean canUpgrade() {
        return level < LAST_LEVEL;
    }

    // Read by the view on every frame: the catapatate throwing (DefenseRenderer) and the scarecrow punching
    // (Scarecrow.spriteKey). The bramble never attacks on its own: it always answers false.
    /**
     * Tells whether this defense has just attacked, to show its attack image.
     *
     * @return {@code true} during the 0.3 s that follow a shot or a punch
     */
    public boolean isAttacking() {
        return attackPoseLeft > 0;
    }

    // Read by the view, which veils in white the cells a defense reaches while its panel is open (asked by Axel on
    // day 10). Each defense writes its own shape: the diamond of the catapatate, the cross of the scarecrow, the cell
    // of the bramble. The catapatate and the scarecrow choose their target with this same method: the veil shows
    // exactly where they hit, and the rule is written once, in the model.
    /**
     * Tells whether this defense reaches a cell of the field.
     *
     * @param row the row, from 1 to 3
     * @param column the column, from 1 to 5
     * @return {@code true} if an enemy on that cell can be hit by this defense
     */
    public abstract boolean reaches(int row, int column);

    // The price of the next level. Call canUpgrade first: at level 3, DefenseConfig reports a programming error.
    /**
     * Returns the price of the next level.
     *
     * @return the price, in coins
     * @throws IllegalArgumentException if this defense is already at level 3
     */
    public int getUpgradePrice() {
        return config.getUpgradePrice(type, level + 1);
    }

    // protected: only the defense itself needs its damage; it changes with the level, so it is read each time.
    /**
     * Returns the damage of one hit at the current level.
     *
     * @return the damage
     */
    protected int getDamage() {
        return config.getDamage(type, level);
    }

    // protected, like getDamage: the scarecrow and the bramble read it when an enemy crosses them.
    // It does not change with the level, but it lives in DefenseConfig with the other numbers of the type.
    /**
     * Returns the durability this defense loses each time it is used.
     *
     * @return the durability lost, in percent
     */
    protected int getWearPerUse() {
        return config.getWearPerUse(type);
    }

    //-------------------- ACTIONS --------------------
    // Called when the defense is used or hit. Durability keeps its own rules: never below 0, negative wear ignored.
    // wasDestroyed: only the wear that reaches 0 % makes it leave; wearing a destroyed defense again does nothing more.
    /**
     * Lowers the durability. At 0 %, the defense leaves its place.
     *
     * @param percent the percentage to remove
     */
    public void wear(int percent) {
        boolean wasDestroyed = isDestroyed();
        durability.wear(percent);
        if (!wasDestroyed && isDestroyed()) {
            leavePlace();
        }
    }

    // To be called on every defense at dawn by DayState.enter (Antonin wires it on day 8): nobody asks which one grows.
    // Empty here: the catapatate and the scarecrow do not change at dawn. The bramble overrides it to grow.
    /**
     * Reacts to the dawn. Does nothing by default.
     */
    public void onDawn() {
    }

    // protected: only a subclass knows when it attacks. Called by Catapatate and Scarecrow right after their hit.
    // A new attack starts the 0.3 s again from the start.
    /**
     * Shows the attack image for the next 0.3 s.
     */
    protected void startAttackPose() {
        attackPoseLeft = ATTACK_POSE_SECONDS;
    }

    // Called at the top of the update of Catapatate and Scarecrow, before they may attack again, so the frame of a new
    // attack keeps its full 0.3 s. Math.max: the time never goes below 0.
    /**
     * Counts the time of the attack image down.
     *
     * @param delta the seconds elapsed since the previous frame
     */
    protected void countDownAttackPose(float delta) {
        attackPoseLeft = Math.max(0, attackPoseLeft - delta);
    }

    // Template Method: Defense decides when to leave (in wear), each subclass decides where it leaves from.
    // protected: called only by wear, never from outside. abstract: a defense that forgets it does not compile.
    /**
     * Removes this defense from where it stands, once it is destroyed.
     */
    protected abstract void leavePlace();

    // Called by the shop once the player has paid. An upgrade also repairs the defense (rules, section 7).
    /**
     * Moves this defense up a level and puts its durability back to 100 %.
     *
     * @return {@code false} if it was already at level 3; nothing changes then
     */
    public boolean upgrade() {
        if (!canUpgrade()) {
            return false;
        }
        level++;
        durability.reset();
        return true;
    }
}
