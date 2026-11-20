package com.cropa.model.world;

// Whatever moves forward with time: the enemies (Yohan, on Enemy), then the defenses.
// GameSession.update calls update on each enemy, then on each defense, in two loops.
/**
 * Something that moves forward with the time of the game.
 */
public interface Updatable {

  // Called by the game at each frame, with the time since the previous one.
  /**
   * Moves forward by the given time.
   *
   * @param delta the time since the previous update, in seconds
   */
  void update(float delta);
}