package com.cropa.model.world;

// The closed list of sellable crops, so an enum rather than free text.
// A bramble is not here: it is a defense, even if the player picks it in the "Plant" menu.
/**
 * The four crops the player can buy and plant.
 */
public enum CropType {
  // Cheapest crop, matures after one night.
  /** Carrot: 2 stages. */
  CARROT,

  // Blocks the witch (see the game rules).
  /** Turnip: 3 stages. */
  TURNIP,

  // Blocks the bat (see the game rules).
  /** Garlic: 3 stages. */
  GARLIC,

  // Most expensive crop and the one worth the most.
  /** Pumpkin: 4 stages. */
  PUMPKIN
}