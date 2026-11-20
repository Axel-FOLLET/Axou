package com.cropa.model.defense;

// JUnit: the checks the tests use, and the annotation that marks a test.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cropa.model.enemy.Bat;
import com.cropa.model.enemy.Enemy;
import com.cropa.model.enemy.EnemyConfig;
import com.cropa.model.enemy.EnemyType;
import com.cropa.model.enemy.Witch;
import com.cropa.model.world.Cell;
import com.cropa.model.world.Farm;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

// No extends: JUnit finds the tests through @Test. A catapatate of level 1 removes 2 health points.
// The health of the witch is read in EnemyConfig: a playtest may change it without breaking these tests.
/** Tests for {@link Catapatate}. */
class CatapatateTest {

    //-------------------- FIELDS --------------------
    private static final float FRAME = 1f / 60f;
    private static final int WITCH_HEALTH = new EnemyConfig().getHealth(EnemyType.WITCH);
    private static final int ONE_SHOT = WITCH_HEALTH - 2;
    private final DefenseConfig config = new DefenseConfig();
    private final EnemyConfig enemyConfig = new EnemyConfig();
    private final Farm farm = new Farm(100);
    private final List<Enemy> enemies = new ArrayList<>();

    //-------------------- HELPERS --------------------
    private Catapatate catapatateOn(SlotSide side, int column) {
        return new Catapatate(new DefenseSlot(side, column), config, enemies);
    }

    // Walks a witch to the middle of a column: column c holds the cells left between c + 2 and c + 3.
    private Witch witchOn(int row, int column) {
        Witch witch = new Witch(row, farm, enemyConfig);
        witch.update((enemyConfig.getSpawnCellsToFarm() - (column + 2.5f)) / enemyConfig.getSpeed(EnemyType.WITCH));
        enemies.add(witch);
        return witch;
    }

    // Plays the frames of one enemy crossing the field, with every catapatate acting on each frame.
    private void playUntilPastTheField(Enemy enemy, List<Catapatate> catapatates) {
        while (!enemy.isDead() && enemy.getCellsToFarm() > 3) {
            enemy.update(FRAME);
            for (Catapatate catapatate : catapatates) {
                catapatate.update(FRAME);
            }
        }
    }

    // An enemy that cannot be hit, like a mole underground. Mole does not exist yet.
    private static class HiddenEnemy extends Enemy {
        HiddenEnemy(int row, float cellsToFarm, EnemyConfig config) {
            super(EnemyType.MOLE, row, config);
            moveTowardsFarm(config.getSpawnCellsToFarm() - cellsToFarm);
        }

        @Override
        public void update(float delta) {
        }

        @Override
        public String spriteKey() {
            return "hidden";
        }

        @Override
        public boolean isTargetable() {
            return false;
        }

        @Override
        public void onEnterCell(Cell cell) {
        }
    }

    //-------------------- NOTHING TO SHOOT --------------------
    // Expected by the sheet of the day: no enemy, no shot, no wear.
    @Test
    void doesNotShootOrWearWithoutEnemyInRange() {
        Catapatate catapatate = catapatateOn(SlotSide.TOP, 3);

        catapatate.update(5f);

        assertEquals(100, catapatate.getDurability());
    }

    // Waiting does not store shots: after a long wait, there is still one shot per second.
    @Test
    void waitingKeepsNoShotInReserve() {
        Catapatate catapatate = catapatateOn(SlotSide.TOP, 3);
        catapatate.update(5f);
        Witch witch = witchOn(1, 3);

        catapatate.update(FRAME);
        catapatate.update(FRAME);

        assertEquals(ONE_SHOT, witch.getHealth());
    }

    //-------------------- THE DIAMOND --------------------
    // Straight ahead, one row away.
    @Test
    void reachesItsColumnOnTheNextRow() {
        Witch witch = witchOn(1, 3);

        catapatateOn(SlotSide.TOP, 3).update(FRAME);

        assertEquals(ONE_SHOT, witch.getHealth());
    }

    // The two diagonals of the rules.
    @Test
    void reachesTheNeighbourColumnsOnTheNextRow() {
        Witch left = witchOn(1, 2);
        Witch right = witchOn(1, 4);

        catapatateOn(SlotSide.TOP, 2).update(FRAME);
        assertEquals(ONE_SHOT, left.getHealth());
        assertEquals(WITCH_HEALTH, right.getHealth());

        enemies.remove(left);
        catapatateOn(SlotSide.TOP, 3).update(FRAME);
        assertEquals(ONE_SHOT, right.getHealth());
    }

