package com.cropa.model.game;

// JUnit: assertion helpers and the @Test marker. Random: GameSession takes one, the only source of chance of the game.
// ArrayList and List: the calls the fake listener writes down. Collections: counts a call. Optional: the result of the game.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cropa.model.defense.Bramble;
import com.cropa.model.defense.Defense;
import com.cropa.model.defense.DefenseConfig;
import com.cropa.model.defense.DefenseOffer;
import com.cropa.model.defense.DefenseType;
import com.cropa.model.defense.SlotSide;
import com.cropa.model.enemy.Bat;
import com.cropa.model.enemy.Enemy;
import com.cropa.model.enemy.EnemyConfig;
import com.cropa.model.enemy.EnemyType;
import com.cropa.model.enemy.Mole;
import com.cropa.model.enemy.Witch;
import com.cropa.model.world.Board;
import com.cropa.model.world.Cell;
import com.cropa.model.world.Crop;
import com.cropa.model.world.CropConfig;
import com.cropa.model.world.CropType;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.Random;
import org.junit.jupiter.api.Test;

/**
 * Tests for {@link GameSession}. Time is injected: a test calls update(45f) instead of
 * waiting 45 seconds.
 */
class GameSessionTest {

  // -------------------- NUMBERS OF THE CONFIG --------------------
  // Day 10: the starting money, the farm's health and the urn's price are read in the configs, not written here,
  // so a rebalance changes them without breaking these tests. A test that needs the urn adds what is missing.
  private static final int STARTING_MONEY = new GameConfig().getStartingMoney();
  private static final int FARM_HEALTH = new EnemyConfig().getFarmHealth();
  private static final int URN_PRICE = new GameConfig().getUrnPrice();
  // The damage of the tough bat in a 45 s night (see addToughBat): 4 hits of a bat. Day 11: 4 hits, no longer 3,
  // because it hits as soon as it arrives. Computed from the config: only the number of hits is written here.
  private static final int BAT_DAMAGE_IN_A_NIGHT = 4 * new EnemyConfig().getFarmDamage(EnemyType.BAT);

  // -------------------- HELPERS --------------------
  // Every test starts from a fresh session with the real numbers of the rules.
  // The game starts by day: the helper launches night 1, so the tests keep their night landmarks.
  /** Creates a session with the default configuration, at the start of night 1. */
  private GameSession newSession() {
    GameSession session = new GameSession(new GameConfig(), new Random(0));
    session.getCycle().launchNight(session);
    return session;
  }

  // The offer of the given defense, as the shop window will find it in the session's shop.
  /** Returns the offer of the given defense in the session's shop. */
  private DefenseOffer offerOf(GameSession session, DefenseType type) {
    return session.getShop().getDefenseOffers().stream()
        .filter(offer -> offer.getType() == type)
        .findFirst()
        .orElseThrow();
  }

  // "Launch the night". Day 10: it no longer kills the enemies in the list. With the waves, the list is empty when
  // the night starts (the first enemy comes after 5 s), and what it still holds are the enemies of the night before,
  // fled at dawn: killing them made them pay their reward, so the balances of the tests went up for nothing.
  /** Starts the night. */
  private void startQuietNight(GameSession session) {
    session.getCycle().launchNight(session);
  }

  // Plays whole nights from a day: each one is quiet, and its 45 s go up to dawn in one update.
  // Quiet since day 10 because of that single update: the wave only appears at the end of the frame (NightState.update
  // comes after the loops of the enemies), and the dawn of the same frame makes it flee. Nobody moves, hits or dies.
  // From day 1, eight calls lead to the dawn after night 8, the last dawn of the rules.
  /** Plays the given number of quiet nights, each from its start to the next dawn. */
  private void playQuietNights(GameSession session, int count) {
    for (int night = 0; night < count; night++) {
      startQuietNight(session);
      session.update(45f);
    }
  }

  // Day 10: the farmer kills a normal bat (20 HP) before it reaches the farm, so a test that counts the hits on the
  // farm adds this bat instead. Its config gives it 1000 HP: neither the farmer nor a catapatate can kill it in
  // a night: it arrives at 28.6 s and, since day 11, hits as soon as it arrives, then every 5 s: at 28.6 s, 33.6 s,
  // 38.6 s and 43.6 s, 4 hits of 10 HP in a 45 s night. Only the health changes: speed, damage and pace are the
  // real ones.
  /** Adds to the game a bat that cannot be killed in a night, and returns it. */
  private Enemy addToughBat(GameSession session, int row) {
    EnemyConfig toughConfig = new EnemyConfig() {
      @Override
      public int getHealth(EnemyType type) {
        return 1000;
      }
    };
    Enemy bat = new Bat(row, session.getFarm(), toughConfig);
    session.addEnemy(bat);
    return bat;
  }

  // Reads the crop on a cell: the test fails right away if the cell is empty or holds something else.
  /** Returns the crop planted on the given cell of the board. */
  private Crop cropAt(Board board, int row, int column) {
    return assertInstanceOf(Crop.class, board.getCell(row, column).getOccupant().orElseThrow());
  }

  // Day 10: the game starts with an empty field. A test that needs a carrot plants it itself, with place: free,
  // without the shop, so the balance and the field of the test only depend on what the test sets up.
  /** Plants a new carrot on the given cell of the game's board, and returns it. */
  private Crop carrotOn(GameSession session, int row, int column) {
    Crop carrot = new Crop(CropType.CARROT, new CropConfig());
    session.getBoard().getCell(row, column).place(carrot);
    return carrot;
  }

