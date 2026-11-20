package com.cropa.model.enemy;

// Board and Farm: the world every enemy lives in. DefenseLine: the defenses the bats and witches wear when they
// flee. Random: injected, shared by every enemy of the game.
import com.cropa.model.world.Board;
import com.cropa.model.world.DefenseLine;
import com.cropa.model.world.Farm;
import java.util.Random;

// The Factory pattern: the only place that knows Mole, Bat and Witch and calls their constructors.
// WaveSpawner only says "a WITCH on row 3"; it never writes new Witch(...) and never sees the board or the farm.
// What does not change from one enemy to the next (board, farm, config, defense line, Random) is given once, here.
// The Random comes last (team rule), the DefenseLine just before it (decided with Axel, day 9).
// Adding an enemy: a subclass, a value of EnemyType, a case below, its numbers in WaveTable and EnemyConfig.
/**
 * Creates the enemies of the waves, all on the same board, against the same farm.
 */
public class EnemyFactory {

    //-------------------- STATE --------------------
    // The field the enemies cross and the mole eats on.
    private final Board board;
    // The farm the bats and the witches hit.
    private final Farm farm;
    // The balancing numbers of every enemy.
    private final EnemyConfig config;
    // The defenses of rows 0 and 4: a bat or a witch that flees wears them.
    private final DefenseLine defenseLine;
    // The one source of chance of the game, given to each enemy (deviations, the mole's crops).
    private final Random random;

    //-------------------- CONSTRUCTOR --------------------
    /**
     * Creates a factory for one game.
     *
     * @param board the field of the game
     * @param farm the farm the enemies attack
     * @param config the balancing numbers of the enemies
     * @param defenseLine the defenses of the flee rows, worn by the enemies that flee
     * @param random the source of the random choices of the enemies
     */
    public EnemyFactory(Board board, Farm farm, EnemyConfig config, DefenseLine defenseLine, Random random) {
        this.board = board;
        this.farm = farm;
        this.config = config;
        this.defenseLine = defenseLine;
        this.random = random;
    }

    //-------------------- CREATION --------------------
    // A switch on the type, without default branch, as in EnemyConfig: a new value of EnemyType stops the
    // compilation until it has its case here. The mole chooses its crops itself, so the row is not used for it.
    // A bat or a witch on a row other than 1 to 3 is refused by Enemy's constructor (IllegalArgumentException).
    /**
     * Creates one enemy.
     *
     * @param type the kind of enemy
     * @param row the row it starts on, from 1 to 3; ignored for the mole, which is born underground
     * @return the new enemy
     * @throws IllegalArgumentException if a bat or a witch is asked on a row other than 1 to 3
     */
    public Enemy create(EnemyType type, int row) {
        return switch (type) {
            case MOLE -> new Mole(board, config, random);
            case BAT -> new Bat(row, farm, board, config, defenseLine, random);
            case WITCH -> new Witch(row, farm, board, config, defenseLine, random);
        };
    }
}
