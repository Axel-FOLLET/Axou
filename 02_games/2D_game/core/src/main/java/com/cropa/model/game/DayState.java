package com.cropa.model.game;

// No import: the dawn is made by GameSession (dawn), in the same package. DayState only knows the session (L7).

// The day: it starts with the dawn, and the player may act until the timer ends or "Launch the night".
/**
 * The day phase: every crop grows one stage, every defense reacts to the dawn and every enemy
 * flees when it starts, and the player may buy, harvest and upgrade.
 */
public class DayState implements PhaseState {

  // -------------------- CONSTRUCTOR --------------------
  /**
   * Creates the day phase. It keeps nothing between two days: the same one is used every day.
   */
  public DayState() {
  }

  // -------------------- PHASE STATE --------------------
  // The dawn: the session makes it (GameSession.dawn: crops, then defenses, then enemies), then the neighbour may come.
  // dawn is package-private: DayState is in the same package as GameSession.
  /**
   * Starts the day: through the session, every crop grows one stage, every defense reacts to
   * the dawn and every enemy still on the field flees; then the neighbour comes if it is her day.
   *
   * @param session the game whose crops grow, whose defenses wake and whose enemies flee
   */
  @Override
  public void enter(GameSession session) {
    session.dawn();
    // The neighbour comes if this new day is hers (only once per game): getNumber is already the number of the new day.
    session.getNeighbour().startIfToday(session.getCycle().getNumber());
  }

  // The timer lives in DayNightCycle; by day, only the neighbour's bubble moves (nothing is written when she is silent).
  /**
   * Writes the next letters of the neighbour's bubble, if she is talking.
   *
   * @param session the game
   * @param delta   the time since the previous update, in seconds
   */
  @Override
  public void update(GameSession session, float delta) {
    session.getNeighbour().update(delta);
  }

  // The rules: buying, harvesting and upgrading are allowed by day.
  /**
   * Tells whether the player may act.
   *
   * @return always {@code true} by day
   */
  @Override
  public boolean canAct() {
    return true;
  }
}