package com.cropa.model.game;

// JUnit: assertion helpers and the @Test marker. List: the neighbour's texts. Random: the seed of her day.
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.Test;

/**
 * Tests for {@link Neighbour}.
 */
class NeighbourTest {

  // -------------------- HELPERS --------------------
  // The texts of the tests are given here, not read in GameConfig: a change of her real texts breaks no test.
  // 10 letters per second: after 0.3 s, 3 letters are written. "Bon matin" has a space at index 3: after 0.3 s,
  // "Bon" is a whole word (word by word, day 12).
  private static final List<String> FACTS = List.of("Bon matin", "Au revoir");
  private static final float LETTERS_PER_SECOND = 10f;
  private static final int NIGHT_COUNT = 8;
  // Her walks (the neighbour's constants): 8 s in the forest, 6 s to Garry, 6 s to leave.
  private static final float WANDER = 8f;
  private static final float ARRIVE = 6f;
  private static final float LEAVE = 6f;

  // A the neighbour whose day is drawn with the given seed: the same seed always gives the same day.
  private static Neighbour neighbour(long seed) {
    return new Neighbour(FACTS, LETTERS_PER_SECOND, NIGHT_COUNT, new Random(seed));
  }

  // A the neighbour whose day has come: she walks in the forest.
  private static Neighbour neighbourWandering() {
    Neighbour neighbour = neighbour(0);
    neighbour.startIfToday(neighbour.getDay());
    return neighbour;
  }

  // A the neighbour in front of Garry: her walks are over, her first bubble starts with no letter.
  private static Neighbour neighbourTalking() {
    Neighbour neighbour = neighbourWandering();
    neighbour.update(WANDER);
    neighbour.update(ARRIVE);
    return neighbour;
  }

  // -------------------- HER DAY --------------------
  // A random event is tested on many seeds: each one gives a day, and every day must be in the range of the rules
  // (never the first day, and at most the last day before the urn is settled).
  /** For 100 seeds, her day is between 2 and 8. */
  @Test
  void dayIsBetweenTwoAndEight() {
    for (long seed = 0; seed < 100; seed++) {
      int day = neighbour(seed).getDay();

      assertTrue(day >= 2 && day <= 8, "seed " + seed + " gave day " + day);
    }
  }

  // -------------------- HER VISIT --------------------
  // The day before and the day after hers: her day is at least 2, so the day before is never below 1.
  /** On another day than hers, she does not come. */
  @Test
  void doesNotComeOnAnotherDay() {
    Neighbour neighbour = neighbour(0);

    neighbour.startIfToday(neighbour.getDay() - 1);
    assertEquals(Neighbour.Phase.ABSENT, neighbour.getPhase());

    neighbour.startIfToday(neighbour.getDay() + 1);
    assertFalse(neighbour.isVisiting());
  }

  // Her day: she first walks in the forest, she does not talk yet.
  /** On her day, she comes and walks in the forest. */
  @Test
  void comesOnHerDayInTheForest() {
    Neighbour neighbour = neighbourWandering();

    assertEquals(Neighbour.Phase.WANDERING, neighbour.getPhase());
    assertTrue(neighbour.isVisiting());
    assertFalse(neighbour.isTalking());
  }

  // 8 s in the forest, then 6 s to Garry: the phases follow each other, and the progress of a walk goes from 0 to 1.
  /** She walks 8 s in the forest, then 6 s to Garry, then talks. */
  @Test
  void walksThenTalks() {
    Neighbour neighbour = neighbourWandering();

    neighbour.update(WANDER / 2);
    assertEquals(0.5f, neighbour.getWalkProgress(), 0.001f);

    neighbour.update(WANDER / 2);
    assertEquals(Neighbour.Phase.ARRIVING, neighbour.getPhase());
    assertEquals(0f, neighbour.getWalkProgress(), 0.001f);

    neighbour.update(ARRIVE);
    assertTrue(neighbour.isTalking());
  }

  // -------------------- THE TEXT --------------------
  // 0.3 s at 10 letters per second: 3 letters of "Bon matin", and the 4th one is the space: "Bon" is whole.
  /** After 0.3 s at 10 letters per second, the bubble shows "Bon". */
  @Test
  void textIsWrittenAtTenLettersPerSecond() {
    Neighbour neighbour = neighbourTalking();

    neighbour.update(0.3f);

    assertEquals("Bon", neighbour.getCurrentBubble());
  }

  // Her walks write nothing: the bubble only starts once she stands in front of Garry.
  /** While she walks, the bubble is empty. */
  @Test
  void walkingWritesNothing() {
    Neighbour neighbour = neighbourWandering();

    neighbour.update(1f);

    assertEquals("", neighbour.getCurrentBubble());
  }

  // -------------------- WORD BY WORD --------------------
  // 0.5 s: 5 letters, "Bon m". The "m" of "matin" is written, but "matin" is not whole: only "Bon" shows.
  /** A word half written is not shown: after 5 letters of "Bon matin", the bubble shows "Bon". */
  @Test
  void halfWrittenWordIsNotShown() {
    Neighbour neighbour = neighbourTalking();

    neighbour.update(0.5f);

    assertEquals("Bon", neighbour.getCurrentBubble());
  }

  // 0.2 s: 2 letters, "Bo". No space yet, so no whole word: the bubble stays empty until "Bon" is whole.
  /** Before the first word is whole, the bubble is empty. */
  @Test
  void noWordShownBeforeTheFirstIsWhole() {
    Neighbour neighbour = neighbourTalking();

    neighbour.update(0.2f);

    assertEquals("", neighbour.getCurrentBubble());
  }

