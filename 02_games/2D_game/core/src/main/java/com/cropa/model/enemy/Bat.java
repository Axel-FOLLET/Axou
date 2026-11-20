package com.cropa.model.enemy;

// Board: the field the bat flies over. Farm: the farm the bat flies to and hits. CropType: the garlic it avoids.
// DefenseLine: the defenses it wears while it flees. Random: injected, given to its strategy.
import com.cropa.model.world.Board;
import com.cropa.model.world.CropType;
import com.cropa.model.world.DefenseLine;
import com.cropa.model.world.Farm;
import java.util.Random;

// The bat: fast and fragile. It moves and hits like the witch (LaneEnemy); its numbers come from
// EnemyConfig. It flies: implements Flyable gives it onEnterCell, which triggers nothing, so the bramble and
// the scarecrow are never told it passed. It turns aside from the garlic: the same DeviateStrategy as the witch,
// with GARLIC instead of TURNIP.
/**
 * The bat: a fast flying enemy that turns aside from the garlic.
 */
public class Bat extends LaneEnemy implements Flyable {

    //-------------------- CONSTRUCTORS --------------------
    // No type parameter: a bat is always EnemyType.BAT, and always avoids the garlic.
    /**
     * Creates a bat at the entry of its row, over the given field.
     *
     * @param row the row of the field, from 1 to 3
     * @param farm the farm the bat flies to and hits
     * @param board the field the bat flies over
     * @param config the balancing numbers
     * @param defenseLine the defenses of the flee rows, worn while it flees
     * @param random the source of the random choices when it turns aside
     * @throws IllegalArgumentException if the row is not between 1 and 3
     */
    public Bat(int row, Farm farm, Board board, EnemyConfig config, DefenseLine defenseLine, Random random) {
        super(EnemyType.BAT, row, farm, board, config, new DeviateStrategy(CropType.GARLIC), defenseLine,
                random);
    }

    // Kept for the bat of the POC (NightState) and a few tests, which do not give the field yet: see LaneEnemy.
    // To remove with it (day 10).
    /**
     * Creates a bat at the entry of its row, over an empty field of its own.
     *
     * @param row the row of the field, from 1 to 3
     * @param farm the farm the bat flies to and hits
     * @param config the balancing numbers
     * @throws IllegalArgumentException if the row is not between 1 and 3
     */
    public Bat(int row, Farm farm, EnemyConfig config) {
        super(EnemyType.BAT, row, farm, config, new DeviateStrategy(CropType.GARLIC));
    }

    //-------------------- QUERIES --------------------
    // The bat flies: the scarecrow does not punch it (rules, section 8). Written by Axel on day 8.
    /**
     * Tells whether the bat flies over the field.
     *
     * @return always {@code true}
     */
    @Override
    public boolean isFlying() {
        return true;
    }
}
