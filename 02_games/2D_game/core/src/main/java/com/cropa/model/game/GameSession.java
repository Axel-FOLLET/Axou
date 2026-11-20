package com.cropa.model.game;

// The defenses: their slots, their numbers and the offers of the shop.
import com.cropa.model.defense.Defense;
import com.cropa.model.defense.DefenseConfig;
import com.cropa.model.defense.DefenseOffer;
import com.cropa.model.defense.DefenseSlots;
import com.cropa.model.defense.DefenseType;
// The player's money and the shop that sells the crops, the seeds and the defenses.
import com.cropa.model.economy.Shop;
import com.cropa.model.economy.Wallet;
// Enemy, the type of the list, and the config that gives the farm's health.
// EnemyFactory, WaveSpawner and WaveTable: the waves of the nights. Farmer: old Garry and his pitchfork.
// Cat: the farmer's cat, which only looks at the enemies.
import com.cropa.model.enemy.Cat;
import com.cropa.model.enemy.Enemy;
import com.cropa.model.enemy.EnemyConfig;
import com.cropa.model.enemy.EnemyFactory;
import com.cropa.model.enemy.Farmer;
import com.cropa.model.enemy.WaveSpawner;
import com.cropa.model.enemy.WaveTable;
// The field, the crops that grow at dawn, the config that gives their numbers, and the farm the enemies attack.
import com.cropa.model.world.Board;
import com.cropa.model.world.Crop;
import com.cropa.model.world.CropConfig;
import com.cropa.model.world.Farm;
// Collections: a read-only view of the enemies. List and Random: the types of the fields and the parameter.
// Optional: the result of the game, absent while it goes on.
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.Random;

// The entry point of the model: the screen only calls update(delta) at each frame.
// The model knows nothing about libGDX, so a whole night can be tested without a window.
// The timer and the phases live in DayNightCycle; GameSession moves the enemies and asks the cycle to go on.
// Each night brings its wave (WaveSpawner, started by NightState). The game starts like the rules say: 250 coins,
// an empty field and no defense; everything else is bought by the player.
/**
 * The game: the field, the farm, the enemies, the defenses, the player's money and the
 * day and night cycle. It starts on day 1, with an empty field, no defense and the
 * starting money; each night brings its wave of enemies.
 */
public class GameSession {

  // -------------------- FIELDS --------------------
  // The objects the night is made of. They never change during the night, so they are final.
  // enemies is a list that GameSession fills itself; the outside only sees it read-only.
  private final Board board;
  private final Farm farm;
  private final List<Enemy> enemies = new ArrayList<>();

  // The ten slots above and below the field, and the defenses placed on its cells (scarecrow, bramble).
  private final DefenseSlots defenseSlots = new DefenseSlots();

  // The player's money, and the shop that sells into it. Both live as long as the game.
  private final Wallet wallet;
  private final Shop shop;

  // The day and night cycle keeps the timer and the current phase; the dawn is DayState.enter, which calls dawn.
  private final DayNightCycle cycle;

  // Melda comes once per game, on her day: DayState starts her at that dawn, NightState sends her away.
  private final Melda melda;

  // The number of nights of a game (8): the dawn after the last one decides the urn. Read once from GameConfig.
  private final int nightCount;

  // The waves of the nights: NightState starts the wave of each night and adds the enemies it creates.
  // GameSession only keeps it, so every night of the game uses the same table and the same factory.
  private final WaveSpawner waveSpawner;

  // Old Garry, in front of the farm: his pitchfork hits the enemies around him at each frame.
  private final Farmer farmer;

  // The farmer's cat (day 11): decorative, it runs away from the enemies on it and meows. The view reads it.
  private final Cat cat;

  // Pattern Observer: the subscribers (the HUD) only seen through GameListener, so the model never knows the screen.
  private final List<GameListener> listeners = new ArrayList<>();

  // How the game ended: null while it goes on. Not final: it is set once, when the game ends.
  // null stays inside the class: the outside only sees it through getResult, as an Optional.
  private GameResult result;

  // The last values sent to the listeners, to send only what changed.
  // -1 is never a real value: the first frame sends everything. lastNight only counts once lastNumber is set.
  private int lastNumber = -1;
  private boolean lastNight;
  private int lastSecondsLeft = -1;
  private int lastFarmHealth = -1;
  private int lastBalance = -1;

  // true once onGameOver has been sent: the end of the game is told only once, at the frame where it appears.
  private boolean gameOverSent;