    // Two cells straight ahead.
    @Test
    void reachesItsColumnTwoRowsAway() {
        Witch witch = witchOn(2, 3);

        catapatateOn(SlotSide.TOP, 3).update(FRAME);

        assertEquals(ONE_SHOT, witch.getHealth());
    }

    // Two rows away the diamond is one column wide: a neighbour column is out of reach.
    @Test
    void doesNotReachNeighbourColumnsTwoRowsAway() {
        Witch witch = witchOn(2, 4);

        catapatateOn(SlotSide.TOP, 3).update(FRAME);

        assertEquals(WITCH_HEALTH, witch.getHealth());
    }

    // Column 2 away on the next row: outside the diagonals.
    @Test
    void doesNotReachTwoColumnsAwayOnTheNextRow() {
        Witch witch = witchOn(1, 5);

        catapatateOn(SlotSide.TOP, 3).update(FRAME);

        assertEquals(WITCH_HEALTH, witch.getHealth());
    }

    // The far row is 3 cells away from a slot above the field.
    @Test
    void doesNotReachTheFarRow() {
        Witch witch = witchOn(3, 3);

        catapatateOn(SlotSide.TOP, 3).update(FRAME);

        assertEquals(WITCH_HEALTH, witch.getHealth());
    }

    // Column 5 has no neighbour on its right: an enemy that has not entered the field cannot be shot.
    @Test
    void doesNotReachAnEnemyBeforeTheField() {
        Witch witch = witchOn(1, 6);

        catapatateOn(SlotSide.TOP, 5).update(FRAME);

        assertEquals(WITCH_HEALTH, witch.getHealth());
    }

    // Same on the other edge: an enemy past column 1 has left the field.
    @Test
    void doesNotReachAnEnemyPastTheField() {
        Witch witch = witchOn(1, 0);

        catapatateOn(SlotSide.TOP, 1).update(FRAME);

        assertEquals(WITCH_HEALTH, witch.getHealth());
    }

    // Row 3 is the row next to the slots under the field.
    @Test
    void bottomSlotReachesRowThree() {
        Witch witch = witchOn(3, 3);

        catapatateOn(SlotSide.BOTTOM, 3).update(FRAME);

        assertEquals(ONE_SHOT, witch.getHealth());
    }

    //-------------------- THE TARGET --------------------
    // Expected by the sheet of the day: busy on row 1, it leaves row 2 alone.
    @Test
    void busyOnRowOneDoesNotShootRowTwo() {
        Witch rowOne = witchOn(1, 3);
        Witch rowTwo = witchOn(2, 3);

        catapatateOn(SlotSide.TOP, 3).update(FRAME);

        assertEquals(ONE_SHOT, rowOne.getHealth());
        assertEquals(WITCH_HEALTH, rowTwo.getHealth());
    }

    // Same rule from under the field: row 3 first.
    @Test
    void bottomSlotPrefersRowThreeToRowTwo() {
        Witch rowThree = witchOn(3, 3);
        Witch rowTwo = witchOn(2, 3);

        catapatateOn(SlotSide.BOTTOM, 3).update(FRAME);

        assertEquals(ONE_SHOT, rowThree.getHealth());
        assertEquals(WITCH_HEALTH, rowTwo.getHealth());
    }

    // On the same row, the enemy closest to the farm goes first, whatever the order of the list.
    @Test
    void shootsTheEnemyClosestToTheFarm() {
        Witch behind = witchOn(1, 4);
        Witch ahead = witchOn(1, 3);

        catapatateOn(SlotSide.TOP, 3).update(FRAME);

        assertEquals(WITCH_HEALTH, behind.getHealth());
        assertEquals(ONE_SHOT, ahead.getHealth());
    }

    // Underground, a mole cannot be touched, and the shot is not wasted.
    @Test
    void ignoresAnEnemyThatCannotBeHit() {
        enemies.add(new HiddenEnemy(1, 5.5f, enemyConfig));
        Catapatate catapatate = catapatateOn(SlotSide.TOP, 3);

        catapatate.update(FRAME);

        assertEquals(100, catapatate.getDurability());
    }

    // A dead enemy stays in the list until the game removes it: no shot is wasted on it.
    @Test
    void ignoresADeadEnemy() {
        Witch dead = witchOn(1, 3);
        dead.takeDamage(WITCH_HEALTH);
        Catapatate catapatate = catapatateOn(SlotSide.TOP, 3);

        catapatate.update(FRAME);

        assertEquals(100, catapatate.getDurability());
    }