  // implements GameListener: the fake subscriber, like RecordingCanvas for the renderers.
  // It writes down each call as text, so a test checks what the model sent, without a HUD.
  /** A {@link GameListener} that records its calls as text. */
  private static class RecordingListener implements GameListener {
    private final List<String> calls = new ArrayList<>();

    @Override
    public void onMoneyChanged(int balance) {
      calls.add("money " + balance);
    }

    @Override
    public void onFarmHealthChanged(int health) {
      calls.add("health " + health);
    }

    @Override
    public void onDayStarted(int day) {
      calls.add("day " + day);
    }

    @Override
    public void onNightStarted(int night) {
      calls.add("night " + night);
    }

    @Override
    public void onTimerChanged(int secondsLeft) {
      calls.add("timer " + secondsLeft);
    }

    @Override
    public void onGameOver(GameResult result) {
      calls.add("game over " + result);
    }
  }

  // -------------------- TESTS --------------------
  // The start of night 1: an empty field (nothing bought) and a farm at full health. No enemy yet: the wave of
  // night 1 brings its first bat after 5 s (WaveTable.getStartDelay), see NightStateTest.
  /** At the start of night 1, the field is empty, there is no enemy yet and the farm has its full health. */
  @Test
  void nightStartsWithAnEmptyFieldAndNoEnemyYet() {
    GameSession session = newSession();

    assertTrue(session.getBoard().getCrops().isEmpty());
    assertTrue(session.getEnemies().isEmpty());
    assertEquals(FARM_HEALTH, session.getFarm().getHealth());
  }

  // Since the rebalance of day 9: the bat arrives at 28.6 s (10 cells at 0.35 cell/s). Since day 11, it hits as soon
  // as it arrives, then every 5 s: at 28.6 s, 33.6 s, 38.6 s and 43.6 s, 4 hits of 10 HP. The next hit would fall at
  // 48.6 s, after the night.
  // Day 10: the tough bat replaces the bat of the POC (the farmer would kill a normal one). The wave of night 1 adds
  // nothing to the hits: in this single frame it only appears at the end, and the dawn makes it flee.
  /** In one 45 s night, the bat hits the farm four times. */
  @Test
  void batHitsTheFarmFourTimesInOneNight() {
    GameSession session = newSession();
    addToughBat(session, 2);

    session.update(45f);

    assertEquals(FARM_HEALTH - BAT_DAMAGE_IN_A_NIGHT, session.getFarm().getHealth());
  }

  // Same 45 s, but the time comes in 45 small steps: the timer must add up the same way.
  // Day 10: by day 1 (60 s, no dawn in these 45 s), not at night: in small steps, the bats of the wave of night 1
  // would walk too, and hit the farm while the farmer is busy with the tough bat, the closest to the farm.
  /** The result does not depend on how the 45 seconds are cut. */
  @Test
  void batHitsTheFarmFourTimesInSmallSteps() {
    GameSession session = new GameSession(new GameConfig(), new Random(0));
    addToughBat(session, 2);

    for (int second = 0; second < 45; second++) {
      session.update(1f);
    }

    assertEquals(FARM_HEALTH - BAT_DAMAGE_IN_A_NIGHT, session.getFarm().getHealth());
  }

  // A carrot has 2 stages: it is worth 5 at stage 0 and 40 once mature, after one dawn.
  // The test plants its two carrots itself: the game starts with an empty field.
  /** The carrots are worth 5 during the night, then 40 at dawn. */
  @Test
  void carrotsGrowAtDawn() {
    GameSession session = newSession();
    carrotOn(session, 1, 1);
    carrotOn(session, 3, 3);

    session.update(44f);
    assertEquals(5, cropAt(session.getBoard(), 1, 1).getValue());
    assertEquals(5, cropAt(session.getBoard(), 3, 3).getValue());

    session.update(1f);
    assertEquals(40, cropAt(session.getBoard(), 1, 1).getValue());
    assertEquals(40, cropAt(session.getBoard(), 3, 3).getValue());
  }

  // After dawn the bat has fled: nothing hits the farm, nothing grows again during the day.
  // Day 10: the bat is added by hand (no more bat of the POC), and once fled it leaves the list of the game.
  // A carrot planted by the test shows that nothing grows again during the day.
  /** The bat flees at dawn, leaves the game, and nothing changes after. */
  @Test
  void batFleesAtDawnAndNothingChangesAfter() {
    GameSession session = newSession();
    carrotOn(session, 1, 1);
    Enemy bat = addToughBat(session, 2);

    session.update(45f);
    assertTrue(bat.hasFled());
    int farmHealth = session.getFarm().getHealth();
    int stage = cropAt(session.getBoard(), 1, 1).getStage();

    session.update(10f);

    assertTrue(bat.hasFled());
    assertFalse(session.getEnemies().contains(bat));
    assertEquals(farmHealth, session.getFarm().getHealth());
    assertEquals(stage, cropAt(session.getBoard(), 1, 1).getStage());
  }

  // Without Math.min(delta, timeLeft), this single update would let the bat hit far after dawn.
  /**
   * One huge update never gives the enemies more time than the night has left.
   */
  @Test
  void oneHugeUpdateDoesNotGoPastDawn() {
    // Day 10: the tough bat replaces the bat of the POC, so its hits (4 since day 11) still prove the cap of 45 s.
    GameSession session = newSession();
    Enemy bat = addToughBat(session, 2);

    session.update(100f);

    assertEquals(FARM_HEALTH - BAT_DAMAGE_IN_A_NIGHT, session.getFarm().getHealth());
    assertTrue(bat.hasFled());
  }

