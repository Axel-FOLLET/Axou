package com.cropa.model.game;

// The numbers of the crops, the enemies and the defenses: GameConfig carries them, so a game gets all its numbers
// from one object. Language and Texts: the language of the game, and Melda's fun facts in it. List: her fun facts.
import com.cropa.model.defense.DefenseConfig;
import com.cropa.model.enemy.EnemyConfig;
import com.cropa.model.world.CropConfig;
import com.cropa.text.Language;
import com.cropa.text.Texts;
import java.util.List;

// All the balancing numbers of a game live here (section 10 of the rules), not in GameSession.
// It is a normal object passed as a parameter (no static), so a test or a playtest can
// use other numbers without touching the logic.
/**
 * The balancing numbers of a game: starting money, urn price, number of nights,
 * duration of a day and of a night, and the configs of the crops, the enemies and the defenses.
 */
public class GameConfig {

  // -------------------- FIELDS --------------------
  // The numbers are written once, here. They never change during a game, so they
  // are final.
  // Durations are in seconds, as floats, because GameSession.update receives its delta
  // as a float.
  // 250 since day 10 (was 200): with the empty field of the real game, the first day must pay the carrots of the
  // whole field and leave room for the first catapatate (balance simulated over whole games, rules.md §10).
  private final int startingMoney = 250;
  private final int urnPrice = 10000;
  private final int nightCount = 8;
  private final float dayDuration = 60f;
  private final float nightDuration = 45f;

  // Melda (rules section 9): her bubbles are written at 20 letters per second (GDD).
  // Her texts come from the team's interview of Melda, in Texts, in the language of the game. Two versions with the
  // same start and the same end: the second one at the first game, the first one at every "Rejouer" (Axel's choice).
  private final float meldaLettersPerSecond = 20f;
  // The language every text of this game is shown in, and the version of Melda's facts, chosen by the constructor.
  private final Language language;
  private final List<String> meldaFacts;

  // The numbers of the crops, the enemies and the defenses. Final: chosen once, when the game is created.
  // GameSession reads them here instead of creating its own, so a test can give it other numbers.
  private final CropConfig cropConfig;
  private final EnemyConfig enemyConfig;
  private final DefenseConfig defenseConfig;

  // -------------------- CONSTRUCTORS --------------------
  // The real game: the three configs with the numbers of the rules.
  // this(...) calls the other constructor, so the fields are set in one place only.
  // Without a word on the game, it is the first one, in French: the tests that create new GameConfig() keep working.
  /** Creates the configuration of a real first game in French, with the default numbers. */
  public GameConfig() {
    this(Language.FRENCH, true);
  }

  // Called by CropaGame.startNewGame: true at launch and after a change of language, false after "Rejouer". Only
  // Melda's texts change with it.
  /**
   * Creates the configuration of a real game, with the default numbers.
   *
   * @param language the language every text of the game is shown in
   * @param firstGame {@code true} for the first game since the launch, {@code false} after "Rejouer"
   */
  public GameConfig(Language language, boolean firstGame) {
    this(new CropConfig(), new EnemyConfig(), new DefenseConfig(), language, firstGame);
  }

  // Used by the tests (or a playtest) to change some numbers, for example a farm with less health.
  /**
   * Creates a configuration with the given configs.
   *
   * @param cropConfig    the numbers of the crops
   * @param enemyConfig   the numbers of the enemies and the farm
   * @param defenseConfig the numbers of the defenses
   */
  public GameConfig(CropConfig cropConfig, EnemyConfig enemyConfig, DefenseConfig defenseConfig) {
    this(cropConfig, enemyConfig, defenseConfig, Language.FRENCH, true);
  }

  // The one place where the fields are set: every other constructor ends here.
  // private: the five values together are only for the constructors above.
  // firstGame ? A : B gives A when firstGame is true, B otherwise.
  private GameConfig(CropConfig cropConfig, EnemyConfig enemyConfig, DefenseConfig defenseConfig,
      Language language, boolean firstGame) {
    this.cropConfig = cropConfig;
    this.enemyConfig = enemyConfig;
    this.defenseConfig = defenseConfig;
    this.language = language;
    Texts texts = Texts.of(language);
    this.meldaFacts = firstGame ? texts.meldaFirstGame() : texts.meldaReplay();
  }

  // -------------------- ACCESSORS --------------------
  // Called by GameScreen, for the words of the screen.
  /**
   * Returns the language of the game.
   *
   * @return the language every text of the game is shown in
   */
  public Language getLanguage() {
    return language;
  }

  // Called when a game starts, to fill the wallet.
  /**
   * Returns the money the player starts with.
   *
   * @return the starting money, in coins
   */
  public int getStartingMoney() {
    return startingMoney;
  }

  // Called by the shop when the player tries to buy the urn: the price to reach
  // to win.
  /**
   * Returns the price of the urn.
   *
   * @return the urn price, in coins
   */
  public int getUrnPrice() {
    return urnPrice;
  }

  // Called to know when the game ends: after the last night, the urn is sold.
  /**
   * Returns the number of nights of a game.
   *
   * @return the number of nights
   */
  public int getNightCount() {
    return nightCount;
  }

  // Called to start the day timer: a day lasts at most this long.
  /**
   * Returns the maximum duration of a day.
   *
   * @return the day duration, in seconds
   */
  public float getDayDuration() {
    return dayDuration;
  }

  // Called to start the night timer: when it reaches 0, it is dawn.
  /**
   * Returns the duration of a night.
   *
   * @return the night duration, in seconds
   */
  public float getNightDuration() {
    return nightDuration;
  }

  // Called by GameSession when the game starts, for the board, the shop and the seeds.
  /**
   * Returns the numbers of the crops.
   *
   * @return the crop config
   */
  public CropConfig getCropConfig() {
    return cropConfig;
  }

  // Called by GameSession when the game starts, for the farm and the enemies.
  /**
   * Returns the numbers of the enemies and of the farm.
   *
   * @return the enemy config
   */
  public EnemyConfig getEnemyConfig() {
    return enemyConfig;
  }

  // Called by GameSession when the game starts, for the defenses on sale.
  /**
   * Returns the numbers of the defenses.
   *
   * @return the defense config
   */
  public DefenseConfig getDefenseConfig() {
    return defenseConfig;
  }

  // Called by GameSession when the game starts, to create Melda.
  /**
   * Returns Melda's fun facts, one text per bubble.
   *
   * @return her fun facts, in a read-only list
   */
  public List<String> getMeldaFacts() {
    return meldaFacts;
  }

  // Called by GameSession when the game starts, to create Melda.
  /**
   * Returns how fast Melda's bubbles are written.
   *
   * @return the letters written per second
   */
  public float getMeldaLettersPerSecond() {
    return meldaLettersPerSecond;
  }
}
