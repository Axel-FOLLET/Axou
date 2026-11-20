package com.cropa.model.game;

// JUnit: assertion helpers and the @Test marker.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

// The three configs a GameConfig carries: the crops, the enemies and the defenses. List: Melda's fun facts.
import com.cropa.model.defense.DefenseConfig;
import com.cropa.model.enemy.EnemyConfig;
import com.cropa.model.world.CropConfig;
// Language: French, the language of the texts these tests read.
import com.cropa.text.Language;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Tests for {@link GameConfig}.
 */
class GameConfigTest {

  // -------------------- TESTS --------------------
  // Floats are compared with a small tolerance: exact equality on floats is
  // fragile.
  private static final float TOLERANCE = 0.0001f;

  // The numbers come from the rules, not from the GameSession logic.
  // 250 since day 10 (was 200): rebalanced after whole games were simulated.
  /** The player starts with 250 coins. */
  @Test
  void startingMoneyIs250() {
    GameConfig config = new GameConfig();

    assertEquals(250, config.getStartingMoney());
  }

  /** The urn costs 10 000 coins. */
  @Test
  void urnPriceIs10000() {
    GameConfig config = new GameConfig();

    assertEquals(10000, config.getUrnPrice());
  }

  /** A game lasts 8 nights. */
  @Test
  void nightCountIs8() {
    GameConfig config = new GameConfig();

    assertEquals(8, config.getNightCount());
  }

  /** A day lasts at most 60 seconds. */
  @Test
  void dayDurationIs60Seconds() {
    GameConfig config = new GameConfig();

    assertEquals(60f, config.getDayDuration(), TOLERANCE);
  }

  /** A night lasts 45 seconds. */
  @Test
  void nightDurationIs45Seconds() {
    GameConfig config = new GameConfig();

    assertEquals(45f, config.getNightDuration(), TOLERANCE);
  }

  // The default constructor is the real game: it creates the three configs with the numbers of the rules.
  /** A default GameConfig carries a crop, an enemy and a defense config. */
  @Test
  void defaultConfigCarriesTheThreeConfigs() {
    GameConfig config = new GameConfig();

    assertNotNull(config.getCropConfig());
    assertNotNull(config.getEnemyConfig());
    assertNotNull(config.getDefenseConfig());
  }

  // Injection: a test gives its own configs, and GameConfig hands back those very objects, not copies.
  /** A GameConfig built with three configs returns those same configs. */
  @Test
  void givenConfigsAreKept() {
    CropConfig cropConfig = new CropConfig();
    EnemyConfig enemyConfig = new EnemyConfig();
    DefenseConfig defenseConfig = new DefenseConfig();

    GameConfig config = new GameConfig(cropConfig, enemyConfig, defenseConfig);

    assertSame(cropConfig, config.getCropConfig());
    assertSame(enemyConfig, config.getEnemyConfig());
    assertSame(defenseConfig, config.getDefenseConfig());
  }

  // -------------------- MELDA --------------------
  // Rules: her bubbles are written slowly, 20 letters per second (GDD).
  /** Melda writes 20 letters per second. */
  @Test
  void meldaWritesTwentyLettersPerSecond() {
    GameConfig config = new GameConfig();

    assertEquals(20f, config.getMeldaLettersPerSecond(), TOLERANCE);
  }

  // She needs at least one text to talk, and nobody may change her texts during a game: the list is read-only.
  /** Melda has fun facts, in a read-only list. */
  @Test
  void meldaFactsAreGivenInAReadOnlyList() {
    List<String> facts = new GameConfig().getMeldaFacts();

    assertFalse(facts.isEmpty());
    assertThrows(UnsupportedOperationException.class, () -> facts.add("one more"));
  }

  // Two versions (Axel, day 12): the same start (2 bubbles) and the same end (1 bubble), the middle changes. The
  // third bubble is the first one of the middle, so it tells which version is given.
  /** The first game gives the second version: 7 bubbles, the third one about her brushing. */
  @Test
  void firstGameGivesTheSecondVersion() {
    List<String> facts = new GameConfig(Language.FRENCH, true).getMeldaFacts();

    assertEquals(7, facts.size());
    assertTrue(facts.get(2).startsWith("Vous aimez mon brushing"));
  }

  // "Rejouer" creates a GameConfig with false: the first version, with the same start and end as the second one.
  /** "Rejouer" gives the first version: same start and end as the first game, another middle. */
  @Test
  void replayGivesTheFirstVersion() {
    List<String> replay = new GameConfig(Language.FRENCH, false).getMeldaFacts();
    List<String> firstGame = new GameConfig(Language.FRENCH, true).getMeldaFacts();

    assertEquals(7, replay.size());
    assertTrue(replay.get(2).startsWith("J'ai de la famille"));
    assertEquals(firstGame.get(0), replay.get(0));
    assertEquals(firstGame.get(6), replay.get(6));
  }
}