  // -------------------- CONSTRUCTOR --------------------
  // Called once when the game starts.
  // It prepares day 1: an empty field, the farm at full health, no defense, and a wallet with the starting money.
  // No enemy: the waves come with the nights.
  // random is the only source of chance of the game: the factory gives it to every enemy (deviations, the mole's
  // crops), so a test with a fixed seed always plays the same game.
  /**
   * Creates the game, on day 1.
   *
   * @param config the balancing numbers of the game: the starting money, the durations of
   *               the day and the night, the number of nights, and the configs of the crops,
   *               the enemies and the defenses
   * @param random the source of randomness of the game, given to every enemy
   */
  public GameSession(GameConfig config, Random random) {
    // Injection: the numbers come from GameConfig, never created here, so a test can give other ones.
    CropConfig cropConfig = config.getCropConfig();
    EnemyConfig enemyConfig = config.getEnemyConfig();

    board = new Board();

    farm = new Farm(enemyConfig.getFarmHealth());

    // One DefenseConfig for the whole game, from GameConfig: every defense on sale shares the same numbers.
    DefenseConfig defenseConfig = config.getDefenseConfig();

    // One offer per DefenseType, in the order of the enum: a fourth defense added to the enum is on sale
    // without a change here or in Shop. Each offer gets the live list of enemies, so a defense bought later
    // also sees the enemies added by addEnemy, and the slots, which keep the scarecrows and the brambles placed
    // on the field.
    List<DefenseOffer> offers = new ArrayList<>();
    for (DefenseType type : DefenseType.values()) {
      offers.add(new DefenseOffer(type, defenseConfig, enemies, defenseSlots));
    }

    // The 250 coins of the rules come from GameConfig; the shop gets the same wallet, so a sale fills it
    // and a purchase empties it. It gets the same CropConfig as the board, so a seed it plants has the same numbers.
    // Injection: the shop receives its offers, it does not build them.
    wallet = new Wallet(config.getStartingMoney());
    shop = new Shop(wallet, cropConfig, config, offers);

    // The cycle starts on day 1 by itself (current = day): the night comes with its timer or the button.
    cycle = new DayNightCycle(config);
    // Her day is the first draw of the game's Random, before any enemy: the same seed always gives the same day.
    // Every later draw (the moles, the witches) comes one step after it.
    melda = new Melda(config.getMeldaFacts(), config.getMeldaLettersPerSecond(), config.getNightCount(), random);

    // config is only a parameter: the number of nights is kept, for the check of the last dawn in update.
    nightCount = config.getNightCount();

    // The waves (day 10). The factory gets the board, the farm, the slots as the DefenseLine the fleeing enemies
    // wear, and the game's Random. Created last, once all of them exist.
    EnemyFactory factory = new EnemyFactory(board, farm, enemyConfig, defenseSlots, random);
    waveSpawner = new WaveSpawner(new WaveTable(), factory);
    farmer = new Farmer(enemyConfig);
    // The cat gets a Random of its own, drawn once from the game's one: its draw of every second does not mix with
    // the draws of the moles and the witches. The game stays the same for the same seed.
    cat = new Cat(new Random(random.nextLong()));
  }

