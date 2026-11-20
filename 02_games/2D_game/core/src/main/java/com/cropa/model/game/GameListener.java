package com.cropa.model.game;

// Pattern Observer: GameSession keeps a list of GameListener and tells them what changed, without knowing who they are.
// The HUD and the end screen (EndScene) implement it; GameScreen subscribes them through addListener. A statistics
// screen would be one more class, the model unchanged.
// onGameOver is a default method: the HUD and the fake listeners compile without writing it.
// No event for the neighbour: the view reads GameSession.getNeighbour() at each frame, like the enemies, and draws her bubble
// while she talks.
/**
 * Something that wants to know when the game changes: the money, the farm's health,
 * the phase, the timer and the end of the game.
 */
public interface GameListener {

  // Called when the balance of the wallet changes: a sale, a purchase.
  /**
   * Tells that the player's money changed.
   *
   * @param balance the new balance, in coins
   */
  void onMoneyChanged(int balance);

  // Called when an enemy hits the farm.
  /**
   * Tells that the farm's health changed.
   *
   * @param health the farm's new health, never negative
   */
  void onFarmHealthChanged(int health);

  // Called when a day starts: at dawn, after a night.
  /**
   * Tells that a day started.
   *
   * @param day the number of the day, from 1
   */
  void onDayStarted(int day);

  // Called when a night starts: at the end of the day timer, or with "Launch the night".
  /**
   * Tells that a night started.
   *
   * @param night the number of the night, from 1
   */
  void onNightStarted(int night);

  // Called when the whole seconds left in the phase change, about once per second.
  /**
   * Tells that the timer of the current phase changed.
   *
   * @param secondsLeft the whole seconds left, rounded up
   */
  void onTimerChanged(int secondsLeft);

  // Called once, at the first frame where the game has a result: the urn bought, the farm destroyed or the urn sold.
  // default: an empty body, so a listener that does not care about the end of the game has nothing to write.
  /**
   * Tells that the game is over, and how it ended. Called only once per game.
   *
   * @param result how the game ended
   */
  default void onGameOver(GameResult result) {
  }
}