  // Before dawn nobody flees: the bat is still on the field.
  /** The bat has not fled before dawn. */
  @Test
  void batDoesNotFleeBeforeDawn() {
    GameSession session = newSession();

    session.update(44f);

    assertFalse(session.getEnemies().get(0).hasFled());
  }

  // The screen only needs a number for the HUD: it no longer gets the Farm and its takeDamage.
  /** The farm starts at the health of the config (150 HP since day 10). */
  @Test
  void farmHealthStartsFull() {
    assertEquals(FARM_HEALTH, newSession().getFarmHealth());
  }

  // Same night as batHitsTheFarmFourTimesInOneNight (with its tough bat since day 10), read through getFarmHealth.
  /** getFarmHealth follows the hits of the night. */
  @Test
  void farmHealthFollowsTheHits() {
    GameSession session = newSession();
    addToughBat(session, 2);

    session.update(45f);

    assertEquals(FARM_HEALTH - BAT_DAMAGE_IN_A_NIGHT, session.getFarmHealth());
  }

  // addEnemy is the only way in: the list itself stays read-only.
  // Day 10: the list is empty at the start of the night (no more bat of the POC), so the added bat is the only one.
  /** An added enemy is part of the night. */
  @Test
  void addedEnemyIsInTheNight() {
    GameSession session = newSession();
    Enemy added = new Bat(1, session.getFarm(), new EnemyConfig());

    session.addEnemy(added);

    assertEquals(1, session.getEnemies().size());
    assertSame(added, session.getEnemies().get(0));
  }

  // Without this test, an added enemy could sit in the list without ever moving.
  // Two bats hit 4 times each (day 11): 2 x 40 HP lost. Day 10: two tough bats, on rows 2 and 1, in place of the bat of
  // the POC and the added normal bat, which the farmer would now kill before they reach the farm.
  /** An added enemy plays the night like the others. */
  @Test
  void addedEnemyPlaysTheNight() {
    GameSession session = newSession();
    addToughBat(session, 2);
    addToughBat(session, 1);

    session.update(45f);

    assertEquals(FARM_HEALTH - 2 * BAT_DAMAGE_IN_A_NIGHT, session.getFarmHealth());
  }

  // -------------------- CYCLE --------------------
  // The rules start on day 1. No newSession() here: it launches the night.
  /** A new session starts by day. */
  @Test
  void sessionStartsByDay() {
    assertFalse(new GameSession(new GameConfig(), new Random(0)).getCycle().isNight());
  }

  // Day 1 has no enemy: the waves only come with the nights (NightState).
  // If an enemy were added by the constructor, it would hit the farm during day 1.
  /** The farm loses nothing during day 1. */
  @Test
  void firstDayLeavesTheFarmIntact() {
    GameSession session = new GameSession(new GameConfig(), new Random(0));

    session.update(59f);

    assertTrue(session.getEnemies().isEmpty());
    assertEquals(FARM_HEALTH, session.getFarmHealth());
  }

  // At dawn DayState takes over: the player may buy and harvest again.
  /** After the 45 s night, it is day and the player may act. */
  @Test
  void playerCanActAfterDawn() {
    GameSession session = newSession();

    session.update(45f);

    assertFalse(session.getCycle().isNight());
    assertTrue(session.getCycle().canAct());
  }

  // -------------------- MELDA --------------------
  // Melda is created with the game, but never comes on day 1 (rules section 9): the first dawn is the one of day 2.
  /** A new game has Melda, and she does not talk on day 1. */
  @Test
  void newGameHasMeldaSilentOnDayOne() {
    GameSession session = new GameSession(new GameConfig(), new Random(0));

    assertNotNull(session.getMelda());
    assertFalse(session.getMelda().isTalking());
  }

  // Her day is drawn by the seed, so the test reads it instead of writing it: getDay() - 1 quiet nights from day 1
  // lead to the dawn of her day. Quiet nights: the farm is never hit, so the game always reaches her day.
  // At that dawn she comes into the forest first (day 12): she is on screen, she does not talk yet.
  /** Played up to the dawn of her day, Melda comes; the day before, she does not. */
  @Test
  void meldaComesAtTheDawnOfHerDay() {
    GameSession session = new GameSession(new GameConfig(), new Random(0));
    int meldaDay = session.getMelda().getDay();

    playQuietNights(session, meldaDay - 2);
    assertFalse(session.getMelda().isVisiting());

    playQuietNights(session, 1);
    assertEquals(meldaDay, session.getCycle().getNumber());
    assertTrue(session.getMelda().isVisiting());
  }

  // DayState.update moves her visit with the frames of the day: 8 s in the forest, then 6 s to Garry (one frame
  // each, the end of a walk starts the next phase), then 0.5 s at 20 letters per second is 10 letters.
  // Her bubble shows whole words only (day 12): her first word, "Qu'est-ce", has 9 letters and the 10th is the
  // space after it, so it is whole. Read from GameConfig: up to the first space of her first text.
  /** On her day, the frames bring her to Garry, then write the next letters of her bubble. */
  @Test
  void meldaWritesHerBubbleDuringTheDay() {
    GameSession session = new GameSession(new GameConfig(), new Random(0));
    playQuietNights(session, session.getMelda().getDay() - 1);

    session.update(8f);
    session.update(6f);
    assertTrue(session.getMelda().isTalking());
    session.update(0.5f);

    String firstFact = new GameConfig().getMeldaFacts().get(0);
    assertEquals(firstFact.substring(0, firstFact.indexOf(' ')), session.getMelda().getCurrentBubble());
  }