  // -------------------- ACTIONS --------------------
  // Called by the screen at each frame with the time since the previous one.
  // A game over is frozen: nothing moves any more, only the listeners are still told.
  // The enemies never get more time than the phase has left:
  // without Math.min, a single update(100f) would let the bat hit the farm long after dawn.
  // The defenses come after the enemies, with the same capped time, so they aim at where the enemies are now.
  // Then the farmer, the rewards of the killed enemies, and the removal of the dead and the fled.
  // The cycle comes after the loops: a phase that adds enemies never does it while the list is walked.
  // Then the end of the game: the farm is checked once every hit of the frame is done,
  // then the last dawn, once the cycle has moved (the dawn after night 8 happens inside cycle.update).
  // notifyChanges comes last, once the frame is over: the listeners see the final values.
  /**
   * Makes the game go forward: the enemies move, the defenses shoot, the farmer hits, each
   * killed enemy pays its reward, the dead and the fled leave the game, the day and night cycle
   * goes on, the end of the game is checked (the farm, then the last dawn), then the listeners
   * hear what changed. Once the game is over, nothing moves any more: only the listeners are
   * told what changed.
   *
   * @param delta the time since the previous update, in seconds
   */
  public void update(float delta) {
    // The freeze: once there is a result, the enemies, the defenses and the timer stop, and the end is never checked again.
    // notifyChanges is still called: a victory bought by the view (buyUrn, outside update) is only told here,
    // so without it the listeners would never hear of it. gameOverSent keeps the announcement to a single call.
    if (isOver()) {
      notifyChanges();
      return;
    }
    float elapsed = Math.min(delta, cycle.getTimeLeft());
    for (Enemy enemy : enemies) {
      enemy.update(elapsed);
    }
    for (Defense defense : defenseSlots.getDefenses()) {
      defense.update(elapsed);
    }
    // Old Garry hits after the defenses, with the same capped time: he sees the enemies where they are now.
    farmer.update(elapsed, enemies);
    // The cat looks at the enemies where they are now, after the farmer's hit: a bat he just killed scares nobody.
    cat.update(elapsed, enemies);
    // The rewards before the removal: an enemy killed during this frame would otherwise leave the list unpaid.
    // collectReward pays only a dead enemy, and only once: asking every enemy at every frame is safe.
    for (Enemy enemy : enemies) {
      wallet.add(enemy.collectReward());
    }
    // The dead and the fled leave the list. isDead or hasFled, never !isOnBoard: a mole underground is not on the
    // board, but it is still part of the night. removeIf removes while it walks the list, with no loop by hand.
    enemies.removeIf(enemy -> enemy.isDead() || enemy.hasFled());
    cycle.update(this, delta);
    // Defeat 1 of the rules: checked once the enemies and the cycle have moved, so a hit of this very frame counts.
    if (farm.isDestroyed()) {
      result = GameResult.DEFEAT_FARM_DESTROYED;
    } else if (!cycle.isNight() && cycle.getNumber() > nightCount) {
      // The day after the last night (day 9): the rich man sells the urn, unless the player buys it now.
      // else if: a farm destroyed in the same frame comes first, so the urn is not bought and the defeat stays.
      // shop.buyUrn pays only if the balance is enough: the 10 000 coins in hand win, anything less loses.
      if (shop.buyUrn()) {
        result = GameResult.VICTORY;
      } else {
        result = GameResult.DEFEAT_URN_SOLD;
      }
    }
    notifyChanges();
  }

  // Compares each value with the last one sent, and calls the listeners only if it changed.
  // What happens outside update (a sale, "Launch the night") is sent by the next frame, with no other code.
  // The phase compares the number and day or night: day 1 and night 1 share the number 1.
  /**
   * Tells the listeners about the phase, the timer, the farm's health and the money, if
   * they changed since the last call, and about the end of the game, once.
   */
  private void notifyChanges() {
    int number = cycle.getNumber();
    boolean night = cycle.isNight();
    if (number != lastNumber || night != lastNight) {
      for (GameListener listener : listeners) {
        if (night) {
          listener.onNightStarted(number);
        } else {
          listener.onDayStarted(number);
        }
      }
      lastNumber = number;
      lastNight = night;
    }

    int secondsLeft = cycle.getSecondsLeft();
    if (secondsLeft != lastSecondsLeft) {
      for (GameListener listener : listeners) {
        listener.onTimerChanged(secondsLeft);
      }
      lastSecondsLeft = secondsLeft;
    }

    int farmHealth = getFarmHealth();
    if (farmHealth != lastFarmHealth) {
      for (GameListener listener : listeners) {
        listener.onFarmHealthChanged(farmHealth);
      }
      lastFarmHealth = farmHealth;
    }

    int balance = wallet.getBalance();
    if (balance != lastBalance) {
      for (GameListener listener : listeners) {
        listener.onMoneyChanged(balance);
      }
      lastBalance = balance;
    }

    // Sent once: gameOverSent remembers that the end was told, like lastBalance remembers the last balance.
    // After the money: the HUD gets the last balance (the urn paid) before the end screen.
    if (isOver() && !gameOverSent) {
      for (GameListener listener : listeners) {
        listener.onGameOver(result);
      }
      gameOverSent = true;
    }
  }

  // Called by the view when the player buys the urn (by day: the view reads getCycle().canAct() first).
  // Outside update, like a sale: the victory is only set here, the next frame tells the listeners.
  // Through the session, not getShop().buyUrn(): the shop only takes the money, this one ends the game.
  // A game over keeps its result: once lost (or won), the urn is no longer for sale, and nothing is paid.
  /**
   * Buys the urn: if it is paid, the game is won.
   *
   * @return {@code true} if the urn was paid and the game won, {@code false} if the game is
   *         already over or the balance is too low; nothing changes then
   */
  public boolean buyUrn() {
    if (isOver()) {
      return false;
    }
    if (!shop.buyUrn()) {
      return false;
    }
    result = GameResult.VICTORY;
    return true;
  }

  // The only way to add an enemy (Yohan's witches, then the waves of NightState).
  // The list stays private: from outside, nobody can remove or replace the enemies of the night.
  /**
   * Adds an enemy to the night. It moves and flees with the others.
   *
   * @param enemy the enemy to add
   */
  public void addEnemy(Enemy enemy) {
    enemies.add(enemy);
  }

