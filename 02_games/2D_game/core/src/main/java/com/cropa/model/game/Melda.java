package com.cropa.model.game;

// List: her fun facts, one text per bubble. Random: the game's source of chance, for her day.
import java.util.List;
import java.util.Random;

// Melda, the character of the rules (section 9): she comes once per game, on a day drawn at random, never the first.
// Her day is drawn with the Random of the game, given by GameSession: a test with a fixed seed knows her day.
// Her visit (Axel, day 12): she walks in the forest, comes to face Garry, tells all her bubbles, then leaves by the
// dirt road. The phases and their times live here; where she stands on screen is the view's business (MeldaRenderer).
/**
 * Melda, who comes once per game, on a random day from the second one: she walks in the forest, comes to Garry,
 * tells her fun facts in bubbles written word by word, then leaves.
 */
public class Melda {

  // -------------------- PHASES --------------------
  // One value per step of her visit, in their order. The view reads it at each frame to know what to draw.
  /** The steps of her visit, in their order. */
  public enum Phase {
    /** Her day has not come yet: she is not on screen. */
    ABSENT,
    /** She walks in the forest, before she decides to go to Garry. */
    WANDERING,
    /** She walks from the forest to Garry, around the farm. */
    ARRIVING,
    /** She stands in front of Garry and tells her bubbles; the player can only read. */
    TALKING,
    /** Her last bubble is told: she leaves by the dirt road. */
    LEAVING,
    /** She has left, or the night fell: she never comes back in this game. */
    GONE
  }

  // -------------------- CONSTANTS --------------------
  // Fixed times (Axel's choice): no draw at random, so the other draws of the game stay the same.
  // 8 s in the forest, then 6 s to walk to Garry; 6 s to leave by the road.
  private static final float WANDER_DURATION = 8f;
  private static final float ARRIVE_DURATION = 6f;
  private static final float LEAVE_DURATION = 6f;

  // -------------------- FIELDS --------------------
  // Chosen once, when the game is created: her texts, how fast they are written, and her day.
  private final List<String> facts;
  private final float lettersPerSecond;
  private final int day;

  // phase: where she is in her visit; ABSENT until her day. phaseTime: the seconds spent in this phase, for the
  // walking phases. bubble: the index of the current text in facts. letters: how many letters of it are written; a
  // float, so the fractions of letter of each frame add up (at 20 letters per second, a 0.016 s frame writes 0.32).
  private Phase phase = Phase.ABSENT;
  private float phaseTime;
  private int bubble;
  private float letters;

  // -------------------- CONSTRUCTOR --------------------
  // Her day is drawn here, once: nextInt(nightCount - 1) gives 0 to 6 for 8 nights, so 2 + it gives 2 to 8.
  // Never day 1 (rules), and never day 9: the game is settled at that dawn.
  // List.copyOf: a read-only copy, so the caller cannot change her texts afterwards.
  /**
   * Creates Melda and draws her day.
   *
   * @param facts            her fun facts, one text per bubble
   * @param lettersPerSecond how many letters of a bubble are written per second
   * @param nightCount       the number of nights of the game: her day is from 2 to this number
   * @param random           the source of randomness of the game
   */
  public Melda(List<String> facts, float lettersPerSecond, int nightCount, Random random) {
    this.facts = List.copyOf(facts);
    this.lettersPerSecond = lettersPerSecond;
    this.day = 2 + random.nextInt(nightCount - 1);
  }

  // -------------------- ACTIONS --------------------
  // Called at each dawn with the number of the new day. Only her day starts her, and only once: once she has left
  // ABSENT, she never goes back to it, so a second call on her day does not start her again.
  // With no text at all, she has nothing to say: she does not come (GONE at once).
  /**
   * Makes her come if the given day is hers and she has not come yet: she starts walking in the forest. Does
   * nothing otherwise; she does not come at all if she has no fun fact.
   *
   * @param day the number of the day that starts
   */
  public void startIfToday(int day) {
    if (day != this.day || phase != Phase.ABSENT) {
      return;
    }
    phase = facts.isEmpty() ? Phase.GONE : Phase.WANDERING;
    phaseTime = 0;
    bubble = 0;
    letters = 0;
  }

  // Called at each frame of the day, by DayState.update. The timer of the day goes on meanwhile (rules section 9,
  // kept by Axel on day 12).
  // Walking phases: the time adds up, and at the end of the phase the next one starts (the rest of the frame is
  // dropped: a few hundredths of a second, nobody sees it). Talking: the next letters, never past the end of the
  // bubble (Math.min), so getCurrentBubble never goes past the text. DayState calls it on every day: before her
  // day and after she left, nothing happens.
  /**
   * Moves her visit forward: her walks go on, or the next letters of her bubble are written, without going past
   * its end. Does nothing when she is not on screen.
   *
   * @param delta the time since the previous update, in seconds
   */
  public void update(float delta) {
    switch (phase) {
      case WANDERING -> walk(delta, WANDER_DURATION, Phase.ARRIVING);
      case ARRIVING -> walk(delta, ARRIVE_DURATION, Phase.TALKING);
      case TALKING -> letters = Math.min(letters + delta * lettersPerSecond, currentText().length());
      case LEAVING -> walk(delta, LEAVE_DURATION, Phase.GONE);
      default -> {
        // ABSENT or GONE: nothing moves.
      }
    }
  }

