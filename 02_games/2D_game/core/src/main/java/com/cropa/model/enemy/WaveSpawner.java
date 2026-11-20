package com.cropa.model.enemy;

// ArrayList: the enemies created in one frame. List: the wave to read, and what update returns.
import java.util.ArrayList;
import java.util.List;

// Makes the wave of a night appear, as time goes by. It reads WaveTable (when, what, on which row) and asks
// EnemyFactory to create each enemy: it never writes new Bat(...) itself.
// update returns the enemies created during the frame instead of adding them to the game's list: the spawner does
// not need to know who keeps the enemies (GameSession, at J10), and a test reads the result directly.
// The wave is sorted by delay (WaveTable): the spawner only reads it from the start, with an index, and stops at
// the first entry that is not due yet.
/**
 * Creates the enemies of a night's wave when their time comes.
 */
public class WaveSpawner {

    //-------------------- STATE --------------------
    // Where the waves come from, and who creates the enemies.
    private final WaveTable table;
    private final EnemyFactory factory;
    // The wave of the current night, sorted by delay. Empty before the first night: nothing waits.
    private List<SpawnEntry> wave = List.of();
    // The index of the next entry to create: those before it have already been created.
    private int next;
    // The seconds since nightfall.
    private float elapsed;

    //-------------------- CONSTRUCTOR --------------------
    /**
     * Creates a spawner that reads the waves of a table and creates their enemies with a factory.
     *
     * @param table the composition of the waves
     * @param factory the factory that creates the enemies
     */
    public WaveSpawner(WaveTable table, EnemyFactory factory) {
        this.table = table;
        this.factory = factory;
    }

    //-------------------- NIGHT --------------------
    // The clock goes back to 0 and the wave of this night replaces what was left of the previous one.
    /**
     * Starts the wave of a night: the clock goes back to 0.
     *
     * @param night the night, from 1 to 8
     * @throws IllegalArgumentException if the night is not between 1 and 8
     */
    public void startNight(int night) {
        wave = table.getWave(night);
        next = 0;
        elapsed = 0f;
    }

    //-------------------- ACTIONS --------------------
    // A negative delta does not take the clock back, as for the enemies.
    // A while, not an if: in one frame, every entry that is due is created, several at once when their delays are
    // equal (the mole, the bat and the witch of 0 s) or when the frame is very long. They come in the order of the
    // table (mole, bat, witch), so the draws of Random always come in the same order.
    // An entry is due once the clock reaches the start delay (5 s) plus its own delay.
    /**
     * Moves the wave forward in time and creates the enemies whose time has come.
     *
     * <p>An enemy is created once the time since {@link #startNight(int)} reaches
     * {@link WaveTable#getStartDelay()} plus its {@link SpawnEntry#getDelay()}. All the enemies due during the
     * frame are created, in the order of the wave.
     *
     * @param delta the seconds elapsed since the previous frame; ignored if negative
     * @return the enemies created during this frame, an empty list if none
     */
    public List<Enemy> update(float delta) {
        if (delta > 0) {
            elapsed += delta;
        }
        List<Enemy> created = new ArrayList<>();
        while (next < wave.size() && isDue(wave.get(next))) {
            SpawnEntry entry = wave.get(next);
            created.add(factory.create(entry.getType(), entry.getRow()));
            next++;
        }
        return created;
    }

    // The delay of an entry counts from the start of the wave, which is getStartDelay() after nightfall.
    private boolean isDue(SpawnEntry entry) {
        return elapsed >= table.getStartDelay() + entry.getDelay();
    }

    //-------------------- STATE OF THE WAVE --------------------
    /**
     * Tells whether the whole wave has appeared.
     *
     * @return true when no enemy of the wave waits any more (also before the first night)
     */
    public boolean isFinished() {
        return next >= wave.size();
    }
}
