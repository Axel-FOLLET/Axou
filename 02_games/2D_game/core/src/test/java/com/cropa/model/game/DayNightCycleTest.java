package com.cropa.model.game;

// JUnit: assertion helpers and the @Test marker. Random: GameSession takes one.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

// A carrot the test plants, to see it grow at dawn.
import com.cropa.model.world.Crop;
import com.cropa.model.world.CropConfig;
import com.cropa.model.world.CropType;
import java.util.Random;
import org.junit.jupiter.api.Test;

/**
 * Tests for {@link DayNightCycle}: day 1, night 1, day 2, with a 60 s day and a 45 s night.
 * Time is injected: update(session, 60f) instead of waiting a minute.
 */
class DayNightCycleTest {

  // -------------------- FIELDS --------------------
  // A fresh session and cycle for each test, with the real numbers of the rules.
  private final GameSession session = new GameSession(new GameConfig(), new Random(0));
  private final DayNightCycle cycle = new DayNightCycle(new GameConfig());

  // -------------------- START --------------------
  // The game starts on day 1, with the full 60 s, and the player may act.
  /** The cycle starts on day 1. */
  @Test
  void startsOnDayOne() {
    assertFalse(cycle.isNight());
    assertEquals(1, cycle.getNumber());
    assertEquals(60, cycle.getSecondsLeft());
    assertTrue(cycle.canAct());
  }

  // -------------------- DAY --------------------
  // Without this test, the day could end one second too early.
  /** After 59 s, it is still day 1. */
  @Test
  void dayIsNotOverAfter59Seconds() {
    cycle.update(session, 59f);

    assertFalse(cycle.isNight());
    assertEquals(1, cycle.getSecondsLeft());
  }

  // At 0, night 1 starts with its own 45 s timer, and the player may no longer act.
  /** After 60 s, night 1 starts. */
  @Test
  void dayEndsAfter60Seconds() {
    cycle.update(session, 60f);

    assertTrue(cycle.isNight());
    assertEquals(1, cycle.getNumber());
    assertEquals(45, cycle.getSecondsLeft());
    assertFalse(cycle.canAct());
  }

  // The "Launch the night" button ends the day before its timer.
  /** launchNight starts night 1 right away. */
  @Test
  void launchNightEndsTheDayEarly() {
    cycle.update(session, 10f);

    cycle.launchNight(session);

    assertTrue(cycle.isNight());
    assertEquals(1, cycle.getNumber());
    assertEquals(45, cycle.getSecondsLeft());
  }

  // Without this test, a second click would give the night its 45 s again.
  /** launchNight does nothing at night. */
  @Test
  void launchNightDoesNothingAtNight() {
    cycle.launchNight(session);
    cycle.update(session, 10f);

    cycle.launchNight(session);

    assertTrue(cycle.isNight());
    assertEquals(35, cycle.getSecondsLeft());
  }

  // -------------------- NIGHT --------------------
  // After the 45 s of night 1 comes day 2, with a full 60 s.
  /** After 45 s of night, day 2 starts. */
  @Test
  void nightEndsOnTheNextDay() {
    cycle.update(session, 60f);
    cycle.update(session, 45f);

    assertFalse(cycle.isNight());
    assertEquals(2, cycle.getNumber());
    assertEquals(60, cycle.getSecondsLeft());
  }

  // The new day starts with the dawn (DayState.enter): a carrot planted by the test grows from stage 0 to 1.
  /** The dawn at the end of the night makes the crops grow. */
  @Test
  void dawnMakesTheCropsGrow() {
    Crop carrot = new Crop(CropType.CARROT, new CropConfig());
    session.getBoard().getCell(1, 1).place(carrot);

    cycle.update(session, 60f);
    cycle.update(session, 45f);

    assertEquals(1, carrot.getStage());
  }

  // getSecondsLeft is an int for the HUD: a countdown shows 60 until a full second has passed.
  /** The seconds left are rounded up. */
  @Test
  void secondsLeftRoundsUp() {
    cycle.update(session, 0.5f);

    assertEquals(60, cycle.getSecondsLeft());
  }

  // getTimeLeft keeps the fraction: GameSession needs the exact time for Math.min, not a rounded one.
  /** The time left is not rounded, unlike getSecondsLeft. */
  @Test
  void timeLeftIsNotRounded() {
    assertEquals(60f, cycle.getTimeLeft());
    cycle.update(session, 0.5f);
    assertEquals(59.5f, cycle.getTimeLeft());
  }
}