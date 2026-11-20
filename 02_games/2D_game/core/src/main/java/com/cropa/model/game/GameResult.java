package com.cropa.model.game;

// How a game ends: one value per way out of the rules (section 2).
// An enum, not a boolean: there are two defeats, and the end screen must tell them apart.
// A closed set: no other value can exist, so a switch on it covers every ending.
/**
 * The way a game ends: the urn bought, the farm destroyed, or the urn sold after the
 * last night.
 */
public enum GameResult {

  // The player bought the urn for 10 000 coins, during a day or at the last dawn.
  /** The player bought the urn: the game is won. */
  VICTORY,

  // The enemies brought the farm down to 0 HP.
  /** The farm has no health left: the game is lost. */
  DEFEAT_FARM_DESTROYED,

  // The dawn after night 8 came without the 10 000 coins: the rich man sold the urn.
  /** The urn was not bought before the last dawn and was sold: the game is lost. */
  DEFEAT_URN_SOLD
}