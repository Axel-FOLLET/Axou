package com.cropa.model.enemy;

// Board: the size of the field (ROWS, COLUMNS), written once, in the class of the field.
import com.cropa.model.world.Board;
// ArrayList: the wave is built entry by entry. Comparator: to sort it by delay. List: what getWave returns.
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

// The waves are data, not code: the numbers of rules.md §10 are written once, in the arrays below,
// and getWave turns them into a list of SpawnEntry. Changing a wave after a playtest means changing a number,
// never the logic of an enemy or of WaveSpawner.
// The choices of track B (decided with Yohan on 11/11):
// - the i-th enemy of a type among n comes i * 10 / n seconds after the start of the wave (the first one at 0 s);
//   10 s since day 9 (was 20 s): the slower enemies of the rebalance must still reach the farm before dawn;
// - the rows are those of the table when it gives one, otherwise 1, 2, 3 in turn, counted for each type;
// - the list is sorted by delay; two equal delays keep the order mole, bat, witch (the order of EnemyType),
//   so that enemies of the same delay are created together, always in the same order (the same draws of Random).
/**
 * The composition of the 8 waves, one per night, and the delay before each of them.
 */
public class WaveTable {

    //-------------------- CONSTANTS --------------------
    // No enemy during the first 5 s of the night (§3): the player has time to look at the field.
    private static final float START_DELAY = 5f;
    // The enemies of each type are spread over the first 10 s of the wave: the last one appears before 15 s of night.
    private static final float SPREAD_DURATION = 10f;
    // "The table gives no row for this type on this night": the rows then go 1, 2, 3 in turn.
    private static final int NO_ROW = 0;
    // The first row of the field. The others come from Enemy, written once for the whole package.
    private static final int FIRST_ROW = Enemy.TOP_FLEE_ROW + 1;

    //-------------------- THE 8 NIGHTS (§10) --------------------
    // One number per night, from night 1 (index 0) to night 8 (index 7).
    // Moles halved on day 10 (were 0, 1, 2, 4, 5, 6, 6, 8): with the bats and the witches, they emptied the field
    // every night from night 4 (balance simulated over whole games, rules.md §10).
    private static final int[] MOLES = {0, 1, 1, 2, 2, 3, 3, 4};
    private static final int[] BATS = {2, 4, 5, 6, 8, 8, 10, 12};
    private static final int[] WITCHES = {0, 0, 1, 2, 2, 3, 4, 5};

    // The rows the table gives: the 2 bats of night 1 and the witch of night 3 are on row 2.
    // Night 8 ("5 witches, 2 of them on row 2") needs nothing here: rows 1, 2, 3, 1, 2 give it.
    private static final int[] MOLE_ROWS = {NO_ROW, NO_ROW, NO_ROW, NO_ROW, NO_ROW, NO_ROW, NO_ROW, NO_ROW};
    private static final int[] BAT_ROWS = {2, NO_ROW, NO_ROW, NO_ROW, NO_ROW, NO_ROW, NO_ROW, NO_ROW};
    private static final int[] WITCH_ROWS = {NO_ROW, NO_ROW, 2, NO_ROW, NO_ROW, NO_ROW, NO_ROW, NO_ROW};

    // The number of nights comes from the table itself.
    private static final int NIGHTS = MOLES.length;

    //-------------------- CONSTRUCTOR --------------------
    // Written only for its Javadoc: the table keeps nothing of its own, all its numbers are constants above.
    // Without it, Java gives an invisible default constructor, which the Javadoc cannot document.
    // GameSession creates one, and gives it to its WaveSpawner.
    /**
     * Creates the table of the 8 waves of the rules.
     */
    public WaveTable() {
    }

    //-------------------- START --------------------
    /**
     * Returns the time between nightfall and the start of the wave.
     *
     * @return the delay before the first enemy, in seconds
     */
    public float getStartDelay() {
        return START_DELAY;
    }

    //-------------------- WAVES --------------------
    // Built again on each call: the caller gets its own list and may empty it without changing the table.
    // EnemyType.values() gives MOLE, BAT, WITCH: the entries are added in that order, then sorted by delay only.
    // List.sort is stable (it never swaps two equal elements), so equal delays keep the order mole, bat, witch.
    /**
     * Returns the enemies of one night.
     *
     * <p>The numbers are those of the rules (§10). The i-th enemy of a type among n comes
     * {@code i * 10 / n} seconds after the start of the wave, the first one at 0 s. Each enemy is on the row the
     * rules give, otherwise on rows 1, 2, 3 in turn, counted for each type. The list is sorted by delay; enemies
     * with the same delay come in the order mole, bat, witch. Each call returns a new list.
     *
     * @param night the night, from 1 to 8
     * @return the entries of the wave, sorted by delay
     * @throws IllegalArgumentException if the night is not between 1 and 8
     */
    public List<SpawnEntry> getWave(int night) {
        if (night < 1 || night > NIGHTS) {
            throw new IllegalArgumentException("night must be between 1 and " + NIGHTS + ", got " + night);
        }
        List<SpawnEntry> wave = new ArrayList<>();
        for (EnemyType type : EnemyType.values()) {
            addEnemiesOf(type, night, wave);
        }
        wave.sort(Comparator.comparingDouble(SpawnEntry::getDelay));
        return wave;
    }

    // The n enemies of one type, spread over 10 s; on the row of the table, or on rows 1, 2, 3 in turn.
    private void addEnemiesOf(EnemyType type, int night, List<SpawnEntry> wave) {
        int count = countsOf(type)[night - 1];
        int tableRow = rowsOf(type)[night - 1];
        for (int i = 0; i < count; i++) {
            int row = tableRow == NO_ROW ? FIRST_ROW + i % Board.ROWS : tableRow;
            wave.add(new SpawnEntry(type, row, i * SPREAD_DURATION / count));
        }
    }

    // No default branch, as in EnemyConfig: a new value of EnemyType stops the compilation until its numbers are here.
    private int[] countsOf(EnemyType type) {
        return switch (type) {
            case MOLE -> MOLES;
            case BAT -> BATS;
            case WITCH -> WITCHES;
        };
    }

    private int[] rowsOf(EnemyType type) {
        return switch (type) {
            case MOLE -> MOLE_ROWS;
            case BAT -> BAT_ROWS;
            case WITCH -> WITCH_ROWS;
        };
    }
}
