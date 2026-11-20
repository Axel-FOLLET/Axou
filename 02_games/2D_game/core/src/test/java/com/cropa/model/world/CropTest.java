package com.cropa.model.world;

// JUnit: assertion helpers and the @Test marker. Optional: what Cell.getOccupant() returns.
// OptionalInt: what onHarvested returns.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Optional;
import java.util.OptionalInt;
import org.junit.jupiter.api.Test;

/**
 * Tests for {@link Crop}.
 */
class CropTest {

  // -------------------- TESTS --------------------
  // A crop is born at stage 0, whatever its type.
  /** A new crop is at stage 0. */
  @Test
  void newCropStartsAtStageZero() {
    Crop crop = new Crop(CropType.CARROT, new CropConfig());

    assertEquals(0, crop.getStage());
  }

  // The value is read from CropConfig: a carrot is worth 5 right away, a turnip 0.
  /** A new crop is worth the value of its first stage. */
  @Test
  void newCropValueIsTheFirstStage() {
    CropConfig config = new CropConfig();

    assertEquals(5, new Crop(CropType.CARROT, config).getValue());
    assertEquals(0, new Crop(CropType.TURNIP, config).getValue());
  }

  // One grow() is one dawn: a carrot has 2 stages, so it needs one night.
  /** A carrot is mature after one night. */
  @Test
  void carrotIsMatureAfterOneNight() {
    Crop crop = new Crop(CropType.CARROT, new CropConfig());

    crop.grow();

    assertTrue(crop.isMature());
  }

  // A pumpkin has 4 stages: still growing after two nights, mature after the third.
  /** A pumpkin is mature after three nights, and not before. */
  @Test
  void pumpkinIsMatureAfterThreeNights() {
    Crop crop = new Crop(CropType.PUMPKIN, new CropConfig());

    crop.grow();
    crop.grow();
    assertFalse(crop.isMature());

    crop.grow();
    assertTrue(crop.isMature());
  }

  // Without this rule the stage would go past the last one and getValue would fail.
  /** Once mature, grow does nothing. */
  @Test
  void growDoesNothingOnceMature() {
    Crop crop = new Crop(CropType.CARROT, new CropConfig());
    crop.grow();
    int stage = crop.getStage();
    int value = crop.getValue();

    crop.grow();

    assertEquals(stage, crop.getStage());
    assertEquals(value, crop.getValue());
    assertTrue(crop.isMature());
  }

  // The expected numbers are the pumpkin's in section 10 of the rules.
  /** The value follows the stage: 0, 70, 210 then 1 000 for a pumpkin. */
  @Test
  void valueFollowsTheStage() {
    Crop crop = new Crop(CropType.PUMPKIN, new CropConfig());

    assertEquals(0, crop.getValue());
    crop.grow();
    assertEquals(70, crop.getValue());
    crop.grow();
    assertEquals(210, crop.getValue());
    crop.grow();
    assertEquals(1000, crop.getValue());
  }

  // Moles eat crops: the crop says so itself, no caller tests its class.
  /** A crop is eaten when a mole bites it. */
  @Test
  void cropIsEatenByMole() {
    Crop crop = new Crop(CropType.CARROT, new CropConfig());

    assertTrue(crop.onBittenByMole());
  }

  // The key is the type in lower case, "_", then the stage: SpriteCatalog finds the file from it.
  /** The sprite key of a new carrot is carrot_0. */
  @Test
  void spriteKeyStartsAtStageZero() {
    assertEquals("carrot_0", new Crop(CropType.CARROT, new CropConfig()).spriteKey());
  }

  // Without this test, the image would not change when the crop grows.
  /** The sprite key follows the stage. */
  @Test
  void spriteKeyFollowsTheStage() {
    Crop crop = new Crop(CropType.CARROT, new CropConfig());

    crop.grow();

    assertEquals("carrot_1", crop.spriteKey());
  }

  // Crop implements Occupant, so a Cell accepts it without knowing its class.
  /** A crop can be placed on a cell. */
  @Test
  void cropCanBePlacedOnACell() {
    Cell cell = new Cell(1, 1);
    Crop crop = new Crop(CropType.CARROT, new CropConfig());

    assertTrue(cell.place(crop));
    assertEquals(Optional.of(crop), cell.getOccupant());
  }

  // The money a harvest brings is the value at the current stage: 5 for a new carrot, 40 once mature.
  /** A carrot harvested brings its value at its current stage. */
  @Test
  void harvestBringsTheValueOfTheStage() {
    Crop crop = new Crop(CropType.CARROT, new CropConfig());

    assertEquals(OptionalInt.of(5), crop.onHarvested());
    crop.grow();
    assertEquals(OptionalInt.of(40), crop.onHarvested());
  }

  // A crop stops only the enemy of its own type: the deviation asks the occupant, without instanceof.
  /** A carrot blocks CARROT only. */
  @Test
  void carrotBlocksOnlyCarrot() {
    Crop carrot = new Crop(CropType.CARROT, new CropConfig());

    assertTrue(carrot.blocks(CropType.CARROT));
    assertFalse(carrot.blocks(CropType.TURNIP));
    assertFalse(carrot.blocks(CropType.GARLIC));
    assertFalse(carrot.blocks(CropType.PUMPKIN));
  }
}