  // The night falls during her visit: NightState sends her away, wherever she is.
  /** The night after her day, Melda is no longer on screen. */
  @Test
  void meldaLeavesWhenTheNightFalls() {
    GameSession session = new GameSession(new GameConfig(), new Random(0));
    playQuietNights(session, session.getMelda().getDay() - 1);

    startQuietNight(session);

    assertFalse(session.getMelda().isVisiting());
  }

  // -------------------- DEFENSES --------------------
  // Rules, "Argent au départ": the game starts with 250 coins, an empty field and no defense.
  // Everything on the field is now bought by the player, or placed by the test that needs it.
  /** A new session starts with an empty field, no defense and the starting money. */
  @Test
  void sessionStartsEmpty() {
    GameSession session = new GameSession(new GameConfig(), new Random(0));

    assertTrue(session.getBoard().getCrops().isEmpty());
    assertTrue(session.getDefenseSlots().getDefenses().isEmpty());
    assertEquals(STARTING_MONEY, session.getWallet().getBalance());
  }

  // The catapatate plays the night: it hits the bat on its way, without killing it.
  // Small steps, like real frames: the bat is in range only between 11.4 s and 14.3 s (column 3, at 0.35 cell/s),
  // and a single update(45f) would let the catapatate aim only once, at the end of the night.
  // Day 10: a bat added by hand, watched for 18 s only: at 18 s it is 3.7 cells from the farm, past the catapatate
  // and not yet in the farmer's square (3 cells), so every hit it took came from the catapatate. The farm is no
  // longer checked: the farmer now kills this bat before it reaches the farm (GameSessionTest, ENEMIES section).
  // The game starts with no defense: the test buys its catapatate on TOP 3 through the shop, like a player. The offer
  // gives it the live list of the enemies, so it also sees the bat added after it.
  /** The catapatate hits the bat on its way, without killing it. */
  @Test
  void catapatateHitsTheBatWithoutKillingIt() {
    GameSession session = newSession();
    assertTrue(session.getShop().buyDefense(offerOf(session, DefenseType.CATAPATATE),
        session.getDefenseSlots().getSlot(SlotSide.TOP, 3)));
    Enemy bat = new Bat(2, session.getFarm(), new EnemyConfig());
    session.addEnemy(bat);
    int startingHealth = bat.getHealth();

    for (int second = 0; second < 18; second++) {
      session.update(1f);
    }

    assertTrue(bat.getCellsToFarm() > 3f);
    assertTrue(bat.getHealth() < startingHealth);
    assertFalse(bat.isDead());
  }

  // -------------------- LISTENERS --------------------
  // The last values sent start at -1: the first frame sends everything, so a HUD subscribed at the start is up to date.
  /** The first update sends the phase, the timer, the farm's health and the money. */
  @Test
  void firstUpdateSendsEverything() {
    GameSession session = newSession();
    RecordingListener listener = new RecordingListener();
    session.addListener(listener);

    session.update(1f);

    assertEquals(List.of("night 1", "timer 44", "health " + FARM_HEALTH, "money " + STARTING_MONEY), listener.calls);
  }

  // 44.5 s left still shows 44: nothing changed, so nothing is sent.
  /** An update that changes nothing the screen shows sends nothing. */
  @Test
  void unchangedValuesSendNothing() {
    GameSession session = newSession();
    RecordingListener listener = new RecordingListener();
    session.addListener(listener);
    session.update(1f);
    listener.calls.clear();

    session.update(0.5f);

    assertTrue(listener.calls.isEmpty());
  }

  // At dawn the phase changes to day 2, and the bat's four hits (day 11) have cost the farm 40 HP.
  // Day 10: the tough bat replaces the bat of the POC. The wave of night 1 adds no hit: its first bat is due at 5 s,
  // so it only appears at the end of the last frame (44 s long), and the dawn makes it flee.
  /** The end of the night sends the new day and the farm's new health. */
  @Test
  void dawnSendsTheNewDayAndTheHits() {
    GameSession session = newSession();
    addToughBat(session, 2);
    RecordingListener listener = new RecordingListener();
    session.addListener(listener);
    session.update(1f);
    session.update(0.5f);

    session.update(44f);

    assertTrue(listener.calls.contains("day 2"));
    assertTrue(listener.calls.contains("health " + (FARM_HEALTH - BAT_DAMAGE_IN_A_NIGHT)));
  }

  // -------------------- MONEY --------------------
  // The wallet is filled with GameConfig.getStartingMoney(): 250 coins since day 10.
  /** A new session starts with the starting money. */
  @Test
  void walletStartsWithTheStartingMoney() {
    assertEquals(STARTING_MONEY, newSession().getWallet().getBalance());
  }

  // The immediate sale: the carrot of r1c1, planted by the test, is sold at stage 0, for 5.
  /** Selling the new carrot of r1c1 brings 5 coins. */
  @Test
  void newCarrotOfR1C1SellsRightAway() {
    GameSession session = newSession();
    carrotOn(session, 1, 1);

    assertTrue(session.getShop().sell(session.getBoard().getCell(1, 1)));
    assertEquals(STARTING_MONEY + 5, session.getWallet().getBalance());
  }

  // The landmark of the day 7: 5 coins for the first sale, then 40 more once the carrot of r3c3 has grown at dawn.
  // The test plants both carrots itself: the game starts with an empty field.
  /** The carrot of r3c3, sold mature after the night, brings 40 more. */
  @Test
  void matureCarrotOfR3C3SellsAfterTheNight() {
    GameSession session = newSession();
    carrotOn(session, 1, 1);
    carrotOn(session, 3, 3);
    session.getShop().sell(session.getBoard().getCell(1, 1));

    session.update(45f);

    assertTrue(session.getShop().sell(session.getBoard().getCell(3, 3)));
    assertEquals(STARTING_MONEY + 45, session.getWallet().getBalance());
  }

