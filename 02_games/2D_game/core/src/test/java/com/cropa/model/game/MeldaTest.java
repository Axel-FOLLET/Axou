package com.cropa.model.game;

// JUnit: assertion helpers and the @Test marker. List: Melda's texts. Random: the seed of her day.
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.Test;

/**
 * Tests for {@link Melda}.
 */
class MeldaTest {

  // -------------------- HELPERS --------------------
  // The texts of the tests are given here, not read in GameConfig: a change of her real texts breaks no test.
  // 10 letters per second: after 0.3 s, 3 letters are written. "Bon matin" has a space at index 3: after 0.3 s,
  // "Bon" is a whole word (word by word, day 12).
  private static final List<String> FACTS = List.of("Bon matin", "Au revoir");
  private static final float LETTERS_PER_SECOND = 10f;
  private static final int NIGHT_COUNT = 8;
  // Her walks (Melda's constants): 8 s in the forest, 6 s to Garry, 6 s to leave.
  private static final float WANDER = 8f;
  private static final float ARRIVE = 6f;
  private static final float LEAVE = 6f;

  // A Melda whose day is drawn with the given seed: the same seed always gives the same day.
  private static Melda melda(long seed) {
    return new Melda(FACTS, LETTERS_PER_SECOND, NIGHT_COUNT, new Random(seed));
  }

  // A Melda whose day has come: she walks in the forest.
  private static Melda meldaWandering() {
    Melda melda = melda(0);
    melda.startIfToday(melda.getDay());
    return melda;
  }

  // A Melda in front of Garry: her walks are over, her first bubble starts with no letter.
  private static Melda meldaTalking() {
    Melda melda = meldaWandering();
    melda.update(WANDER);
    melda.update(ARRIVE);
    return melda;
  }

  // -------------------- HER DAY --------------------
  // A random event is tested on many seeds: each one gives a day, and every day must be in the range of the rules
  // (never the first day, and at most the last day before the urn is settled).
  /** For 100 seeds, her day is between 2 and 8. */
  @Test
  void dayIsBetweenTwoAndEight() {
    for (long seed = 0; seed < 100; seed++) {
      int day = melda(seed).getDay();

      assertTrue(day >= 2 && day <= 8, "seed " + seed + " gave day " + day);
    }
  }

  // -------------------- HER VISIT --------------------
  // The day before and the day after hers: her day is at least 2, so the day before is never below 1.
  /** On another day than hers, she does not come. */
  @Test
  void doesNotComeOnAnotherDay() {
    Melda melda = melda(0);

    melda.startIfToday(melda.getDay() - 1);
    assertEquals(Melda.Phase.ABSENT, melda.getPhase());

    melda.startIfToday(melda.getDay() + 1);
    assertFalse(melda.isVisiting());
  }

  // Her day: she first walks in the forest, she does not talk yet.
  /** On her day, she comes and walks in the forest. */
  @Test
  void comesOnHerDayInTheForest() {
    Melda melda = meldaWandering();

    assertEquals(Melda.Phase.WANDERING, melda.getPhase());
    assertTrue(melda.isVisiting());
    assertFalse(melda.isTalking());
  }

  // 8 s in the forest, then 6 s to Garry: the phases follow each other, and the progress of a walk goes from 0 to 1.
  /** She walks 8 s in the forest, then 6 s to Garry, then talks. */
  @Test
  void walksThenTalks() {
    Melda melda = meldaWandering();

    melda.update(WANDER / 2);
    assertEquals(0.5f, melda.getWalkProgress(), 0.001f);

    melda.update(WANDER / 2);
    assertEquals(Melda.Phase.ARRIVING, melda.getPhase());
    assertEquals(0f, melda.getWalkProgress(), 0.001f);

    melda.update(ARRIVE);
    assertTrue(melda.isTalking());
  }

  // -------------------- THE TEXT --------------------
  // 0.3 s at 10 letters per second: 3 letters of "Bon matin", and the 4th one is the space: "Bon" is whole.
  /** After 0.3 s at 10 letters per second, the bubble shows "Bon". */
  @Test
  void textIsWrittenAtTenLettersPerSecond() {
    Melda melda = meldaTalking();

    melda.update(0.3f);

    assertEquals("Bon", melda.getCurrentBubble());
  }

  // Her walks write nothing: the bubble only starts once she stands in front of Garry.
  /** While she walks, the bubble is empty. */
  @Test
  void walkingWritesNothing() {
    Melda melda = meldaWandering();

    melda.update(1f);

    assertEquals("", melda.getCurrentBubble());
  }

  // -------------------- WORD BY WORD --------------------
  // 0.5 s: 5 letters, "Bon m". The "m" of "matin" is written, but "matin" is not whole: only "Bon" shows.
  /** A word half written is not shown: after 5 letters of "Bon matin", the bubble shows "Bon". */
  @Test
  void halfWrittenWordIsNotShown() {
    Melda melda = meldaTalking();

    melda.update(0.5f);

    assertEquals("Bon", melda.getCurrentBubble());
  }

  // 0.2 s: 2 letters, "Bo". No space yet, so no whole word: the bubble stays empty until "Bon" is whole.
  /** Before the first word is whole, the bubble is empty. */
  @Test
  void noWordShownBeforeTheFirstIsWhole() {
    Melda melda = meldaTalking();

    melda.update(0.2f);

    assertEquals("", melda.getCurrentBubble());
  }

