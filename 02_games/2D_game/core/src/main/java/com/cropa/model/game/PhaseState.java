package com.cropa.model.game;

// Pattern State: DayNightCycle keeps the current phase in a PhaseState field and delegates to it,
// so no code tests "is it night?". Switching phase means putting another object in that field.
// DayState and NightState implement it; a new phase would be one new class, no new if.
/**
 * One phase of the day and night cycle: what happens when it starts, at each frame,
 * and whether the player may act.
 */
public interface PhaseState {

  // Called once by DayNightCycle when this phase starts (dawn for DayState, dusk for NightState).
  /**
   * Starts this phase.
   *
   * @param session the game, to act on its board and its enemies
   */
  void enter(GameSession session);

  // Called by DayNightCycle at each frame while this phase lasts.
  /**
   * Moves this phase forward.
   *
   * @param session the game
   * @param delta   the time since the previous update, in seconds
   */
  void update(GameSession session, float delta);

  // Read before buying, harvesting or upgrading: allowed by day, forbidden at night.
  /**
   * Tells whether the player may act during this phase.
   *
   * @return {@code true} if buying, harvesting and upgrading are allowed
   */
  boolean canAct();

  // Asked by DayNightCycle at each frame, after update: true ends the phase before its timer (asked by Axel on day 9:
  // a night with no enemy left has nothing more to show).
  // default: written once here, so the day, which only ends with its timer or "Lancer la nuit", has nothing to write.
  /**
   * Tells whether this phase is over before the end of its timer.
   *
   * @param session the game
   * @return {@code true} to end the phase now; {@code false} by default
   */
  default boolean isOver(GameSession session) {
    return false;
  }
}