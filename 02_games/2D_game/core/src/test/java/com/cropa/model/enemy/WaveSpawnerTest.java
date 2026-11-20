package com.cropa.model.enemy;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cropa.model.world.Board;
import com.cropa.model.world.DefenseLine;
import com.cropa.model.world.Farm;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

// The wave of a night comes WaveTable.getStartDelay() (5 s) after nightfall; the delay of each entry counts from
// there. update returns the enemies created during this frame: all those that are due, even several at once.
class WaveSpawnerTest {

  // A defense line that does nothing: these tests are not about the wear (see LaneEnemyWearTest).
  private static final DefenseLine NO_WEAR = (row, column, percent) -> { };

  private final EnemyConfig config = new EnemyConfig();
  private final WaveTable table = new WaveTable();

  private WaveSpawner spawner;

  @BeforeEach
  void createTheSpawner() {
    Farm farm = new Farm(config.getFarmHealth());
    EnemyFactory factory = new EnemyFactory(new Board(), farm, config, NO_WEAR, new Random(1));
    spawner = new WaveSpawner(table, factory);
  }

  private static List<EnemyType> typesOf(List<Enemy> enemies) {
    return enemies.stream().map(Enemy::getType).toList();
  }

  // -------------------- THE LANDMARKS OF NIGHT 1 --------------------

  // Night 1: 2 bats on row 2, at 0 s and 10 s of the wave, so at 5 s and 15 s of the night.
  @Test
  void nightOneFollowsTheLandmarksOfTheDaySheet() {
    spawner.startNight(1);

    assertTrue(spawner.update(4.9f).isEmpty());

    List<Enemy> first = spawner.update(0.2f);
    assertEquals(List.of(EnemyType.BAT), typesOf(first));
    assertEquals(2, first.get(0).getRow());
    assertFalse(spawner.isFinished());

    List<Enemy> second = spawner.update(10f);
    assertEquals(List.of(EnemyType.BAT), typesOf(second));
    assertEquals(2, second.get(0).getRow());
    assertTrue(spawner.isFinished());
  }

  // Nothing waits any more: later frames create nothing.
  @Test
  void anEnemyIsCreatedOnlyOnce() {
    spawner.startNight(1);
    spawner.update(20f);

    assertTrue(spawner.update(10f).isEmpty());
    assertTrue(spawner.isFinished());
  }

  @Test
  void aNightThatHasJustStartedIsNotFinished() {
    spawner.startNight(1);

    assertFalse(spawner.isFinished());
  }

  // -------------------- SEVERAL ENEMIES IN ONE FRAME --------------------

  // Night 3: the mole, the bat and the witch of 0 s come together, at 5 s, in the order of the table.
  @Test
  void theEnemiesDueInTheSameFrameAreAllCreated() {
    spawner.startNight(3);

    List<Enemy> created = spawner.update(5.1f);

    assertEquals(List.of(EnemyType.MOLE, EnemyType.BAT, EnemyType.WITCH), typesOf(created));
  }

  // A very long frame: every enemy due is created, not only the first one (a while, not an if).
  @Test
  void aLongFrameCreatesTheWholeWave() {
    spawner.startNight(8);

    List<Enemy> created = spawner.update(30f);

    assertEquals(table.getWave(8).size(), created.size());
    assertTrue(spawner.isFinished());
  }

  // -------------------- TIME --------------------

  // A negative delta does not take the clock back: the second bat still comes at 15 s.
  @Test
  void aNegativeDeltaDoesNotTakeTheClockBack() {
    spawner.startNight(1);
    spawner.update(5.1f);

    assertTrue(spawner.update(-10f).isEmpty());
    assertEquals(1, spawner.update(10f).size());
  }

  // -------------------- ONE NIGHT AFTER ANOTHER --------------------

  // Night 2 starts its clock at 0 again: nothing before 5 s, then its mole and its first bat.
  @Test
  void startingANewNightStartsTheClockAgain() {
    spawner.startNight(1);
    spawner.update(20f);

    spawner.startNight(2);

    assertFalse(spawner.isFinished());
    assertTrue(spawner.update(4.9f).isEmpty());
    assertEquals(List.of(EnemyType.MOLE, EnemyType.BAT), typesOf(spawner.update(0.2f)));
  }

  // A new night replaces what was left of the previous wave: its second bat never comes.
  @Test
  void aNewNightReplacesTheWaveNotFinished() {
    spawner.startNight(1);
    spawner.update(5.1f);

    spawner.startNight(1);

    assertTrue(spawner.update(4.9f).isEmpty());
    assertEquals(1, spawner.update(0.2f).size());
  }

  // -------------------- A WHOLE NIGHT --------------------

  // Night 3 as the game will play it: a real factory, board and farm, one update(1f) per second for 45 s.
  // Each second, the enemies already there move first, then the new ones come (they start moving the next second).
  // The table: the mole at 0 s, bats at 0, 2, 4, 6 and 8 s, the witch at 0 s; plus the 5 s of start delay.
  @Test
  void wholeNightThreeCreatesOneMoleFiveBatsAndOneWitch() {
    Farm farm = new Farm(config.getFarmHealth());
    EnemyFactory factory = new EnemyFactory(new Board(), farm, config, NO_WEAR, new Random(1));
    WaveSpawner night = new WaveSpawner(table, factory);
    List<Enemy> enemies = new ArrayList<>();

    night.startNight(3);
    for (int second = 1; second <= 45; second++) {
      for (Enemy enemy : enemies) {
        enemy.update(1f);
      }
      List<Enemy> created = night.update(1f);
      enemies.addAll(created);

      // Nothing during the start delay; then the mole, the bat and the witch of 0 s together.
      if (second < 5) {
        assertTrue(created.isEmpty(), "second " + second);
      }
      if (second == 5) {
        assertEquals(List.of(EnemyType.MOLE, EnemyType.BAT, EnemyType.WITCH), typesOf(created));
      }
      // The last bat comes at 5 + 8 = 13 s (5 bats over 10 s): the wave waits until then.
      if (second == 12) {
        assertFalse(night.isFinished());
      }
    }

    assertTrue(night.isFinished());
    List<EnemyType> types = typesOf(enemies);
    assertEquals(1, types.stream().filter(type -> type == EnemyType.MOLE).count());
    assertEquals(5, types.stream().filter(type -> type == EnemyType.BAT).count());
    assertEquals(1, types.stream().filter(type -> type == EnemyType.WITCH).count());
    // They all live in the same world: the bats and the witch have reached the farm and hit it.
    assertTrue(farm.getHealth() < config.getFarmHealth());
  }

  // -------------------- BEFORE THE FIRST NIGHT --------------------

  // No night started: nothing waits, so nothing comes and it is finished.
  @Test
  void beforeTheFirstNightNothingComes() {
    assertTrue(spawner.isFinished());
    assertTrue(spawner.update(30f).isEmpty());
  }

  // The night is checked by WaveTable: 1 to 8.
  @Test
  void aNightOutsideOneToEightIsRefused() {
    assertThrows(IllegalArgumentException.class, () -> spawner.startNight(9));
  }
}