  // The last word has no space after it: it shows once the very last letter is written (9 letters, 0.9 s).
  // 0.8 s: 8 letters, "matin" still lacks its "n".
  /** The last word of a bubble appears with its last letter. */
  @Test
  void lastWordAppearsWithItsLastLetter() {
    Neighbour neighbour = neighbourTalking();

    neighbour.update(0.8f);
    assertEquals("Bon", neighbour.getCurrentBubble());
    assertFalse(neighbour.isBubbleWritten());

    neighbour.update(0.1f);
    assertEquals("Bon matin", neighbour.getCurrentBubble());
    assertTrue(neighbour.isBubbleWritten());
  }

  // A very long frame (the window was dragged, a debugger stopped the game): the letters stop at the end of the
  // bubble, so substring never goes past the text.
  /** A 100 s update stops at the end of the bubble, without an exception. */
  @Test
  void longUpdateStopsAtTheEndOfTheBubble() {
    Neighbour neighbour = neighbourTalking();

    assertDoesNotThrow(() -> neighbour.update(100f));
    assertEquals("Bon matin", neighbour.getCurrentBubble());
  }

  // -------------------- "PASSER À LA SUITE" --------------------
  // While the bubble is being written, the button does nothing: no faster writing, no next bubble (Axel, day 12).
  /** nextBubble while the bubble is being written changes nothing. */
  @Test
  void nextBubbleWaitsForTheWholeBubble() {
    Neighbour neighbour = neighbourTalking();
    neighbour.update(0.3f);

    neighbour.nextBubble();

    assertEquals("Bon", neighbour.getCurrentBubble());
    assertTrue(neighbour.isTalking());
  }

  // Once the bubble is written, the next one starts empty; after the last one, she leaves by the road.
  /** A written bubble makes way for the next one; after the last one, she leaves, then is gone after 6 s. */
  @Test
  void nextBubbleGoesOnThenSheLeaves() {
    Neighbour neighbour = neighbourTalking();
    neighbour.update(1f);

    neighbour.nextBubble();
    assertEquals("", neighbour.getCurrentBubble());
    assertTrue(neighbour.isTalking());

    neighbour.update(1f);
    neighbour.nextBubble();
    assertEquals(Neighbour.Phase.LEAVING, neighbour.getPhase());
    assertTrue(neighbour.isVisiting());

    neighbour.update(LEAVE);
    assertEquals(Neighbour.Phase.GONE, neighbour.getPhase());
    assertFalse(neighbour.isVisiting());
  }

  // Once per game: after she left, her day called again does not bring her back.
  /** After she left, her day called again does not start her again. */
  @Test
  void comesOnlyOnce() {
    Neighbour neighbour = neighbourTalking();
    neighbour.leave();

    neighbour.startIfToday(neighbour.getDay());

    assertEquals(Neighbour.Phase.GONE, neighbour.getPhase());
  }

  // A second call on her day while she talks keeps her bubble: it does not start again from the first letter.
  /** A second call on her day while she talks does not start her bubble again. */
  @Test
  void secondCallOnHerDayKeepsTheBubble() {
    Neighbour neighbour = neighbourTalking();
    neighbour.update(0.3f);

    neighbour.startIfToday(neighbour.getDay());

    assertEquals("Bon", neighbour.getCurrentBubble());
  }

  // -------------------- LEAVING --------------------
  // The night falls while she talks: she leaves at once, even in the middle of a bubble. The same in the forest.
  /** leave() in the middle of a bubble, or during her walk, sends her away at once. */
  @Test
  void leaveSendsHerAwayAtOnce() {
    Neighbour talking = neighbourTalking();
    talking.update(0.3f);
    talking.leave();
    assertFalse(talking.isTalking());
    assertFalse(talking.isVisiting());

    Neighbour wandering = neighbourWandering();
    wandering.leave();
    assertEquals(Neighbour.Phase.GONE, wandering.getPhase());
  }

  // NightState calls leave at every night, from night 1: the nights before her day must not cancel her visit.
  /** leave() before her day does not stop her from coming on her day. */
  @Test
  void leaveBeforeHerDayDoesNotCancelHerVisit() {
    Neighbour neighbour = neighbour(0);

    neighbour.leave();
    neighbour.startIfToday(neighbour.getDay());

    assertTrue(neighbour.isVisiting());
  }

  // -------------------- WHEN SHE IS SILENT --------------------
  // The view may read the bubble at any frame: when she does not talk, there is nothing to show.
  /** Before her day and after she left, the bubble is empty. */
  @Test
  void notTalkingGivesAnEmptyBubble() {
    Neighbour neighbour = neighbour(0);
    assertEquals("", neighbour.getCurrentBubble());

    Neighbour gone = neighbourTalking();
    gone.leave();

    assertEquals("", gone.getCurrentBubble());
  }

  // With no text at all (her list left empty by mistake), she does not come: no walk, no bubble, and a frame or a
  // click never reads a text that does not exist.
  /** With no fun fact, she does not come, and update, nextBubble and getCurrentBubble do nothing. */
  @Test
  void noFactsMeansNoVisit() {
    Neighbour neighbour = new Neighbour(List.of(), LETTERS_PER_SECOND, NIGHT_COUNT, new Random(0));

    neighbour.startIfToday(neighbour.getDay());

    assertFalse(neighbour.isVisiting());
    assertDoesNotThrow(() -> {
      neighbour.update(1f);
      neighbour.nextBubble();
    });
    assertEquals("", neighbour.getCurrentBubble());
    assertFalse(neighbour.isBubbleWritten());
  }
}
