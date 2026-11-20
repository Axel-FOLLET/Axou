package com.cropa.model.game;

// JUnit: assertion helpers and the @Test marker. Enemy and EnemyType: what the wave brings. List: the enemies
// read back. Random: GameSession takes one.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cropa.model.enemy.Enemy;
import com.cropa.model.enemy.EnemyType;
import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.Test;

// Day 10: the night brings the wave of WaveTable through the WaveSpawner of the session, no longer the bat of the POC.
// The NightState is driven by hand (enter, then update with chosen deltas): nothing else moves, so the test only
// sees what the wave adds. The landmarks of the day sheet, with WaveTable: night 1 = 2 bats on row 2, spread
// over 10 s, after the 5 s of start delay, so at 5 s and 10 s.
/**
 * Tests for {@link NightState}: what the player may do at night, the wave it brings, and when it is over.
 */
class NightStateTest {

  //-------------------- HELPERS --------------------
  // A game on day 1: its cycle gives night 1 to the NightState that enters.
  private static GameSession newSession() {
    return new GameSession(new GameConfig(), new Random(0));
  }

  private static List<EnemyType> typesOf(List<Enemy> enemies) {
    return enemies.stream().map(Enemy::getType).toList();
  }

  //-------------------- WHAT THE PLAYER MAY DO --------------------
  // The rules: no buying, harvesting or upgrading at night.
  /** The player may not act at night. */
  @Test
  void playerMayNotActAtNight() {
    assertFalse(new NightState().canAct());
  }

  //-------------------- THE WAVE --------------------
  // The start delay of WaveTable: nobody during the first 5 s of the night.
  /** No enemy comes before 5 s. */
  @Test
  void noEnemyBeforeFiveSeconds() {
    GameSession session = newSession();
    NightState night = new NightState();

    night.enter(session);
    night.update(session, 4.9f);

    assertTrue(session.getEnemies().isEmpty());
  }

  // The landmark of the day sheet: the 2 bats of night 1, on row 2, at 5 s and at 10 s.
  /** Night 1 brings a bat on row 2 at 5 s, then a second one at 10 s. */
  @Test
  void nightOneBringsTwoBatsOnRowTwoAtFiveAndTenSeconds() {
    GameSession session = newSession();
    NightState night = new NightState();
    night.enter(session);

    night.update(session, 4.9f);
    night.update(session, 0.2f);
    assertEquals(List.of(EnemyType.BAT), typesOf(session.getEnemies()));

    night.update(session, 4.8f);
    assertEquals(1, session.getEnemies().size());

    night.update(session, 0.2f);
    assertEquals(List.of(EnemyType.BAT, EnemyType.BAT), typesOf(session.getEnemies()));
    for (Enemy bat : session.getEnemies()) {
      assertEquals(2, bat.getRow());
    }
  }

  // The night N gets the wave of night N: the number of the cycle (night 2 = 1 mole and 4 bats, the mole and the
  // first bat at 5 s). Night 1 is played by the session itself, until the timer brings day 2.
  /** The second night brings the wave of night 2. */
  @Test
  void theSecondNightBringsTheWaveOfNightTwo() {
    GameSession session = newSession();
    session.getCycle().launchNight(session);
    session.update(new GameConfig().getNightDuration());
    assertFalse(session.getCycle().isNight());
    assertEquals(2, session.getCycle().getNumber());
    int before = session.getEnemies().size();
    NightState night = new NightState();

    night.enter(session);
    night.update(session, 5.1f);

    List<Enemy> newcomers = session.getEnemies().subList(before, session.getEnemies().size());
    assertEquals(List.of(EnemyType.MOLE, EnemyType.BAT), typesOf(newcomers));
  }

  //-------------------- THE END OF THE NIGHT --------------------
  // Asked by the day sheet: after 1 s, the list is empty, but the wave has not come yet. Without the check of the
  // spawner, "every enemy is dead or gone" would be true for an empty list, and the night would end at once.
  /** The night is not over while its wave is still to come, even with no enemy on the field. */
  @Test
  void theNightIsNotOverWhileTheWaveIsComing() {
    GameSession session = newSession();
    NightState night = new NightState();
    night.enter(session);

    night.update(session, 1f);

    assertTrue(session.getEnemies().isEmpty());
    assertFalse(night.isOver(session));
  }

  // The whole wave is out (20 s > 5 + 10): over only once both bats are dead.
  /** The night is over once its whole wave is out and every enemy is dead. */
  @Test
  void theNightIsOverOnceTheWaveIsOutAndEveryEnemyIsDead() {
    GameSession session = newSession();
    NightState night = new NightState();
    night.enter(session);
    night.update(session, 20f);
    assertEquals(2, session.getEnemies().size());
    assertFalse(night.isOver(session));

    for (Enemy bat : session.getEnemies()) {
      bat.takeDamage(bat.getHealth());
    }

    assertTrue(night.isOver(session));
  }

  // "Dead or gone": a fled enemy, still alive, counts as gone. In a game, GameSession removes it before isOver is
  // asked; driven by hand here, it is still in the list, so this half of the rule is checked on its own.
  /** The night is over once its whole wave is out and every enemy has fled. */
  @Test
  void theNightIsOverOnceTheWaveIsOutAndEveryEnemyHasFled() {
    GameSession session = newSession();
    NightState night = new NightState();
    night.enter(session);
    night.update(session, 20f);

    for (Enemy bat : session.getEnemies()) {
      bat.flee();
    }

    assertTrue(night.isOver(session));
  }
}
