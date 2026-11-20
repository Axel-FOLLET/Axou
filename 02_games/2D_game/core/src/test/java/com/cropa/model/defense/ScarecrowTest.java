package com.cropa.model.defense;

// JUnit: the checks the tests use, and the annotation that marks a test.
// The model: real enemies on a real field, and the farm they walk to. OptionalInt: what onHarvested returns.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cropa.model.enemy.Bat;
import com.cropa.model.enemy.Enemy;
import com.cropa.model.enemy.EnemyConfig;
import com.cropa.model.enemy.EnemyType;
import com.cropa.model.enemy.Witch;
import com.cropa.model.world.Board;
import com.cropa.model.world.Cell;
import com.cropa.model.world.Farm;
import java.util.ArrayList;
import java.util.List;
import java.util.OptionalInt;
import java.util.Random;
import org.junit.jupiter.api.Test;

// No extends: JUnit finds the tests through @Test. A scarecrow of level 1 removes 4 health points.
// The health of the witch is read in EnemyConfig: a playtest may change it without breaking these tests.
/** Tests for {@link Scarecrow}. */
class ScarecrowTest {

    //-------------------- FIELDS --------------------
    private static final float FRAME = 1f / 60f;
    private static final int WITCH_HEALTH = new EnemyConfig().getHealth(EnemyType.WITCH);
    private static final int ONE_PUNCH = WITCH_HEALTH - 4;
    private final DefenseConfig config = new DefenseConfig();
    private final EnemyConfig enemyConfig = new EnemyConfig();
    private final Farm farm = new Farm(100);
    private final List<Enemy> enemies = new ArrayList<>();

    //-------------------- HELPERS --------------------
    // A scarecrow placed on its own cell, as DefenseSlots.placeOnField would do.
    private Scarecrow scarecrowOn(Cell cell) {
        Scarecrow scarecrow = new Scarecrow(cell, config, enemies);
        cell.place(scarecrow);
        return scarecrow;
    }

    // Walks an enemy to the middle of a column: column c holds the cells left between c + 2 and c + 3.
    // The enemies are built without a field: they cross no cell on their way, the test only places them.
    private <E extends Enemy> E walkedTo(E enemy, int column) {
        enemy.update((enemyConfig.getSpawnCellsToFarm() - (column + 2.5f)) / enemyConfig.getSpeed(enemy.getType()));
        enemies.add(enemy);
        return enemy;
    }

    private Witch witchOn(int row, int column) {
        return walkedTo(new Witch(row, farm, enemyConfig), column);
    }

    //-------------------- THE PUNCH --------------------
    // Expected by the sheet of the day: -4 HP at the first punch, -4 more after 1.5 s, nothing in between.
    @Test
    void punchesAWitchOnItsCellEveryOneAndAHalfSecond() {
        Witch witch = witchOn(2, 3);
        Scarecrow scarecrow = scarecrowOn(new Cell(2, 3));

        scarecrow.update(FRAME);
        assertEquals(WITCH_HEALTH - 4, witch.getHealth());

        scarecrow.update(1f);
        assertEquals(WITCH_HEALTH - 4, witch.getHealth());

        scarecrow.update(0.5f);
        assertEquals(WITCH_HEALTH - 8, witch.getHealth());
    }

    // The cross of the rules: the 4 cells next to it, one at a time.
    @Test
    void reachesTheFourCellsOfTheCross() {
        int[][] cross = { { 1, 3 }, { 3, 3 }, { 2, 2 }, { 2, 4 } };
        for (int[] place : cross) {
            enemies.clear();
            Witch witch = witchOn(place[0], place[1]);

            scarecrowOn(new Cell(2, 3)).update(FRAME);

            assertEquals(ONE_PUNCH, witch.getHealth());
        }
    }

    // A diagonal is 2 cells away: out of the cross.
    @Test
    void doesNotReachADiagonal() {
        Witch witch = witchOn(1, 4);

        scarecrowOn(new Cell(2, 3)).update(FRAME);

        assertEquals(WITCH_HEALTH, witch.getHealth());
    }

    // Column 6 is not a cell of the field: an enemy that has not entered it is out of reach of column 5.
    @Test
    void doesNotReachAnEnemyBeforeTheField() {
        Witch witch = witchOn(2, 6);

        scarecrowOn(new Cell(2, 5)).update(FRAME);

        assertEquals(WITCH_HEALTH, witch.getHealth());
    }

    // Expected by the sheet of the day: the bat flies, the scarecrow does not punch it.
    @Test
    void doesNotPunchABat() {
        Bat bat = walkedTo(new Bat(2, farm, enemyConfig), 3);

        scarecrowOn(new Cell(2, 3)).update(FRAME);

        assertEquals(enemyConfig.getHealth(EnemyType.BAT), bat.getHealth());
    }

    // A dead enemy stays in the list until the game removes it. Closer to the farm, it would be the target: the
    // scarecrow skips it and punches the living witch behind it.
    @Test
    void skipsADeadEnemyAndPunchesTheLivingOne() {
        Witch dead = witchOn(2, 2);
        dead.takeDamage(WITCH_HEALTH);
        Witch alive = witchOn(2, 3);

        scarecrowOn(new Cell(2, 3)).update(FRAME);

        assertEquals(ONE_PUNCH, alive.getHealth());
    }

    // A punch does not wear it: only a crossing does.
    @Test
    void aPunchDoesNotWearIt() {
        witchOn(2, 3);
        Scarecrow scarecrow = scarecrowOn(new Cell(2, 3));

        scarecrow.update(FRAME);

        assertEquals(100, scarecrow.getDurability());
    }