  // A sale happens outside update: the next frame sends the new balance, with no other code.
  /** After a sale, the next update sends the new balance only. */
  @Test
  void saleIsSentByTheNextFrame() {
    GameSession session = newSession();
    carrotOn(session, 1, 1);
    RecordingListener listener = new RecordingListener();
    session.addListener(listener);
    session.update(1f);
    listener.calls.clear();
    session.getShop().sell(session.getBoard().getCell(1, 1));

    session.update(0.5f);

    assertEquals(List.of("money " + (STARTING_MONEY + 5)), listener.calls);
  }

  // -------------------- SEEDS --------------------
  // End to end: a seed bought through the session's shop lands on its board and grows at dawn.
  // The field starts empty, so r1c3 is free; the bats of night 1 fly, so they never crush it.
  /** A carrot bought through getShop() costs 10, and grows one stage after the night. */
  @Test
  void boughtSeedGrowsAfterTheNight() {
    GameSession session = newSession();

    assertTrue(session.getShop().buySeed(CropType.CARROT, session.getBoard().getCell(1, 3)));
    assertEquals(STARTING_MONEY - 10, session.getWallet().getBalance());
    assertEquals(0, cropAt(session.getBoard(), 1, 3).getStage());

    session.update(45f);

    assertEquals(1, cropAt(session.getBoard(), 1, 3).getStage());
  }

  // -------------------- DEFENSES --------------------
  // The shop of the game sells the three defenses of the rules, in the order of DefenseType.
  /** The session's shop sells the catapatate, the scarecrow and the bramble. */
  @Test
  void sessionSellsTheThreeDefenses() {
    List<DefenseOffer> offers = newSession().getShop().getDefenseOffers();

    assertEquals(3, offers.size());
    assertEquals(DefenseType.CATAPATATE, offers.get(0).getType());
    assertEquals(DefenseType.SCARECROW, offers.get(1).getType());
    assertEquals(DefenseType.BRAMBLE, offers.get(2).getType());
  }

  // End to end: a bramble bought on day 1 grows at the dawn of day 2 (DayState calls onDawn), then stings at night 2.
  // Created directly, not by newSession: the game starts on day 1, when the player may buy.
  // The game starts with no defense: only the bramble hurts the witch. Night 1 has only bats,
  // which fly over the bramble. The witch walks in small steps, like in BrambleTest, until she has passed it.
  // Day 10: she stops at 4 cells (column 1), not 3: from 3 cells, the farmer would hit her too (4 HP a second).
  /** A bramble bought on day 1 is young during night 1, and stings a witch at night 2. */
  @Test
  void brambleOfDay1StingsFromNight2() {
    GameSession session = new GameSession(new GameConfig(), new Random(0));
    Cell cell = session.getBoard().getCell(3, 4);
    assertTrue(session.getShop().buyDefense(offerOf(session, DefenseType.BRAMBLE), cell));
    Bramble bramble = assertInstanceOf(Bramble.class, session.getDefenseSlots().getDefenseOn(cell).orElseThrow());

    session.getCycle().launchNight(session);
    assertFalse(bramble.isActive());
    session.update(45f);
    assertTrue(bramble.isActive());

    session.getCycle().launchNight(session);
    Witch witch = new Witch(3, session.getFarm(), session.getBoard(), new EnemyConfig(),
        (row, column, percent) -> {
        }, new Random(0));
    session.addEnemy(witch);
    while (!witch.isDead() && witch.getCellsToFarm() > 4) {
      session.update(1f / 60f);
    }

    assertEquals(new EnemyConfig().getHealth(EnemyType.WITCH) - 3, witch.getHealth());
    assertEquals(80, bramble.getDurability());
    assertSame(bramble, cell.getOccupant().orElseThrow());
  }

  // -------------------- END OF THE GAME --------------------
  // A game that just started has no result: the Optional is empty, and isOver says the same.
  /** A new game is not over. */
  @Test
  void newGameIsNotOver() {
    GameSession session = newSession();

    assertTrue(session.getResult().isEmpty());
    assertFalse(session.isOver());
  }

  // getFarm is package-private: the test, in the same package, takes the farm down without 7 nights of bats.
  /** A farm at 0 HP ends the game with DEFEAT_FARM_DESTROYED. */
  @Test
  void destroyedFarmLosesTheGame() {
    GameSession session = newSession();
    session.getFarm().takeDamage(FARM_HEALTH);

    session.update(0.1f);

    assertEquals(Optional.of(GameResult.DEFEAT_FARM_DESTROYED), session.getResult());
    assertTrue(session.isOver());
  }

  // gameOverSent: three frames after the end, the listener has heard of it only once.
  /** The end of the game is sent once, even after several updates. */
  @Test
  void farmDestroyedIsSentOnce() {
    GameSession session = newSession();
    RecordingListener listener = new RecordingListener();
    session.addListener(listener);
    session.getFarm().takeDamage(FARM_HEALTH);

    session.update(0.1f);
    session.update(0.1f);
    session.update(0.1f);

    assertEquals(1, Collections.frequency(listener.calls, "game over DEFEAT_FARM_DESTROYED"));
  }

  // The starting money + what is missing, minus 1 = 9 999, one short: the shop refuses, the game goes on, the wallet
  // is untouched.
  /** With 9 999 coins, buying the urn changes nothing. */
  @Test
  void urnTooExpensiveDoesNotWin() {
    GameSession session = newSession();
    session.getWallet().add(URN_PRICE - STARTING_MONEY - 1);

    assertFalse(session.buyUrn());
    assertTrue(session.getResult().isEmpty());
    assertEquals(URN_PRICE - 1, session.getWallet().getBalance());
  }

