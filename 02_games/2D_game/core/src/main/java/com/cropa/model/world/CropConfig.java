package com.cropa.model.world;

// EnumMap: a Map made for enum keys (here CropType), fast and ordered by declaration.
import java.util.EnumMap;
import java.util.Map;

// All the balancing numbers of the crops live here (section 10 of the rules), not in Crop.
// It is a normal object passed as a parameter (no static), so a test or a playtest can
// use other numbers without touching the logic.
/**
 * The balancing numbers of the crops: seed price and value of each stage.
 * Stages are numbered from 0: a crop is born at stage 0 and is mature at its last stage.
 */
public class CropConfig {

  // -------------------- FIELDS --------------------
  // One entry per CropType. The number of stages is the length of the values array,
  // so it can never disagree with the values.
  private final Map<CropType, Integer> seedPrices = new EnumMap<>(CropType.class);
  private final Map<CropType, int[]> stageValues = new EnumMap<>(CropType.class);

  // -------------------- CONSTRUCTOR --------------------
  // Called once when a game starts. The numbers are those of section 10 of the rules.
  /**
   * Creates the configuration with the numbers of the rules.
   */
  public CropConfig() {
    seedPrices.put(CropType.CARROT, 10);
    stageValues.put(CropType.CARROT, new int[] {5, 40});

    seedPrices.put(CropType.TURNIP, 20);
    stageValues.put(CropType.TURNIP, new int[] {0, 25, 90});

    seedPrices.put(CropType.GARLIC, 20);
    stageValues.put(CropType.GARLIC, new int[] {0, 25, 90});

    seedPrices.put(CropType.PUMPKIN, 50);
    // 1000 since day 10 (800 on day 9, 700 before): the pumpkin, 3 nights exposed to the witches and the moles,
    // is the crop that pays for the urn; simulated over whole games (rules.md §10).
    stageValues.put(CropType.PUMPKIN, new int[] {0, 70, 210, 1000});
  }

  // -------------------- ACCESSORS --------------------
  // Called by the shop to charge the player when a seed is bought.
  /**
   * Returns the price of the seed of a crop.
   *
   * @param type the crop
   * @return the seed price
   */
  public int getSeedPrice(CropType type) {
    return seedPrices.get(type);
  }

  // Called by Crop to know when it is mature: the last stage is stageCount - 1.
  /**
   * Returns the number of stages of a crop.
   *
   * @param type the crop
   * @return the number of stages
   */
  public int getStageCount(CropType type) {
    return stageValues.get(type).length;
  }

  // Called by Crop.getValue with its current stage.
  // A stage outside the crop's stages is a programming error: it fails right away with a
  // clear message instead of an ArrayIndexOutOfBoundsException.
  /**
   * Returns the value of a crop at a given stage.
   *
   * @param type the crop
   * @param stage the stage, from 0 to {@code getStageCount(type) - 1}
   * @return the value of the crop at this stage
   * @throws IllegalArgumentException if the stage is below 0 or beyond the last stage
   */
  public int getValue(CropType type, int stage) {
    int[] values = stageValues.get(type);
    if (stage < 0 || stage >= values.length) {
      throw new IllegalArgumentException(
          "Stage " + stage + " outside the stages of " + type + " (0.." + (values.length - 1) + ")");
    }
    return values[stage];
  }
}