  // Called by the screen once, to subscribe the HUD. GameSession only knows the interface, never the Hud class.
  /**
   * Subscribes a listener: from the next update, it hears what changes in the game.
   *
   * @param listener the listener to add
   */
  public void addListener(GameListener listener) {
    listeners.add(listener);
  }

  // The dawn, called by DayState.enter. It lives here since day 11 (L7): the session already knows the board, the
  // defenses and the enemies, so DayState only knows GameSession, no longer three other packages.
  // Package-private, not public: only DayState (same package) calls it; the view cannot make a dawn.
  // Every defense hears the dawn, with no instanceof: the bramble grows, the others do nothing (Defense.onDawn).
  // getDefenses gives the slots and the field: a scarecrow or a bramble bought by day is in it.
  /**
   * Makes the dawn: every crop grows one stage, every defense reacts to the dawn and every
   * enemy still on the field flees.
   */
  void dawn() {
    for (Crop crop : board.getCrops()) {
      crop.grow();
    }
    for (Defense defense : defenseSlots.getDefenses()) {
      defense.onDawn();
    }
    for (Enemy enemy : enemies) {
      enemy.flee();
    }
  }

  // -------------------- ACCESSORS --------------------
  // Used by the screen to draw the field and by the tests to check it.
  /**
   * Returns the field.
   *
   * @return the board
   */
  public Board getBoard() {
    return board;
  }

  // Used by the screen to know the phase and the timer, and to call launchNight.
  /**
   * Returns the day and night cycle of the game.
   *
   * @return the cycle
   */
  public DayNightCycle getCycle() {
    return cycle;
  }

  // Read by the view at each frame, like the enemies: no event, it draws her bubble while she talks.
  /**
   * Returns Melda, who comes once per game.
   *
   * @return Melda
   */
  public Melda getMelda() {
    return melda;
  }

  // Used by the screen to draw the defenses, and later by the shop to place and upgrade them.
  /**
   * Returns the slots of the defenses around the field.
   *
   * @return the defense slots
   */
  public DefenseSlots getDefenseSlots() {
    return defenseSlots;
  }

  // Used by the screen to show the balance and by the shop menu to grey out what the player cannot afford.
  /**
   * Returns the player's wallet.
   *
   * @return the wallet
   */
  public Wallet getWallet() {
    return wallet;
  }

  // Used by the screen when the player sells a crop. Only by day: the view reads getCycle().canAct() first.
  /**
   * Returns the shop of the game.
   *
   * @return the shop
   */
  public Shop getShop() {
    return shop;
  }

  // Package-private, not public: the tests build enemies with it, and the view cannot call takeDamage.
  /**
   * Returns the farm the enemies attack.
   *
   * @return the farm
   */
  Farm getFarm() {
    return farm;
  }

  // Package-private, not public: only NightState (same package) starts the wave and asks for its enemies;
  // the view has no reason to create enemies.
  /**
   * Returns the spawner of the waves of the nights.
   *
   * @return the wave spawner
   */
  WaveSpawner getWaveSpawner() {
    return waveSpawner;
  }

  // Used by the screen for the HUD: a number, not the Farm, so the view cannot call takeDamage.
  // getFarm is package-private: from outside the model, this number is the only way to read the farm.
  /**
   * Returns the health left to the farm.
   *
   * @return the farm's health, never negative
   */
  public int getFarmHealth() {
    return farm.getHealth();
  }

  // A read-only view, always up to date: the outside can read the enemies but only GameSession adds them.
  /**
   * Returns the enemies of the night.
   *
   * @return a read-only view of the enemies
   */
  public List<Enemy> getEnemies() {
    return Collections.unmodifiableList(enemies);
  }

  // Read by the view to draw the cat: running away, meowing in its bubble, or sitting.
  /**
   * Returns the farmer's cat.
   *
   * @return the cat
   */
  public Cat getCat() {
    return cat;
  }

  // Read by the view to draw old Garry (day 14): at night, standing, turned to the row of the enemy he hits.
  /**
   * Returns the farmer, old Garry.
   *
   * @return the farmer
   */
  public Farmer getFarmer() {
    return farmer;
  }

  // Used by the HUD to show the end screen, and by the tests to read how the game ended.
  /**
   * Returns how the game ended.
   *
   * @return the result, or an empty Optional while the game goes on
   */
  public Optional<GameResult> getResult() {
    return Optional.ofNullable(result);
  }

  // A shortcut for update and the view: the game is over as soon as it has a result.
  /**
   * Tells whether the game is over.
   *
   * @return {@code true} once the game has a result
   */
  public boolean isOver() {
    return getResult().isPresent();
  }
}