  // The starting money + what is missing = the exact price: the urn is paid and the game is won at once.
  /** With 10 000 coins, buying the urn wins the game and empties the wallet. */
  @Test
  void boughtUrnWinsTheGame() {
    GameSession session = newSession();
    session.getWallet().add(URN_PRICE - STARTING_MONEY);

    assertTrue(session.buyUrn());
    assertEquals(Optional.of(GameResult.VICTORY), session.getResult());
    assertEquals(0, session.getWallet().getBalance());
  }

  // buyUrn is called by the view, outside update: the next frame tells the listeners, through notifyChanges.
  /** The next update sends the victory once, and the empty wallet. */
  @Test
  void victoryIsSentByTheNextFrame() {
    GameSession session = newSession();
    RecordingListener listener = new RecordingListener();
    session.addListener(listener);
    session.getWallet().add(URN_PRICE - STARTING_MONEY);
    session.buyUrn();

    session.update(0.1f);

    assertEquals(1, Collections.frequency(listener.calls, "game over VICTORY"));
    assertTrue(listener.calls.contains("money 0"));
  }

  // The guard of buyUrn: a game over keeps its result. Lost at the last dawn, then given the money,
  // the player still cannot buy the urn: nothing is paid and the defeat stays.
  /** Once the game is over, buying the urn is refused and changes nothing. */
  @Test
  void urnCannotBeBoughtOnceTheGameIsOver() {
    GameSession session = new GameSession(new GameConfig(), new Random(0));
    playQuietNights(session, 8);
    session.getWallet().add(10000);
    int balance = session.getWallet().getBalance();

    assertFalse(session.buyUrn());
    assertEquals(Optional.of(GameResult.DEFEAT_URN_SOLD), session.getResult());
    assertEquals(balance, session.getWallet().getBalance());
  }

  // Injection: the session takes its numbers from GameConfig. An anonymous subclass of EnemyConfig
  // changes only the farm's health, and the session starts with that farm.
  /** A GameConfig with a 50 HP farm gives a session whose farm has 50 HP. */
  @Test
  void farmHealthComesFromTheGivenConfig() {
    EnemyConfig weakFarm = new EnemyConfig() {
      @Override
      public int getFarmHealth() {
        return 50;
      }
    };
    GameConfig config = new GameConfig(new CropConfig(), weakFarm, new DefenseConfig());

    GameSession session = new GameSession(config, new Random(0));

    assertEquals(50, session.getFarmHealth());
  }

  // Rules §3: at the dawn after night 8, without the 10 000 coins, the rich man sells the urn.
  // The session starts by day 1 (no newSession), so eight nights end on the dawn of day 9.
  /** Eight nights with less than 10 000 coins: the urn is sold and the game is lost. */
  @Test
  void lastDawnWithoutTheUrnLoses() {
    GameSession session = new GameSession(new GameConfig(), new Random(0));

    playQuietNights(session, 8);

    assertEquals(Optional.of(GameResult.DEFEAT_URN_SOLD), session.getResult());
  }

  // At the last dawn the urn is bought with the money the player has: the exact price is enough.
  /** Eight nights with 10 000 coins: the urn is bought at the last dawn and the game is won. */
  @Test
  void lastDawnWithTheUrnPriceWins() {
    GameSession session = new GameSession(new GameConfig(), new Random(0));
    session.getWallet().add(URN_PRICE - STARTING_MONEY);

    playQuietNights(session, 8);

    assertEquals(Optional.of(GameResult.VICTORY), session.getResult());
    assertEquals(0, session.getWallet().getBalance());
  }

  // The dawn of day 8 is not the last one: the urn is not bought early, even with its price in the wallet.
  /** After seven nights the game goes on, and the money is untouched. */
  @Test
  void gameGoesOnAfterSevenNights() {
    GameSession session = new GameSession(new GameConfig(), new Random(0));
    session.getWallet().add(URN_PRICE - STARTING_MONEY);

    playQuietNights(session, 7);

    assertFalse(session.isOver());
    assertEquals(8, session.getCycle().getNumber());
    assertEquals(URN_PRICE, session.getWallet().getBalance());
  }

  // Rules: the destroyed farm comes before the urn. The farm falls during night 8, and the dawn of the same
  // frame keeps the defeat: the urn is not bought, the 10 000 coins stay in the wallet.
  /** A farm destroyed during night 8 loses the game, even with the price of the urn. */
  @Test
  void destroyedFarmAtTheLastDawnBeatsTheUrn() {
    GameSession session = new GameSession(new GameConfig(), new Random(0));
    session.getWallet().add(URN_PRICE - STARTING_MONEY);
    playQuietNights(session, 7);
    startQuietNight(session);
    session.getFarm().takeDamage(FARM_HEALTH);

    session.update(45f);

    assertEquals(Optional.of(GameResult.DEFEAT_FARM_DESTROYED), session.getResult());
    assertEquals(URN_PRICE, session.getWallet().getBalance());
  }

  // Once the game is over, update stops at its first line: the night timer no longer goes down.
  /** After the end of the game, an update changes neither the timer nor the farm's health. */
  @Test
  void frozenGameKeepsItsTimer() {
    GameSession session = newSession();
    session.getFarm().takeDamage(FARM_HEALTH);
    session.update(0.1f);
    int secondsLeft = session.getCycle().getSecondsLeft();
    int farmHealth = session.getFarmHealth();

    session.update(10f);

    assertEquals(secondsLeft, session.getCycle().getSecondsLeft());
    assertEquals(farmHealth, session.getFarmHealth());
  }

