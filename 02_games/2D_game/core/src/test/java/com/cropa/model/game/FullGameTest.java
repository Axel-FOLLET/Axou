package com.cropa.model.game;

// JUnit: assertion helpers and the @Test marker. Optional: the result of the game. Random: the seed of the game.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Optional;
import java.util.Random;
import org.junit.jupiter.api.Test;

// Milestone M2: a whole game, played without a window, from day 1 to its end.
// Nobody plays: no purchase, and every day is cut short by "Launch the night". Only the waves, the farmer and the
// farm are left, so the game must end by itself. The same seed must always play the same game: the Random given to
// GameSession is the only source of chance (EnemyFactory gives it to every enemy).
/**
 * Tests a whole game without any purchase: it always ends, and the same seed always plays
 * the same game.
 */
class FullGameTest {

  // -------------------- CONSTANTS --------------------
  // Frames of 0.1 s, like a slow screen. The limit is 10 000 s of game, against about 840 s for 8 days and 8 nights:
  // without it, a game that never ends would block the CI instead of failing.
  private static final float FRAME = 0.1f;
  private static final int FRAME_LIMIT = 100_000;

  // -------------------- HELPERS --------------------
  // Plays a game with the given seed and nobody buying anything: each day, the night is launched at once, then the
  // frames go on until the game is over or the limit is reached. The test reads the session when it comes back.
  /** Plays a whole game without any purchase, and returns its session. */
  private GameSession playWithoutBuying(long seed) {
    GameSession session = new GameSession(new GameConfig(), new Random(seed));
    for (int frame = 0; frame < FRAME_LIMIT && !session.isOver(); frame++) {
      if (!session.getCycle().isNight()) {
        session.getCycle().launchNight(session);
      }
      session.update(FRAME);
    }
    return session;
  }

  // -------------------- TESTS --------------------
  // "Prove that a game always ends": isOver is true, so the loop stopped before the limit of frames.
  // Without any defense, the waves bring the farm down before the last dawn.
  /** A game without any purchase ends before the limit of frames, with the farm destroyed. */
  @Test
  void aGameWithoutPurchasesEndsWithTheFarmDestroyed() {
    GameSession session = playWithoutBuying(0);

    assertTrue(session.isOver());
    assertEquals(Optional.of(GameResult.DEFEAT_FARM_DESTROYED), session.getResult());
  }

  // Same seed, same draws: the two games end the same way, on the same night, with the same money.
  /** Two games played with the same seed end with the same result, night and balance. */
  @Test
  void theSameSeedPlaysTheSameGame() {
    GameSession first = playWithoutBuying(0);
    GameSession second = playWithoutBuying(0);

    assertEquals(first.getResult(), second.getResult());
    assertEquals(first.getCycle().getNumber(), second.getCycle().getNumber());
    assertEquals(first.getCycle().isNight(), second.getCycle().isNight());
    assertEquals(first.getWallet().getBalance(), second.getWallet().getBalance());
  }
}
