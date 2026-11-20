package com.cropa.model.defense;

// JUnit: the checks the tests use, and the annotation that marks a test.
// The model: a real witch on a real field, and the farm she walks to. OptionalInt: what onHarvested returns.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cropa.model.enemy.EnemyConfig;
import com.cropa.model.enemy.EnemyType;
import com.cropa.model.enemy.Witch;
import com.cropa.model.world.Board;
import com.cropa.model.world.Cell;
import com.cropa.model.world.Farm;
import java.util.OptionalInt;
import java.util.Random;
import org.junit.jupiter.api.Test;

// No extends: JUnit finds the tests through @Test. A bramble of level 1 removes 3 health points.
// The health of the witch is read in EnemyConfig: a playtest may change it without breaking these tests.
/** Tests for {@link Bramble}. */
class BrambleTest {

    //-------------------- FIELDS --------------------
    private static final float FRAME = 1f / 60f;
    private static final int WITCH_HEALTH = new EnemyConfig().getHealth(EnemyType.WITCH);
    private final DefenseConfig config = new DefenseConfig();
    private final EnemyConfig enemyConfig = new EnemyConfig();
    private final Farm farm = new Farm(100);

    //-------------------- HELPERS --------------------
    // A bramble placed on its own cell, as DefenseSlots.placeOnField would do.
    private Bramble brambleOn(Cell cell) {
        Bramble bramble = new Bramble(cell, config);
        cell.place(bramble);
        return bramble;
    }

    // A witch walks her whole row on the given field, until she has passed column 1.
    private Witch witchCrosses(Board board, int row) {
        Witch witch = new Witch(row, farm, board, enemyConfig, (wearRow, column, percent) -> { }, new Random(0));
        while (!witch.isDead() && witch.getCellsToFarm() > 3) {
            witch.update(FRAME);
        }
        return witch;
    }

    //-------------------- GROWTH --------------------
    // Planted on day 1: young until its first dawn, then it stings (rules, section 7).
    @Test
    void stingsOnlyAfterItsFirstDawn() {
        Bramble bramble = brambleOn(new Cell(2, 3));
        assertFalse(bramble.isActive());
        assertEquals("bramble_0", bramble.spriteKey());

        bramble.onDawn();

        assertTrue(bramble.isActive());
        assertEquals("bramble_1", bramble.spriteKey());
    }

    //-------------------- THE CROSSING --------------------
    // Young, it is crushed like a crop: the cell is freed, the witch is not hurt.
    @Test
    void aYoungBrambleIsCrushed() {
        Board board = new Board();
        Cell cell = board.getCell(2, 3);
        Bramble bramble = brambleOn(cell);

        Witch witch = witchCrosses(board, 2);

        assertTrue(cell.isEmpty());
        assertEquals(WITCH_HEALTH, witch.getHealth());
        assertEquals(100, bramble.getDurability());
    }

    // Expected by the sheet of the day: on a grown bramble, the witch loses 3 HP and the bramble 20 %, not 40 %.
    @Test
    void aGrownBrambleStingsTheWitchOnce() {
        Board board = new Board();
        Cell cell = board.getCell(2, 3);
        Bramble bramble = brambleOn(cell);
        bramble.onDawn();

        Witch witch = witchCrosses(board, 2);

        assertEquals(WITCH_HEALTH - 3, witch.getHealth());
        assertEquals(80, bramble.getDurability());
        assertSame(bramble, cell.getOccupant().orElseThrow());
    }

    // Damage 3 / 5 / 8: at level 2, a sting removes 5.
    @Test
    void damageFollowsTheLevel() {
        Cell cell = new Cell(2, 3);
        Bramble bramble = brambleOn(cell);
        bramble.onDawn();
        bramble.upgrade();
        Witch witch = new Witch(2, farm, enemyConfig);

        bramble.onCrossedBy(witch);

        assertEquals(WITCH_HEALTH - 5, witch.getHealth());
    }

    // -20 % each time: the fifth crossing destroys it and frees the cell.
    @Test
    void theFifthCrossingDestroysIt() {
        Cell cell = new Cell(2, 3);
        Bramble bramble = brambleOn(cell);
        bramble.onDawn();
        Witch witch = new Witch(2, farm, enemyConfig);

        for (int crossing = 1; crossing <= 4; crossing++) {
            assertFalse(bramble.onCrossedBy(witch));
        }
        assertTrue(bramble.onCrossedBy(witch));
        assertTrue(cell.isEmpty());
    }

    //-------------------- OCCUPANT --------------------
    // The mole does not eat the bramble (rules, section 8).
    @Test
    void theMoleDoesNotEatIt() {
        assertFalse(brambleOn(new Cell(2, 3)).onBittenByMole());
    }

    // Expected by the sheet of the day: the harvest brings nothing, but it is not empty, so Shop.sell accepts it,
    // adds 0 and frees the cell (ShopTest.freeHarvestEmptiesTheCell). No Shop here: its constructor changes on day 8.
    @Test
    void harvestBringsNothingButIsAllowed() {
        assertEquals(OptionalInt.of(0), brambleOn(new Cell(2, 3)).onHarvested());
    }

    // Read by the view to veil the range in white (J10): the bramble only reaches the cell it grows on.
    @Test
    void reachesOnlyItsCell() {
        Bramble bramble = brambleOn(new Cell(2, 3));

        assertTrue(bramble.reaches(2, 3));
        assertFalse(bramble.reaches(2, 2));
        assertFalse(bramble.reaches(1, 3));
    }
}
