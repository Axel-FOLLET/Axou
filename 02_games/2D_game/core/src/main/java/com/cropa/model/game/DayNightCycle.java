package com.cropa.model.game;

// Pattern State: the current phase is an object (DayState or NightState) kept in "current".
// What depends on the phase is asked to that object (canAct, enter, update), never tested with an if.
// The cycle keeps what the phases share: their order, the day or night number, and the timer.
/**
 * The day and night cycle: day 1, night 1, day 2, and so on, with a 60 s day and a 45 s night.
 */
public class DayNightCycle {

  // -------------------- FIELDS --------------------
  // The two phases, created once. "current" points to one of them: switching phase = changing it.
  private final PhaseState day = new DayState();
  private final PhaseState night = new NightState();
  // Read once from GameConfig: no number written here.
  private final float dayDuration;
  private final float nightDuration;
  private PhaseState current;
  // Seconds left in the current phase; it only goes down. number goes up at each new day.
  private float timeLeft;
  private int number;

  // -------------------- CONSTRUCTOR --------------------
  // Called once when a game starts. Day 1 is not a dawn: enter is not called, nothing grows.
  /**
   * Creates the cycle on day 1, with the full day ahead.
   *
   * @param config the durations of the day and the night
   */
  public DayNightCycle(GameConfig config) {
    dayDuration = config.getDayDuration();
    nightDuration = config.getNightDuration();
    current = day;
    timeLeft = dayDuration;
    number = 1;
  }

  // -------------------- ACTIONS --------------------
  // Called at each frame. The phase moves forward, then the timer; at 0, or when the phase says it is over
  // (a night with no enemy left), the next phase starts. Asked to the phase, not tested here: Pattern State.
  // Time beyond 0 is not carried over: a frame lasts about 0.016 s, the gap is invisible.
  /**
   * Moves the cycle forward, and starts the next phase when the timer reaches 0 or the phase is over.
   *
   * @param session the game the phases act on
   * @param delta   the time since the previous update, in seconds
   */
  public void update(GameSession session, float delta) {
    current.update(session, delta);
    timeLeft -= delta;
    if (timeLeft <= 0 || current.isOver(session)) {
      if (isNight()) {
        startDay(session);
      } else {
        startNight(session);
      }
    }
  }

  // Called by the "Launch the night" button. Early return at night: a second click changes nothing.
  /**
   * Ends the day before its timer and starts the night. Does nothing at night.
   *
   * @param session the game the night acts on
   */
  public void launchNight(GameSession session) {
    if (isNight()) {
      return;
    }
    startNight(session);
  }

  // Same number as the day before it: day 1 is followed by night 1.
  private void startNight(GameSession session) {
    current = night;
    timeLeft = nightDuration;
    current.enter(session);
  }

  // A new day: the number goes up, then DayState.enter makes the dawn (crops grow, enemies flee).
  private void startDay(GameSession session) {
    number++;
    current = day;
    timeLeft = dayDuration;
    current.enter(session);
  }

  // -------------------- QUERIES --------------------
  // Identity, not instanceof: the cycle created "night" itself, so it knows that very object.
  /**
   * Tells whether the current phase is the night.
   *
   * @return {@code true} at night
   */
  public boolean isNight() {
    return current == night;
  }

  /**
   * Returns the number of the current day or night, from 1.
   *
   * @return the number, the same for a day and the night after it
   */
  public int getNumber() {
    return number;
  }

  // Rounded up, like a countdown: 60 at the start, 1 until the very end of the phase.
  /**
   * Returns the whole seconds left in the current phase, rounded up.
   *
   * @return the seconds left, for the HUD
   */
  public int getSecondsLeft() {
    return (int) Math.ceil(timeLeft);
  }

  // The exact time left, with its fraction: GameSession caps the enemies' time with it.
  /**
   * Returns the time left in the current phase, not rounded.
   *
   * @return the time left, in seconds
   */
  public float getTimeLeft() {
    return timeLeft;
  }

  // Delegated to the current phase: allowed by day, forbidden at night.
  /**
   * Tells whether the player may buy, harvest and upgrade now.
   *
   * @return {@code true} by day, {@code false} at night
   */
  public boolean canAct() {
    return current.canAct();
  }
}