    // Damage 4 / 6 / 9: at level 2, a punch removes 6.
    @Test
    void damageFollowsTheLevel() {
        Witch witch = witchOn(2, 3);
        Scarecrow scarecrow = scarecrowOn(new Cell(2, 3));
        scarecrow.upgrade();

        scarecrow.update(FRAME);

        assertEquals(WITCH_HEALTH - 6, witch.getHealth());
    }

    // At 0 %, the scarecrow no longer punches, even with a witch on its cell and no cooldown to wait.
    @Test
    void aDestroyedScarecrowNoLongerPunches() {
        Witch witch = witchOn(2, 3);
        Scarecrow scarecrow = scarecrowOn(new Cell(2, 3));
        scarecrow.wear(100);

        scarecrow.update(FRAME);

        assertEquals(WITCH_HEALTH, witch.getHealth());
    }

    // A zero or negative time changes nothing: without this guard, the first punch (ready at 0 s) would land
    // without any time passing.
    @Test
    void aNonPositiveDeltaDoesNotPunch() {
        Witch witch = witchOn(2, 3);
        Scarecrow scarecrow = scarecrowOn(new Cell(2, 3));

        scarecrow.update(0f);
        scarecrow.update(-1f);

        assertEquals(WITCH_HEALTH, witch.getHealth());
    }

    //-------------------- THE CROSSING --------------------
    // Expected by the sheet of the day: a witch walks across it on a real field, -10 %, and it stays on its cell.
    @Test
    void aWitchCrossingItLeavesItAtNinety() {
        Board board = new Board();
        Cell cell = board.getCell(2, 3);
        Scarecrow scarecrow = scarecrowOn(cell);
        Witch witch = new Witch(2, farm, board, enemyConfig, (row, column, percent) -> {
        }, new Random(0));

        while (witch.getCellsToFarm() > 3) {
            witch.update(FRAME);
        }

        assertEquals(90, scarecrow.getDurability());
        assertSame(scarecrow, cell.getOccupant().orElseThrow());
    }

    // Expected by the sheet of the day: at 0 %, the cell is empty.
    @Test
    void atZeroItLeavesItsCell() {
        Cell cell = new Cell(2, 3);
        Scarecrow scarecrow = scarecrowOn(cell);

        scarecrow.wear(100);

        assertTrue(cell.isEmpty());
    }

    // The tenth crossing destroys it: onCrossedBy then says it leaves.
    @Test
    void theTenthCrossingDestroysIt() {
        Cell cell = new Cell(2, 3);
        Scarecrow scarecrow = scarecrowOn(cell);
        Witch witch = new Witch(2, farm, enemyConfig);

        for (int crossing = 1; crossing <= 9; crossing++) {
            assertFalse(scarecrow.onCrossedBy(witch));
        }
        assertTrue(scarecrow.onCrossedBy(witch));
        assertTrue(cell.isEmpty());
    }

    //-------------------- OCCUPANT --------------------
    // The mole eats crops, not the scarecrow. Its sprite key is the one listed in SpriteCatalog.
    @Test
    void theMoleDoesNotEatItAndItsSpriteIsScarecrow() {
        Scarecrow scarecrow = scarecrowOn(new Cell(2, 3));

        assertFalse(scarecrow.onBittenByMole());
        assertEquals("scarecrow", scarecrow.spriteKey());
    }

    //-------------------- THE CELLS IT REACHES (J10) --------------------
    // Read by the view to veil the range in white. The cross of the rules, with the range 1 of DefenseConfig: its
    // cell and the four next to it, not the diagonals, and nothing outside the field.
    @Test
    void reachesItsCross() {
        Scarecrow scarecrow = scarecrowOn(new Cell(1, 3));

        assertTrue(scarecrow.reaches(1, 3));
        assertTrue(scarecrow.reaches(1, 2));
        assertTrue(scarecrow.reaches(1, 4));
        assertTrue(scarecrow.reaches(2, 3));
        assertFalse(scarecrow.reaches(2, 2));
        assertFalse(scarecrow.reaches(0, 3));
    }

    // In the corner of the field, its cross would spill over the edge: the flee row under it and the column on the
    // farm side are 1 cell away, yet out of the field, so out of reach.
    @Test
    void doesNotReachPastTheEdgeOfTheField() {
        Scarecrow scarecrow = scarecrowOn(new Cell(3, 1));

        assertTrue(scarecrow.reaches(3, 1));
        assertFalse(scarecrow.reaches(4, 1));
        assertFalse(scarecrow.reaches(3, 0));
    }

    //-------------------- THE ATTACK IMAGE (J14) --------------------
    // Read by WorldRenderer through spriteKey: the scarecrow punches for 0.3 s after a punch, then stands still again.
    @Test
    void showsItsAttackImageForAShortInstantAfterAPunch() {
        witchOn(2, 3);
        Scarecrow scarecrow = scarecrowOn(new Cell(2, 3));

        scarecrow.update(FRAME);
        assertTrue(scarecrow.isAttacking());
        assertEquals("scarecrow_attack", scarecrow.spriteKey());

        scarecrow.update(0.3f);
        assertFalse(scarecrow.isAttacking());
        assertEquals("scarecrow", scarecrow.spriteKey());
    }

    //-------------------- THE REMOVAL (J14) --------------------
    // Read by Shop.sell when the player clicks "Retirer": 0 coins, and the cell can be emptied, like the bramble.
    @Test
    void itsRemovalBringsNothing() {
        assertEquals(OptionalInt.of(0), scarecrowOn(new Cell(2, 3)).onHarvested());
    }

    // No enemy in reach: no punch, the still image.
    @Test
    void staysStillWithoutAPunch() {
        Scarecrow scarecrow = scarecrowOn(new Cell(2, 3));

        scarecrow.update(FRAME);

        assertEquals("scarecrow", scarecrow.spriteKey());
    }
}
