package com.cropa.model.enemy;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

// A SpawnEntry only carries data: it gives back what it was created with.
class SpawnEntryTest {

  @Test
  void givesBackItsTypeRowAndDelay() {
    SpawnEntry entry = new SpawnEntry(EnemyType.WITCH, 3, 12.5f);

    assertEquals(EnemyType.WITCH, entry.getType());
    assertEquals(3, entry.getRow());
    assertEquals(12.5f, entry.getDelay(), 0.001f);
  }

  // The first enemy of a type comes as soon as the wave starts.
  @Test
  void aDelayOfZeroMeansAtTheStartOfTheWave() {
    SpawnEntry entry = new SpawnEntry(EnemyType.BAT, 2, 0f);

    assertEquals(0f, entry.getDelay(), 0.001f);
  }
}
