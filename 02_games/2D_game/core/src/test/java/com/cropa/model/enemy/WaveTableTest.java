package com.cropa.model.enemy;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;

// The waves of the 8 nights (rules.md §10), and the choices of track B:
// the list is sorted by delay, moles then bats then witches when two delays are equal,
// the i-th enemy of a type among n comes i * 10 / n seconds after the start of the wave,
// and the rows are those of the table, otherwise 1, 2, 3 in turn for each type.
class WaveTableTest {

  // The numbers of §10, written again here on purpose: this test checks the table against the rules.
  // One line per night, from night 1 to night 8: moles, bats, witches. Moles halved on day 10 (balance simulated).
  private static final int[][] RULES = {
    {0, 2, 0},
    {1, 4, 0},
    {1, 5, 1},
    {2, 6, 2},
    {2, 8, 2},
    {3, 8, 3},
    {3, 10, 4},
    {4, 12, 5},
  };

  private final WaveTable table = new WaveTable();

  private static long countOf(List<SpawnEntry> wave, EnemyType type) {
    return wave.stream().filter(entry -> entry.getType() == type).count();
  }

  // The entries of one type, in the order of the wave.
  private static List<SpawnEntry> entriesOf(List<SpawnEntry> wave, EnemyType type) {
    return wave.stream().filter(entry -> entry.getType() == type).toList();
  }

  // -------------------- START --------------------

  // No enemy before 5 s (§3): the player has time to look at the field.
  @Test
  void theWaveStartsFiveSecondsAfterNightfall() {
    assertEquals(5f, table.getStartDelay(), 0.001f);
  }

  // -------------------- NUMBERS OF §10 --------------------

  @Test
  void eachNightHasTheNumbersOfTheRules() {
    for (int night = 1; night <= 8; night++) {
      List<SpawnEntry> wave = table.getWave(night);
      int[] expected = RULES[night - 1];

      assertEquals(expected[0], countOf(wave, EnemyType.MOLE), "moles of night " + night);
      assertEquals(expected[1], countOf(wave, EnemyType.BAT), "bats of night " + night);
      assertEquals(expected[2], countOf(wave, EnemyType.WITCH), "witches of night " + night);
    }
  }

  // The landmark of the day sheet.
  @Test
  void theEightNightsHold16Moles55BatsAnd17Witches() {
    long moles = 0;
    long bats = 0;
    long witches = 0;
    for (int night = 1; night <= 8; night++) {
      List<SpawnEntry> wave = table.getWave(night);
      moles += countOf(wave, EnemyType.MOLE);
      bats += countOf(wave, EnemyType.BAT);
      witches += countOf(wave, EnemyType.WITCH);
    }

    assertEquals(16, moles);
    assertEquals(55, bats);
    assertEquals(17, witches);
  }

  @Test
  void thereIsNoNightBeforeTheFirstNorAfterTheEighth() {
    assertThrows(IllegalArgumentException.class, () -> table.getWave(0));
    assertThrows(IllegalArgumentException.class, () -> table.getWave(9));
  }

  // -------------------- ROWS --------------------

  // §10: the 2 bats of night 1 are on row 2.
  @Test
  void bothBatsOfNightOneAreOnRowTwo() {
    for (SpawnEntry bat : entriesOf(table.getWave(1), EnemyType.BAT)) {
      assertEquals(2, bat.getRow());
    }
  }

  // §10: the witch of night 3 is on row 2.
  @Test
  void theWitchOfNightThreeIsOnRowTwo() {
    List<SpawnEntry> witches = entriesOf(table.getWave(3), EnemyType.WITCH);

    assertEquals(1, witches.size());
    assertEquals(2, witches.get(0).getRow());
  }

  // §10: "5 witches, 2 of them on row 2". Rows 1, 2, 3, 1, 2 give exactly that.
  @Test
  void twoOfTheFiveWitchesOfNightEightAreOnRowTwo() {
    List<SpawnEntry> witches = entriesOf(table.getWave(8), EnemyType.WITCH);

    long onRowTwo = witches.stream().filter(witch -> witch.getRow() == 2).count();
    assertEquals(2, onRowTwo);
  }

  // When the table gives no row: 1, 2, 3, then 1 again, counted for each type on its own.
  @Test
  void withoutARowInTheTableEachTypeTakesRowsOneTwoThreeInTurn() {
    List<SpawnEntry> wave = table.getWave(2);

    List<Integer> batRows = entriesOf(wave, EnemyType.BAT).stream().map(SpawnEntry::getRow).toList();
    assertEquals(List.of(1, 2, 3, 1), batRows);
    // The only mole of night 2 starts the count again at row 1.
    assertEquals(1, entriesOf(wave, EnemyType.MOLE).get(0).getRow());
  }

  // Every row is a row of the field: an enemy can never be created on a flee row.
  @Test
  void everyEnemyStartsOnARowOfTheField() {
    for (int night = 1; night <= 8; night++) {
      for (SpawnEntry entry : table.getWave(night)) {
        assertTrue(entry.getRow() >= 1 && entry.getRow() <= 3, "row " + entry.getRow() + " in night " + night);
      }
    }
  }

  // -------------------- DELAYS --------------------

  // 4 bats on night 2: one every 10 / 4 = 2.5 s, the first one as soon as the wave starts (10 s since day 9).
  @Test
  void theEnemiesOfOneTypeAreSpreadOverTenSeconds() {
    List<Float> batDelays = entriesOf(table.getWave(2), EnemyType.BAT).stream().map(SpawnEntry::getDelay).toList();

    assertEquals(List.of(0f, 2.5f, 5f, 7.5f), batDelays);
  }

  // The last enemy of a type comes before the 10 s of the wave are over.
  @Test
  void everyDelayIsBetweenZeroAndTenSeconds() {
    for (int night = 1; night <= 8; night++) {
      for (SpawnEntry entry : table.getWave(night)) {
        assertTrue(entry.getDelay() >= 0f && entry.getDelay() < 10f, "delay " + entry.getDelay());
      }
    }
  }

  // -------------------- ORDER --------------------

  // WaveSpawner reads the list from the start: each delay is at least the one before.
  @Test
  void eachWaveIsSortedByDelay() {
    for (int night = 1; night <= 8; night++) {
      List<SpawnEntry> wave = table.getWave(night);
      for (int i = 1; i < wave.size(); i++) {
        assertTrue(wave.get(i - 1).getDelay() <= wave.get(i).getDelay(), "night " + night + ", entry " + i);
      }
    }
  }

  // Night 3: the mole at 0 s, bats at 0, 2, 4, 6 and 8 s, the witch at 0 s.
  // The three of 0 s come together, always in the same order: the mole, the bat, then the witch.
  @Test
  void equalDelaysComeInTheOrderMoleBatWitch() {
    List<EnemyType> types = table.getWave(3).stream().map(SpawnEntry::getType).toList();

    assertEquals(
        List.of(
            EnemyType.MOLE, EnemyType.BAT, EnemyType.WITCH,
            EnemyType.BAT, EnemyType.BAT, EnemyType.BAT, EnemyType.BAT),
        types);
  }

  // -------------------- A NEW LIST EACH TIME --------------------

  // WaveSpawner may empty the list it gets: the next night 1 must still be whole.
  @Test
  void changingAWaveDoesNotChangeTheTable() {
    table.getWave(1).clear();

    assertEquals(2, table.getWave(1).size());
  }
}
