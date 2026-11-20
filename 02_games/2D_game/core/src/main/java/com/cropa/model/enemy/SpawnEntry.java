package com.cropa.model.enemy;

// One enemy of a wave, as data: which enemy, on which row, and when. WaveTable writes them, WaveSpawner reads them
// and asks EnemyFactory to create the enemy when its time comes. Immutable: all fields are final, no setter.
/**
 * One enemy to create during a wave: its type, its row and its delay.
 */
public class SpawnEntry {

    //-------------------- STATE --------------------
    // The kind of enemy to create.
    private final EnemyType type;
    // The row it starts on, from 1 to 3 (ignored by the mole, which chooses its own crops).
    private final int row;
    // Seconds after the start of the wave, not after nightfall: WaveTable.getStartDelay() comes first.
    private final float delay;

    //-------------------- CONSTRUCTOR --------------------
    /**
     * Creates one entry of a wave.
     *
     * @param type the kind of enemy to create
     * @param row the row it starts on, from 1 to 3 (ignored for the mole)
     * @param delay the seconds between the start of the wave and its arrival
     */
    public SpawnEntry(EnemyType type, int row, float delay) {
        this.type = type;
        this.row = row;
        this.delay = delay;
    }

    //-------------------- GETTERS --------------------
    /**
     * Returns the kind of enemy to create.
     *
     * @return the enemy type
     */
    public EnemyType getType() {
        return type;
    }

    /**
     * Returns the row the enemy starts on.
     *
     * @return the row, from 1 to 3 (ignored for the mole)
     */
    public int getRow() {
        return row;
    }

    /**
     * Returns when the enemy comes, counted from the start of the wave.
     *
     * @return the seconds after the start of the wave
     */
    public float getDelay() {
        return delay;
    }
}
