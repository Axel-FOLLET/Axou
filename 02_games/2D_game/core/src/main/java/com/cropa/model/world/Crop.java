package com.cropa.model.world;

// Locale.ROOT: the same lower case on every computer, whatever its language.
// OptionalInt: what onHarvested returns.
import java.util.Locale;
import java.util.OptionalInt;

// implements Occupant: this is what lets a Cell accept a Crop without knowing its class.
/**
 * A crop planted on a cell. It is born at stage 0 and grows one stage per night
 * until it is mature. Its numbers (stages, values) all come from
 * {@link CropConfig}.
 */
public class Crop implements Occupant {

  // -------------------- FIELDS --------------------
  // type and config never change, so they are final.
  // stage starts at 0 and only grows.
  private final CropType type;
  private final CropConfig config;
  private int stage;

  // -------------------- CONSTRUCTOR --------------------
  // Called when the player plants a seed.
  // The config is passed in (not static), so the numbers can change without touching this class.
  /**
   * Creates a crop at its first stage.
   *
   * @param type   the kind of crop
   * @param config the balancing numbers to read the stages and values from
   */
  public Crop(CropType type, CropConfig config) {
    this.type = type;
    this.config = config;
  }

  // -------------------- ACCESSORS --------------------
  // Used to know which crop it is, for example to draw it or to apply its effect.
  /**
   * Returns the kind of this crop.
   *
   * @return the crop type
   */
  public CropType getType() {
    return type;
  }

  // Stages are numbered from 0 to getStageCount - 1.
  /**
   * Returns the current stage of this crop.
   *
   * @return the stage, starting at 0
   */
  public int getStage() {
    return stage;
  }

  // The last stage is stageCount - 1: a carrot (2 stages) is mature at stage 1.
  /**
   * Tells whether this crop has reached its last stage.
   *
   * @return {@code true} if the crop is mature
   */
  public boolean isMature() {
    return stage == config.getStageCount(type) - 1;
  }

  // The value is read from CropConfig at the current stage: nothing is written here.
  /**
   * Returns the value of this crop at its current stage.
   *
   * @return the value, sold at harvest
   */
  public int getValue() {
    return config.getValue(type, stage);
  }

  // -------------------- ACTIONS --------------------
  // Called on every crop of the field at each dawn (Board.getCrops).
  // Early return once mature: without it the stage would go past the last one and getValue would throw.
  /**
   * Makes this crop grow one stage. Does nothing once the crop is mature.
   */
  public void grow() {
    if (isMature()) {
      return;
    }
    stage++;
  }

  // -------------------- OCCUPANT --------------------
  // A witch walks over a crop and crushes it: the crop leaves its cell.
  /**
   * Reacts to an enemy crossing the cell.
   *
   * @param crosser what crosses the cell, not hurt by a crop
   * @return always {@code true}: a crop is crushed and leaves
   */
  @Override
  public boolean onCrossedBy(Damageable crosser) {
    return true;
  }

  // Moles eat crops.
  /**
   * Reacts to a mole biting it.
   *
   * @return always {@code true}: a crop is eaten
   */
  @Override
  public boolean onBittenByMole() {
    return true;
  }

  // The type in lower case, "_", then the stage: CARROT at stage 1 gives "carrot_1".
  /**
   * Returns the name of the sprite of this crop at its current stage.
   *
   * @return the sprite key, for example {@code "carrot_0"}
   */
  @Override
  public String spriteKey() {
    return type.name().toLowerCase(Locale.ROOT) + "_" + stage;
  }

  // A crop is sold at its current value: 5 for a new carrot, 40 once mature.
  /**
   * Returns the money a harvest of this crop brings now.
   *
   * @return the value at the current stage, never empty for a crop
   */
  @Override
  public OptionalInt onHarvested() {
    return OptionalInt.of(getValue());
  }

  // A crop stops the enemy that avoids its own type, and no other.
  /**
   * Tells whether this crop stops an enemy that avoids the given crop.
   *
   * @param blocker the crop type the enemy avoids
   * @return {@code true} if this crop is of that type
   */
  @Override
  public boolean blocks(CropType blocker) {
    return type == blocker;
  }
}
