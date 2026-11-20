package com.cropa.model.world;

// What an enemy may do to the defenses of its line: wear the one at a given place, nothing more.
// In world, not in defense: LaneEnemy (enemy) calls it and DefenseSlots (defense) implements it,
// so the enemy package never imports the defense package.
// One method only: a test, or an enemy that wears nothing, writes a DefenseLine as a lambda, (row, column, percent) -> ...
/**
 * The defenses along the rows of slots, as an enemy sees them: something it can wear.
 */
public interface DefenseLine {

  // Called by LaneEnemy while it flees along row 0 or row 4, for each column it enters.
  /**
   * Wears the defense at the given place, if there is one. Rows 1 to 3 hold no slot: nothing happens there.
   *
   * @param row     the row, 0 for the slots above the field, 4 for the slots under it
   * @param column  the column, from 1 to 5
   * @param percent the durability to remove, in percent
   */
  void wearAt(int row, int column, int percent);
}