  // The last word has no space after it: it shows once the very last letter is written (9 letters, 0.9 s).
  // 0.8 s: 8 letters, "matin" still lacks its "n".
  /** The last word of a bubble appears with its last letter. */
  @Test
  void lastWordAppearsWithItsLastLetter() {
    Melda melda = meldaTalking();

    melda.update(0.8f);
    assertEquals("Bon", melda.getCurrentBubble());
    assertFalse(melda.isBubbleWritten());

    melda.update(0.1f);
    assertEquals("Bon matin", melda.getCurrentBubble());
    assertTrue(melda.isBubbleWritten());
  }

  // A very long frame (the window was dragged, a debugger stopped the game): the letters stop at the end of the
  // bubble, so substring never goes past the text.
  /** A 100 s update stops at the end of the bubble, without an exception. */
  @Test
  void longUpdateStopsAtTheEndOfTheBubble() {
    Melda melda = meldaTalking();

    assertDoesNotThrow(() -> melda.update(100f));
    assertEquals("Bon matin", melda.getCurrentBubble());
  }

  // -------------------- "PASSER À LA SUITE" --------------------
  // While the bubble is being written, the button does nothing: no faster writing, no next bubble (Axel, day 12).
  /** nextBubble while the bubble is being written changes nothing. */
  @Test
  void nextBubbleWaitsForTheWholeBubble() {
    Melda melda = meldaTalking();
    melda.update(0.3f);

    melda.nextBubble();

    assertEquals("Bon", melda.getCurrentBubble());
    assertTrue(melda.isTalking());
  }

  // Once the bubble is written, the next one starts empty; after the last one, she leaves by the road.
  /** A written bubble makes way for the next one; after the last one, she leaves, then is gone after 6 s. */
  @Test
  void nextBubbleGoesOnThenSheLeaves() {
    Melda melda = meldaTalking();
    melda.update(1f);

    melda.nextBubble();
    assertEquals("", melda.getCurrentBubble());
    assertTrue(melda.isTalking());

    melda.update(1f);
    melda.nextBubble();
    assertEquals(Melda.Phase.LEAVING, melda.getPhase());
    assertTrue(melda.isVisiting());

    melda.update(LEAVE);
    assertEquals(Melda.Phase.GONE, melda.getPhase());
    assertFalse(melda.isVisiting());
  }

  // Once per game: after she left, her day called again does not bring her back.
  /** After she left, her day called again does not start her again. */
  @Test
  void comesOnlyOnce() {
    Melda melda = meldaTalking();
    melda.leave();

    melda.startIfToday(melda.getDay());

    assertEquals(Melda.Phase.GONE, melda.getPhase());
  }

  // A second call on her day while she talks keeps her bubble: it does not start again from the first letter.
  /** A second call on her day while she talks does not start her bubble again. */
  @Test
  void secondCallOnHerDayKeepsTheBubble() {
    Melda melda = meldaTalking();
    melda.update(0.3f);

    melda.startIfToday(melda.getDay());

    assertEquals("Bon", melda.getCurrentBubble());
  }

  // -------------------- LEAVING --------------------
  // The night falls while she talks: she leaves at once, even in the middle of a bubble. The same in the forest.
  /** leave() in the middle of a bubble, or during her walk, sends her away at once. */
  @Test
  void leaveSendsHerAwayAtOnce() {
    Melda talking = meldaTalking();
    talking.update(0.3f);
    talking.leave();
    assertFalse(talking.isTalking());
    assertFalse(talking.isVisiting());

    Melda wandering = meldaWandering();
    wandering.leave();
    assertEquals(Melda.Phase.GONE, wandering.getPhase());
  }

  // NightState calls leave at every night, from night 1: the nights before her day must not cancel her visit.
  /** leave() before her day does not stop her from coming on her day. */
  @Test
  void leaveBeforeHerDayDoesNotCancelHerVisit() {
    Melda melda = melda(0);

    melda.leave();
    melda.startIfToday(melda.getDay());

    assertTrue(melda.isVisiting());
  }

  // -------------------- WHEN SHE IS SILENT --------------------
  // The view may read the bubble at any frame: when she does not talk, there is nothing to show.
  /** Before her day and after she left, the bubble is empty. */
  @Test
  void notTalkingGivesAnEmptyBubble() {
    Melda melda = melda(0);
    assertEquals("", melda.getCurrentBubble());

    Melda gone = meldaTalking();
    gone.leave();

    assertEquals("", gone.getCurrentBubble());
  }

  // With no text at all (her list left empty by mistake), she does not come: no walk, no bubble, and a frame or a
  // click never reads a text that does not exist.
  /** With no fun fact, she does not come, and update, nextBubble and getCurrentBubble do nothing. */
  @Test
  void noFactsMeansNoVisit() {
    Melda melda = new Melda(List.of(), LETTERS_PER_SECOND, NIGHT_COUNT, new Random(0));

    melda.startIfToday(melda.getDay());

    assertFalse(melda.isVisiting());
    assertDoesNotThrow(() -> {
      melda.update(1f);
      melda.nextBubble();
    });
    assertEquals("", melda.getCurrentBubble());
    assertFalse(melda.isBubbleWritten());
  }
}