  // The bat of night 1 reaches the farm at 13.3 s and hits at 23.3 s: 30 s would cost 5 HP if the game went on.
  // Won by the urn, the game is frozen: the bat stays where it was and the farm keeps its full health.
  /** After a victory, the enemies no longer move nor hit the farm. */
  @Test
  void frozenGameKeepsTheFarmHealth() {
    GameSession session = newSession();
    session.getWallet().add(URN_PRICE - STARTING_MONEY);
    session.buyUrn();

    session.update(30f);

    assertEquals(FARM_HEALTH, session.getFarmHealth());
  }

  // The freeze still calls notifyChanges: the victory bought outside update is told by the next frame, once.
  /** A victory bought by the view is sent once, even though the game is frozen. */
  @Test
  void victoryIsSentOnceDespiteTheFreeze() {
    GameSession session = newSession();
    RecordingListener listener = new RecordingListener();
    session.addListener(listener);
    session.getWallet().add(URN_PRICE - STARTING_MONEY);
    session.buyUrn();

    session.update(0.1f);
    session.update(0.1f);

    assertEquals(1, Collections.frequency(listener.calls, "game over VICTORY"));
    assertTrue(listener.calls.contains("money 0"));
  }

  // Day 9 lasts after the last dawn: without the freeze, the next frame would try to buy the urn again,
  // with 0 coins, and turn the victory into DEFEAT_URN_SOLD.
  /** A victory at the last dawn stays a victory at the next frame. */
  @Test
  void victoryAtTheLastDawnStays() {
    GameSession session = new GameSession(new GameConfig(), new Random(0));
    session.getWallet().add(URN_PRICE - STARTING_MONEY);
    playQuietNights(session, 8);

    session.update(0.1f);

    assertEquals(Optional.of(GameResult.VICTORY), session.getResult());
    assertEquals(0, session.getWallet().getBalance());
  }

  // -------------------- ENEMIES: FARMER, REWARDS, REMOVAL --------------------
  // Day 10 (Yohan): what update does with the enemies once the defenses have shot, before the cycle goes on.
  // First old Garry hits, then each killed enemy pays its reward, then the dead and the fled leave the list.
  // These tests stay by day: no wave comes by day, so only the enemies added by hand are in the list.
  private final EnemyConfig enemyConfig = new EnemyConfig();
  private final int farmerDamage = enemyConfig.getFarmerDamage();

  // A fresh game on day 1, without launching the night (unlike newSession).
  /** Creates a session with the default configuration, on day 1. */
  private GameSession newDaySession() {
    return new GameSession(new GameConfig(), new Random(0));
  }

  // A bat on row 2, added to the game by hand.
  /** Adds a bat on row 2 to the game and returns it. */
  private Bat addBatOnRowTwo(GameSession session) {
    Bat bat = new Bat(2, session.getFarm(), enemyConfig);
    session.addEnemy(bat);
    return bat;
  }

  // Small frames until the bat is 3 cells or less from the farm: in the square of the farmer. A catapatate only aims
  // at the columns of the field, so from there on only the farmer hits it.
  /** Lets the game run until the bat is within the farmer's reach. */
  private void walkIntoTheFarmersReach(GameSession session, Bat bat) {
    while (bat.getCellsToFarm() > 3f) {
      session.update(0.05f);
    }
  }

  // Wears every defense to 0 %. Since day 10 the game starts with none, so it only makes sure that the bat crosses
  // the field untouched, and that the farmer's hits are the only ones counted. A copy: a destroyed defense leaves the list it is in.
  /** Destroys every defense of the game. */
  private void removeTheDefenses(GameSession session) {
    for (Defense defense : List.copyOf(session.getDefenseSlots().getDefenses())) {
      defense.wear(100);
    }
  }

  // The rewards.
  // Killed before the frame: the frame pays its reward, then removes it. The next frame pays nothing more.
  /** A killed enemy pays its reward once and leaves the list of the game. */
  @Test
  void aKilledEnemyPaysItsRewardOnceAndLeavesTheGame() {
    GameSession session = newDaySession();
    Bat bat = addBatOnRowTwo(session);
    int balanceBefore = session.getWallet().getBalance();
    bat.takeDamage(bat.getHealth());

    session.update(0.1f);

    assertEquals(balanceBefore + enemyConfig.getReward(EnemyType.BAT), session.getWallet().getBalance());
    assertFalse(session.getEnemies().contains(bat));

    session.update(0.1f);
    assertEquals(balanceBefore + enemyConfig.getReward(EnemyType.BAT), session.getWallet().getBalance());
  }

  // The reward is taken before the removal: killed by the farmer during the frame, it still pays in that frame.
  // In the other order, it would leave the list unpaid. 1 s of the farmer with exactly his damage of health left.
  /** An enemy killed by the farmer during a frame pays its reward in that same frame. */
  @Test
  void anEnemyKilledDuringTheFramePaysBeforeLeaving() {
    GameSession session = newDaySession();
    Bat bat = addBatOnRowTwo(session);
    walkIntoTheFarmersReach(session, bat);
    bat.takeDamage(bat.getHealth() - farmerDamage);
    int balanceBefore = session.getWallet().getBalance();

    session.update(1f);

    assertTrue(bat.isDead());
    assertEquals(balanceBefore + enemyConfig.getReward(EnemyType.BAT), session.getWallet().getBalance());
    assertFalse(session.getEnemies().contains(bat));
  }