    //-------------------- THE SHOT --------------------
    // One shot per second, not one per frame.
    @Test
    void shootsOncePerSecond() {
        Witch witch = witchOn(1, 3);
        Catapatate catapatate = catapatateOn(SlotSide.TOP, 3);

        catapatate.update(FRAME);
        assertEquals(WITCH_HEALTH - 2, witch.getHealth());

        catapatate.update(0.5f);
        assertEquals(WITCH_HEALTH - 2, witch.getHealth());

        catapatate.update(0.5f);
        assertEquals(WITCH_HEALTH - 4, witch.getHealth());
    }

    // Each shot costs 2 % of durability.
    @Test
    void eachShotWearsTwoPercent() {
        witchOn(1, 3);
        Catapatate catapatate = catapatateOn(SlotSide.TOP, 3);

        catapatate.update(FRAME);

        assertEquals(98, catapatate.getDurability());
    }

    // Damage 2 / 3 / 5: at level 2, a shot removes 3.
    @Test
    void damageFollowsTheLevel() {
        Witch witch = witchOn(1, 3);
        Catapatate catapatate = catapatateOn(SlotSide.TOP, 3);
        catapatate.upgrade();

        catapatate.update(FRAME);

        assertEquals(WITCH_HEALTH - 3, witch.getHealth());
    }

    // At 0 %, the catapatate no longer shoots.
    @Test
    void destroyedCatapatateDoesNotShoot() {
        Witch witch = witchOn(1, 3);
        Catapatate catapatate = catapatateOn(SlotSide.TOP, 3);
        catapatate.wear(100);

        catapatate.update(FRAME);

        assertEquals(WITCH_HEALTH, witch.getHealth());
    }

    // A zero or negative time changes nothing.
    @Test
    void nonPositiveDeltaDoesNothing() {
        Witch witch = witchOn(1, 3);
        Catapatate catapatate = catapatateOn(SlotSide.TOP, 3);

        catapatate.update(0f);
        catapatate.update(-1f);

        assertEquals(WITCH_HEALTH, witch.getHealth());
    }

    //-------------------- DESTRUCTION --------------------
    // Expected by the sheet of the day: at 1 %, the catapatate is still on its slot.
    @Test
    void staysOnItsSlotWhileSomeDurabilityRemains() {
        DefenseSlot slot = new DefenseSlot(SlotSide.TOP, 3);
        Catapatate catapatate = new Catapatate(slot, config, enemies);
        slot.place(catapatate);

        catapatate.wear(99);

        assertFalse(slot.isEmpty());
    }

    // Expected by the sheet of the day: at 0 %, it leaves its slot by itself, nobody has to watch it.
    @Test
    void leavesItsSlotAtZeroPercent() {
        DefenseSlot slot = new DefenseSlot(SlotSide.TOP, 3);
        Catapatate catapatate = new Catapatate(slot, config, enemies);
        slot.place(catapatate);

        catapatate.wear(99);
        catapatate.wear(1);

        assertTrue(slot.isEmpty());
    }

    //-------------------- THE MARKERS OF THE RULES --------------------
    // Rules, section 10 (numbers of day 9): alone on row 1, a catapatate covers 3 columns, about 2.9 s each for a bat
    // at 0.35 cell/s: it fires 9 times (18 damage) and leaves the bat (20 HP) with 2 health points.
    @Test
    void oneCatapatateLeavesABatOnTwoHealthPoints() {
        Bat bat = new Bat(1, farm, enemyConfig);
        enemies.add(bat);
        Catapatate catapatate = catapatateOn(SlotSide.TOP, 3);

        playUntilPastTheField(bat, List.of(catapatate));

        assertEquals(2, bat.getHealth());
        assertEquals(82, catapatate.getDurability());
    }

    // Rules, section 10: a witch at 0.3 cell/s spends about 3.3 s per column, 4 shots of 2: 8 damage per column.
    // On row 2, the 5 top catapatates (one per column) remove 40: the witch (45 HP) survives with 5.
    @Test
    void fiveTopCatapatatesLeaveAWitchOnRowTwoWithFiveHealthPoints() {
        Witch witch = new Witch(2, farm, enemyConfig);
        enemies.add(witch);
        List<Catapatate> catapatates = new ArrayList<>();
        for (int column = 1; column <= 5; column++) {
            catapatates.add(catapatateOn(SlotSide.TOP, column));
        }

        playUntilPastTheField(witch, catapatates);

        assertFalse(witch.isDead());
        assertEquals(5, witch.getHealth());
    }

