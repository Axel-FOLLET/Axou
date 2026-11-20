package com.cropa.view;

// Java: two tables keyed by the watched object itself (the farm, each enemy, each defense).
import java.util.IdentityHashMap;
import java.util.Map;

// The model never says "hit" or "upgraded": it only changes a number. This class compares the number with the one of
// the previous frame, like GameSession.notifyChanges does for the HUD, and keeps a tint for a short instant after the
// change. Red after a drop (a hit) by default; blue after a rise (an upgrade) with the second constructor.
// IdentityHashMap: two enemies are two keys even if they look the same; only the very same object finds its entry.
/**
 * Tells which watched objects just changed: their value dropped (or rose) less than {@link #DURATION} seconds ago.
 */
public class HitFlash {

    //-------------------- CONSTANTS --------------------
    // Long enough to be seen (about 12 frames at 60 per second), short enough not to hide the sprite.
    /** How long the tint lasts after a change, in seconds. */
    public static final float DURATION = 0.2f;

    //-------------------- FIELDS --------------------
    // The tint given while the flash is on, and the change that starts it: a rise (true) or a drop (false).
    private final Tint tint;
    private final boolean onRise;
    // The value seen at the previous frame, and the seconds of flash left, for each watched object.
    // The dead enemies stay in the tables until the end of the game: a few dozen small entries per game.
    private final Map<Object, Integer> lastValues = new IdentityHashMap<>();
    private final Map<Object, Float> flashLeft = new IdentityHashMap<>();

    //-------------------- CONSTRUCTORS --------------------
    // The red of a hit, on a drop: FarmRenderer and EnemyRenderer call this one and do not change.
    // this(...) calls the other constructor, so the fields are set in one place only.
    /**
     * Creates a red flash, started by a drop of the value.
     */
    public HitFlash() {
        this(Tint.HURT, false);
    }

    // Called by DefenseRenderer for the blue of an upgrade: new HitFlash(Tint.UPGRADED, true).
    /**
     * Creates a flash of the given tint, started by a rise or by a drop of the value.
     *
     * @param tint the tint given while the flash is on
     * @param onRise {@code true} if a rise starts the flash, {@code false} if a drop does
     */
    public HitFlash(Tint tint, boolean onRise) {
        this.tint = tint;
        this.onRise = onRise;
    }

    //-------------------- QUERY --------------------
    // Called once per frame for each watched object, with its value now and the time of the frame.
    // put gives back the previous value: null the first time, so the first sight never flashes.
    // getOrDefault: 0 s of flash for an object that never changed yet.
    /**
     * Gives the tint of an object for this frame, from its value now.
     *
     * @param owner the watched object, for example an enemy
     * @param value its value now, for example its health
     * @param delta the time since the previous frame, in seconds
     * @return the tint of this flash if the value changed the watched way less than {@link #DURATION} seconds ago,
     *         else {@link Tint#NORMAL}
     */
    public Tint tintOf(Object owner, int value, float delta) {
        Integer last = lastValues.put(owner, value);
        float left = flashLeft.getOrDefault(owner, 0f) - delta;
        if (last != null && startsFlash(last, value)) {
            left = DURATION;
        }
        flashLeft.put(owner, left);
        return left > 0 ? tint : Tint.NORMAL;
    }

    // A rise for the blue, a drop for the red: any other change, or none, starts nothing.
    private boolean startsFlash(int last, int value) {
        return onRise ? value > last : value < last;
    }
}