  // The removal.
  // Rules §8: an enemy that flees brings nothing. It leaves the list all the same.
  /** A fled enemy leaves the list of the game without paying. */
  @Test
  void aFledEnemyLeavesTheGameWithoutPaying() {
    GameSession session = newDaySession();
    Bat bat = addBatOnRowTwo(session);
    int balanceBefore = session.getWallet().getBalance();
    bat.flee();

    session.update(0.1f);

    assertFalse(session.getEnemies().contains(bat));
    assertEquals(balanceBefore, session.getWallet().getBalance());
  }

  // isOnBoard is false for a mole underground (Mole.isOnBoard), but it is still part of the night: it will come out
  // to eat. The removal asks isDead and hasFled, never isOnBoard.
  /** A mole underground stays in the list of the game. */
  @Test
  void aMoleUndergroundStaysInTheGame() {
    GameSession session = newDaySession();
    Mole mole = new Mole(session.getBoard(), enemyConfig, new Random(0));
    session.addEnemy(mole);
    assertFalse(mole.isOnBoard());

    session.update(0.1f);

    assertTrue(session.getEnemies().contains(mole));
  }

  // The farmer.
  // The landmark of the day sheet: a bat on row 2, 3 cells or less from the farm, loses the farmer's damage each
  // second (4 HP since day 10).
  // Without any defense, which would leave the bat too weak to take two more hits.
  /** The farmer hits a bat close to the farm once per second, by his damage. */
  @Test
  void theFarmerHitsABatCloseToTheFarmEverySecond() {
    GameSession session = newDaySession();
    removeTheDefenses(session);
    assertTrue(session.getDefenseSlots().getDefenses().isEmpty());
    Bat bat = addBatOnRowTwo(session);
    walkIntoTheFarmersReach(session, bat);
    int healthInReach = bat.getHealth();

    session.update(1f);
    assertEquals(healthInReach - farmerDamage, bat.getHealth());

    session.update(1f);
    assertEquals(healthInReach - 2 * farmerDamage, bat.getHealth());
  }

  // -------------------- THE CAT --------------------
  // Day 11 (Yohan): the farmer's cat lives in the game. It only looks at the enemies (it hits nobody).
  /** A new game has its cat, which does not flee. */
  @Test
  void aNewGameHasACatThatDoesNotFlee() {
    GameSession session = newDaySession();

    assertNotNull(session.getCat());
    assertFalse(session.getCat().isFleeing());
  }

  // A bat added on row 1 walks to the farm by small frames: once it is 1 cell or less from the farm, it is on the cat.
  // A tough bat (1000 HP): with its 20 HP, a normal one would be killed by the farmer before it reaches the cat.
  // By day: no wave comes, so the bat is the only enemy.
  /** A bat on row 1 that reaches the cat makes it flee. */
  @Test
  void aBatReachingTheCatMakesItFlee() {
    GameSession session = newDaySession();
    Enemy bat = addToughBat(session, 1);

    while (bat.getCellsToFarm() > 1f) {
      assertFalse(session.getCat().isFleeing());
      session.update(0.05f);
    }

    assertTrue(session.getCat().isFleeing());
  }

  // -------------------- A WHOLE GAME --------------------
  // Milestone M2: a whole game with the real waves and the farmer. Nobody playing at all, the farm falls before the
  // end (as the simulation of the rules says: "without catapatate, the farm falls around night 5").
  // So a small player: at the start of each day, a catapatate on every free slot it can pay, with only the coins
  // of the start and the rewards of the enemies killed. Frames of 0.1 s, like a slow screen, until the game is over
  // (2000 s at most: a game lasts 8 x (60 + 45) = 840 s).
  // The nights come in turn and there is never a 9th one: WaveTable has 8 waves, and getWave(9) would throw.
  // Day 11: the enemies hit the farm as soon as they arrive (EnemyConfig.getFirstFarmHitDelay, 0 s). The game is
  // harder on purpose: this small player no longer keeps the farm standing for the 8 nights, the farm falls before
  // the last dawn. The night it falls is not checked here: it moves with every rebalance.
  /** A whole game with a small player: the farm falls before the end of the 8 nights, and never a 9th night. */
  @Test
  void aWholeGameWithASmallPlayerLosesTheFarmWithinTheEightNights() {
    GameSession session = newDaySession();
    int lastNight = 0;
    int lastDayShopped = 0;

    for (float time = 0f; time < 2000f && !session.isOver(); time += 0.1f) {
      if (!session.getCycle().isNight() && session.getCycle().getNumber() > lastDayShopped) {
        buyCatapatatesOnFreeSlots(session);
        lastDayShopped = session.getCycle().getNumber();
      }
      session.update(0.1f);
      if (session.getCycle().isNight()) {
        lastNight = Math.max(lastNight, session.getCycle().getNumber());
      }
    }

    assertEquals(Optional.of(GameResult.DEFEAT_FARM_DESTROYED), session.getResult());
    assertTrue(lastNight <= 8);
  }

  // The small player of the whole game: tries every slot, top then bottom, column 1 to 5. buyDefense refuses an
  // occupied slot or a purchase the wallet cannot pay, and then takes nothing.
  /** Buys a catapatate on every free slot, as long as the wallet can pay. */
  private void buyCatapatatesOnFreeSlots(GameSession session) {
    DefenseOffer catapatate = offerOf(session, DefenseType.CATAPATATE);
    for (SlotSide side : SlotSide.values()) {
      for (int column = 1; column <= 5; column++) {
        session.getShop().buyDefense(catapatate, session.getDefenseSlots().getSlot(side, column));
      }
    }
  }
}