    // Rules, section 10: on row 1, a top catapatate covers 3 columns, about 10 s: 10 shots, 20 damage.
    // Two neighbours leave a witch (45 HP) with 5; three neighbours kill her.
    @Test
    void twoNeighbourTopCatapatatesLeaveAWitchOnRowOneWithFiveHealthPoints() {
        Witch witch = new Witch(1, farm, enemyConfig);
        enemies.add(witch);

        playUntilPastTheField(witch, List.of(catapatateOn(SlotSide.TOP, 2), catapatateOn(SlotSide.TOP, 3)));

        assertEquals(5, witch.getHealth());
    }

    @Test
    void threeNeighbourTopCatapatatesKillAWitchOnRowOne() {
        Witch witch = new Witch(1, farm, enemyConfig);
        enemies.add(witch);

        playUntilPastTheField(witch,
                List.of(catapatateOn(SlotSide.TOP, 2), catapatateOn(SlotSide.TOP, 3), catapatateOn(SlotSide.TOP, 4)));

        assertTrue(witch.isDead());
    }

    // A sixth one, under the field, also reaches row 2: it finishes the same witch.
    @Test
    void fiveTopAndOneBottomCatapatatesKillAWitchOnRowTwo() {
        Witch witch = new Witch(2, farm, enemyConfig);
        enemies.add(witch);
        List<Catapatate> catapatates = new ArrayList<>();
        for (int column = 1; column <= 5; column++) {
            catapatates.add(catapatateOn(SlotSide.TOP, column));
        }
        catapatates.add(catapatateOn(SlotSide.BOTTOM, 3));

        playUntilPastTheField(witch, catapatates);

        assertTrue(witch.isDead());
    }

    //-------------------- THE CELLS IT REACHES (J10) --------------------
    // Read by the view to veil the range in white. The diamond of the rules, with the range 2 of DefenseConfig:
    // from TOP 3, columns 2, 3 and 4 on row 1, only column 3 on row 2, nothing on row 3.
    @Test
    void aTopCatapatateReachesItsDiamond() {
        Catapatate catapatate = catapatateOn(SlotSide.TOP, 3);

        assertTrue(catapatate.reaches(1, 2));
        assertTrue(catapatate.reaches(1, 3));
        assertTrue(catapatate.reaches(1, 4));
        assertTrue(catapatate.reaches(2, 3));
        assertFalse(catapatate.reaches(1, 1));
        assertFalse(catapatate.reaches(2, 2));
        assertFalse(catapatate.reaches(3, 3));
    }

    // From the bottom, the diamond is upside down: row 3 first, then row 2.
    @Test
    void aBottomCatapatateReachesItsDiamondFromBelow() {
        Catapatate catapatate = catapatateOn(SlotSide.BOTTOM, 1);

        assertTrue(catapatate.reaches(3, 1));
        assertTrue(catapatate.reaches(3, 2));
        assertTrue(catapatate.reaches(2, 1));
        assertFalse(catapatate.reaches(2, 2));
        assertFalse(catapatate.reaches(1, 1));
        assertFalse(catapatate.reaches(3, 0));
    }

    // The flee row it stands on is 0 rows away: the diamond would include it, but the enemies that flee by it are
    // never in reach (rules, section 7). The same from the top and from the bottom.
    @Test
    void doesNotReachTheFleeRowNextToItsSlot() {
        Catapatate top = catapatateOn(SlotSide.TOP, 3);
        Catapatate bottom = catapatateOn(SlotSide.BOTTOM, 1);

        assertFalse(top.reaches(0, 3));
        assertFalse(bottom.reaches(4, 1));
    }

    //-------------------- THE ATTACK IMAGE (J14) --------------------
    // Read by DefenseRenderer: the catapatate throws for 0.3 s after a shot, then is still again until the next one.
    @Test
    void showsItsAttackImageForAShortInstantAfterAShot() {
        witchOn(1, 3);
        Catapatate catapatate = catapatateOn(SlotSide.TOP, 3);
        assertFalse(catapatate.isAttacking());

        catapatate.update(FRAME);
        assertTrue(catapatate.isAttacking());

        catapatate.update(0.3f);
        assertFalse(catapatate.isAttacking());
    }

    // No enemy in reach, no shot: the image stays still.
    @Test
    void doesNotShowItsAttackImageWithoutAShot() {
        Catapatate catapatate = catapatateOn(SlotSide.TOP, 3);

        catapatate.update(FRAME);

        assertFalse(catapatate.isAttacking());
    }
}
