package com.cropa.model.world;

// JUnit: assertion helpers and the @Test marker.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

/**
 * Tests for {@link CropConfig}.
 */
class CropConfigTest {

  // -------------------- TESTS --------------------
  // Seed prices come from section 10 of the rules, not from the Crop logic.
  /** Each crop has the seed price given by the rules. */
  @Test
  void seedPricesFollowTheRules() {
    CropConfig config = new CropConfig();

    assertEquals(10, config.getSeedPrice(CropType.CARROT));
    assertEquals(20, config.getSeedPrice(CropType.TURNIP));
    assertEquals(20, config.getSeedPrice(CropType.GARLIC));
    assertEquals(50, config.getSeedPrice(CropType.PUMPKIN));
  }

  // The number of stages decides how many nights a crop needs to mature.
  /** Each crop has the number of stages given by the rules. */
  @Test
  void stageCountsFollowTheRules() {
    CropConfig config = new CropConfig();

    assertEquals(2, config.getStageCount(CropType.CARROT));
    assertEquals(3, config.getStageCount(CropType.TURNIP));
    assertEquals(3, config.getStageCount(CropType.GARLIC));
    assertEquals(4, config.getStageCount(CropType.PUMPKIN));
  }

  // Stages are numbered from 0: a crop is born at stage 0, a carrot is mature at
  // stage 1.
  /** A carrot is worth 5 when it grows and 40 when it is mature. */
  @Test
  void carrotValuesFollowTheStages() {
    CropConfig config = new CropConfig();

    assertEquals(5, config.getValue(CropType.CARROT, 0));
    assertEquals(40, config.getValue(CropType.CARROT, 1));
  }

  // Turnip and garlic share the same numbers, so one test covers both.
  /** A turnip and a garlic are worth 0, 25 then 90. */
  @Test
  void turnipAndGarlicValuesFollowTheStages() {
    CropConfig config = new CropConfig();

    assertEquals(0, config.getValue(CropType.TURNIP, 0));
    assertEquals(25, config.getValue(CropType.TURNIP, 1));
    assertEquals(90, config.getValue(CropType.TURNIP, 2));
    assertEquals(0, config.getValue(CropType.GARLIC, 0));
    assertEquals(25, config.getValue(CropType.GARLIC, 1));
    assertEquals(90, config.getValue(CropType.GARLIC, 2));
  }

  /** A pumpkin is worth 0, 70, 210 then 1 000 (700 before day 9, 800 before day 10). */
  @Test
  void pumpkinValuesFollowTheStages() {
    CropConfig config = new CropConfig();

    assertEquals(0, config.getValue(CropType.PUMPKIN, 0));
    assertEquals(70, config.getValue(CropType.PUMPKIN, 1));
    assertEquals(210, config.getValue(CropType.PUMPKIN, 2));
    assertEquals(1000, config.getValue(CropType.PUMPKIN, 3));
  }

  // A stage outside 0..stageCount-1 is a programming error: it fails right away
  // with a clear message.
  /** A stage below 0 or beyond the last one is refused. */
  @Test
  void getValueOutsideTheStagesThrows() {
    CropConfig config = new CropConfig();

    assertThrows(IllegalArgumentException.class, () -> config.getValue(CropType.CARROT, -1));
    assertThrows(IllegalArgumentException.class, () -> config.getValue(CropType.CARROT, 2));
  }
}