  // Called by the view when the player clicks "Passer à la suite" (Axel, day 12). Only once the bubble is fully
  // written: a click while she writes changes nothing, so the player reads at her pace. After the last bubble, she
  // leaves by the road.
  /**
   * Shows her next bubble, with no letter written, once the current one is fully written; after her last bubble,
   * she leaves. Does nothing while the bubble is being written, or when she does not talk.
   */
  public void nextBubble() {
    if (!isBubbleWritten()) {
      return;
    }
    if (bubble < facts.size() - 1) {
      bubble++;
      letters = 0;
    } else {
      phase = Phase.LEAVING;
      phaseTime = 0;
    }
  }

  // Called by NightState.enter at every night: the night falls, she goes at once, wherever she is in her visit.
  // Before her day (ABSENT), nothing: the nights before her day must not cancel her visit.
  /**
   * Makes her leave at once, wherever she is in her visit. Does not stop her from coming later if her day has not
   * come yet.
   */
  public void leave() {
    if (phase != Phase.ABSENT) {
      phase = Phase.GONE;
    }
  }

  // -------------------- QUERIES --------------------
  // Read by the view at each frame: the words of the bubble already written, word by word (Axel, day 12).
  // The letters still go at 20 per second; only whole words are shown, so a word appears at once, never cut.
  // (int) drops the fraction: a letter counts once it is fully written.
  // Whole bubble written: the whole text. Otherwise lastIndexOf(' ', written) looks backwards from the first letter
  // not written yet: the space found ends the last whole word. "Bon matin" with 3 letters: index 3 is the space,
  // so "Bon"; with 5 letters ("Bon m"), the space at 3 again, so "Bon". No space found (-1): no whole word yet.
  // When she does not talk (walking, before her day, after she left), there is nothing to show.
  /**
   * Returns the whole words of the current bubble already written.
   *
   * @return the written words of the current bubble, or an empty text when she does not talk or no word is whole yet
   */
  public String getCurrentBubble() {
    if (phase != Phase.TALKING) {
      return "";
    }
    String text = currentText();
    int written = (int) letters;
    if (written >= text.length()) {
      return text;
    }
    int lastSpace = text.lastIndexOf(' ', written);
    if (lastSpace < 0) {
      return "";
    }
    return text.substring(0, lastSpace);
  }

  // Read by the view at each frame: while she talks, the player can only click "Passer à la suite".
  /**
   * Tells whether she is talking to Garry.
   *
   * @return {@code true} from her arrival in front of Garry to the end of her last bubble, unless the night fell
   */
  public boolean isTalking() {
    return phase == Phase.TALKING;
  }

  // Read by the view: "Passer à la suite" is greyed until this is true.
  /**
   * Tells whether the current bubble is fully written, so the next one can be shown.
   *
   * @return {@code true} while she talks and the last letter of her bubble is written
   */
  public boolean isBubbleWritten() {
    return phase == Phase.TALKING && letters >= currentText().length();
  }

  // Read by the view: while she is on screen, "Lancer la nuit" is greyed, or a night launched during her walk would
  // send her away before she talks (Axel, day 12).
  /**
   * Tells whether she is on screen: walking in the forest, coming, talking or leaving.
   *
   * @return {@code true} from her arrival in the forest until she has left
   */
  public boolean isVisiting() {
    return phase != Phase.ABSENT && phase != Phase.GONE;
  }

  // Read by the view at each frame, to know what to draw.
  /**
   * Returns where she is in her visit.
   *
   * @return her phase
   */
  public Phase getPhase() {
    return phase;
  }

  // Read by the view to place her along her path: 0 at the start of a walk, 1 at its end. A phase that is not a
  // walk gives 0.
  /**
   * Returns how far she is in her current walk.
   *
   * @return from 0 (start) to 1 (end) while she walks in the forest, comes or leaves; 0 otherwise
   */
  public float getWalkProgress() {
    return switch (phase) {
      case WANDERING -> phaseTime / WANDER_DURATION;
      case ARRIVING -> phaseTime / ARRIVE_DURATION;
      case LEAVING -> phaseTime / LEAVE_DURATION;
      default -> 0f;
    };
  }

  // Read by the tests, which play a game until that day, and by the view if it needs it.
  /**
   * Returns the day she comes.
   *
   * @return her day, from 2 to the number of nights
   */
  public int getDay() {
    return day;
  }

  // -------------------- INTERNALS --------------------
  // The whole text of the current bubble, written or not.
  private String currentText() {
    return facts.get(bubble);
  }

  // One walking phase: the time adds up; at the end, the next phase starts from its own beginning.
  private void walk(float delta, float duration, Phase next) {
    phaseTime += delta;
    if (phaseTime >= duration) {
      phase = next;
      phaseTime = 0;
    }
  }
}
