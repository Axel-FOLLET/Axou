package com.cropa.model.enemy;

// Board: the field the witch walks on. Farm: the farm the witch walks to and hits. CropType: the turnip she avoids.
// DefenseLine: the defenses she wears while she flees. Random: injected, given to her strategy.
import com.cropa.model.world.Board;
import com.cropa.model.world.CropType;
import com.cropa.model.world.DefenseLine;
import com.cropa.model.world.Farm;
import java.util.Random;

// The witch: slow and tough. She moves and hits like the bat (LaneEnemy); her numbers come from
// EnemyConfig (45 HP, 0.3 cell/s, 20 damage per hit). She reaches the farm about 33 s after entering her row,
// hits it at once, then every 5 s.
// implements Walker: she walks, so each cell she enters reacts (Cell.crossBy): she crushes the crops,
// and a bramble hurts her. She turns aside from the turnip: the same DeviateStrategy as the bat, with TURNIP.
/**
 * The witch: a slow walking enemy that hits the farm hard and turns aside from the turnip.
 */
public class Witch extends LaneEnemy implements Walker {

    //-------------------- CONSTRUCTORS --------------------
    // No type parameter: a witch is always EnemyType.WITCH, and always avoids the turnip.
    /**
     * Creates a witch at the entry of her row, on the given field.
     *
     * @param row the row of the field, from 1 to 3
     * @param farm the farm the witch walks to and hits
     * @param board the field the witch walks on
     * @param config the balancing numbers
     * @param defenseLine the defenses of the flee rows, worn while she flees
     * @param random the source of the random choices when she turns aside
     * @throws IllegalArgumentException if the row is not between 1 and 3
     */
    public Witch(int row, Farm farm, Board board, EnemyConfig config, DefenseLine defenseLine, Random random) {
        super(EnemyType.WITCH, row, farm, board, config, new DeviateStrategy(CropType.TURNIP), defenseLine,
                random);
    }

    // Kept for the code that does not give the field yet (some tests): see LaneEnemy. To remove with it (day 10).
    /**
     * Creates a witch at the entry of her row, on an empty field of her own: she crushes nothing.
     *
     * @param row the row of the field, from 1 to 3
     * @param farm the farm the witch walks to and hits
     * @param config the balancing numbers
     * @throws IllegalArgumentException if the row is not between 1 and 3
     */
    public Witch(int row, Farm farm, EnemyConfig config) {
        super(EnemyType.WITCH, row, farm, config, new DeviateStrategy(CropType.TURNIP));
    }
}
