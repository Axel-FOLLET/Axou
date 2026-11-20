package com.cropa.view.audio;

// JUnit: the checks and the @Test and @BeforeEach markers. Collections.frequency counts a sound in the list.
// The model: a real session with the numbers of the rules, the enemies and the bramble the tests add by hand, and the
// farm a hand-made enemy hits (the session's own farm is package-private: the sound does not need it).
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cropa.model.defense.Bramble;
import com.cropa.model.defense.DefenseOffer;
import com.cropa.model.defense.DefenseType;
import com.cropa.model.enemy.Bat;
import com.cropa.model.enemy.EnemyConfig;
import com.cropa.model.enemy.EnemyType;
import com.cropa.model.enemy.Witch;
import com.cropa.model.game.GameConfig;
import com.cropa.model.game.GameSession;
import com.cropa.model.game.Neighbour;
import com.cropa.model.world.Cell;
import com.cropa.model.world.Farm;
import java.util.Collections;
import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

// The director on a real game, played with the injected time of the model tests, and a jukebox already unlocked
// (the first click), so every sound asked for reaches the RecordingSpeaker. Each frame is played like GameScreen
// plays it: session.update, then director.update with the same delta.
/** Tests for {@link AudioDirector}. */
class AudioDirectorTest {

    //-------------------- CONSTANTS --------------------
    private static final GameConfig CONFIG = new GameConfig();
    private static final float FRAME = 1f / 60f;

    //-------------------- FIELDS --------------------
    private GameSession session;
    private RecordingSpeaker speaker;
    private AudioDirector director;

    @BeforeEach
    void setUp() {
        session = new GameSession(CONFIG, new Random(0));
        speaker = new RecordingSpeaker();
        Jukebox jukebox = new Jukebox(speaker);
        jukebox.unlock();
        director = new AudioDirector(session, CONFIG.getNightCount(), jukebox, new Random(0));
        session.addListener(director);
    }

    //-------------------- HELPERS --------------------
    // One frame of GameScreen.render.
    private void frame(float delta) {
        session.update(delta);
        director.update(delta);
    }

    // "Lancer la nuit", a first frame that tells the dusk (the session tells a change at the end of a frame), then the
    // rest of the night in one frame up to the dawn: the wave only appears at the end of that frame and flees at once
    // (GameSessionTest.playQuietNights), so the farm is never hit.
    private void playQuietNight() {
        session.getCycle().launchNight(session);
        frame(0.1f);
        frame(CONFIG.getNightDuration());
    }

    private int count(Cue cue) {
        return Collections.frequency(speaker.cues, cue);
    }

    // A bat the farmer cannot kill in a night (1000 HP), like the tough bat of GameSessionTest: speed, damage and pace
    // stay the real ones. It hits a farm of its own.
    private Bat addToughBat() {
        EnemyConfig tough = new EnemyConfig() {
            @Override
            public int getHealth(EnemyType type) {
                return 1000;
            }
        };
        Bat bat = new Bat(2, new Farm(new EnemyConfig().getFarmHealth()), tough);
        session.addEnemy(bat);
        return bat;
    }

    // A bramble bought on the given cell of day 1, as the shop window buys it.
    private Bramble buyBramble(Cell cell) {
        DefenseOffer offer = session.getShop().getDefenseOffers().stream()
            .filter(o -> o.getType() == DefenseType.BRAMBLE)
            .findFirst()
            .orElseThrow();
        assertTrue(session.getShop().buyDefense(offer, cell));
        return assertInstanceOf(Bramble.class, session.getDefenseSlots().getDefenseOn(cell).orElseThrow());
    }

    //-------------------- THE MUSIC AND THE CYCLE --------------------
    // The director asks for the day as soon as it is created: the title screen already plays it. Day 1 is the start
    // of the game, not a dawn: no rooster.
    @Test
    void theGameStartsOnTheDayWithoutARooster() {
        frame(0.1f);

        assertEquals(List.of("start DAY"), speaker.loops);
        assertEquals(0, count(Cue.STING_DAWN));
    }

    // A night: the dusk and its loop, then the dawn of day 2 and the day loop back (it was fading out: not restarted).
    @Test
    void aNightFallsWithItsStingAndEndsWithTheRooster() {
        playQuietNight();

        assertEquals(List.of(Cue.STING_DUSK, Cue.STING_DAWN), speaker.cues);
        assertEquals(List.of("start DAY", "start NIGHT"), speaker.loops);
    }

    // The last night (8) has its own loop; the seven before it share the night loop.
    @Test
    void theLastNightHasItsOwnMusic() {
        for (int night = 1; night < CONFIG.getNightCount(); night++) {
            playQuietNight();
        }
        assertFalse(speaker.loops.contains("start FINAL_NIGHT"));

        session.getCycle().launchNight(session);
        frame(0.1f);

        assertEquals(List.of("start DAY", "start NIGHT", "start FINAL_NIGHT"), speaker.loops);
    }

    // Eight nights without the 10 000 coins: the urn is sold at the last dawn. Eight dusks, seven roosters (days 2 to
    // 8): the last dawn ends the game and only plays the sting of the defeat.
    @Test
    void theUrnSoldEndsOnTheDefeatWithoutARooster() {
        for (int night = 1; night <= CONFIG.getNightCount(); night++) {
            playQuietNight();
        }

        assertTrue(session.isOver());
        assertEquals(CONFIG.getNightCount(), count(Cue.STING_DUSK));
        assertEquals(CONFIG.getNightCount() - 1, count(Cue.STING_DAWN));
        assertEquals(1, count(Cue.STING_DEFEAT));
        assertEquals(Cue.STING_DEFEAT, speaker.cues.get(speaker.cues.size() - 1));
    }

    // The urn bought: the next frame tells the victory, once, and the music does not change.
    @Test
    void theUrnBoughtPlaysTheVictoryOnce() {
        session.getWallet().add(CONFIG.getUrnPrice() - CONFIG.getStartingMoney());
        session.buyUrn();

        frame(0.1f);
        frame(0.1f);

        assertEquals(List.of(Cue.STING_VICTORY), speaker.cues);
        assertEquals(List.of("start DAY"), speaker.loops);
    }

    //-------------------- THE FIGHTS --------------------
    // The tough bat walks to the farm by day (no wave by day): old Garry hits it once per second once it is in his
    // reach, and it hits the farm as soon as it arrives, then every 5 s: 4 hits in 45 s (GameSessionTest). The test
    // counts the poses that start, frame by frame: each one is one sound, no more, no less.
    @Test
    void eachHitOfGarryAndOfTheBatMakesOneSound() {
        Bat bat = addToughBat();
        int forkHits = 0;
        int batHits = 0;
        boolean garryBefore = false;
        boolean batBefore = false;
        for (int step = 0; step < 45 * 60; step++) {
            frame(FRAME);
            boolean garryNow = session.getFarmer().isAttacking();
            boolean batNow = bat.spriteKey().endsWith("_attack");
            forkHits += garryNow && !garryBefore ? 1 : 0;
            batHits += batNow && !batBefore ? 1 : 0;
            garryBefore = garryNow;
            batBefore = batNow;
        }

        assertEquals(4, batHits);
        assertEquals(batHits, count(Cue.BAT_ATTACK));
        assertTrue(forkHits > 0);
        assertEquals(forkHits, count(Cue.GARRY_FORK));
    }

    // A dead bat leaves the game with its death; a fled one leaves it in silence.
    @Test
    void onlyTheDeadSoundTheirDeath() {
        Bat dead = addToughBat();
        Bat fled = addToughBat();
        frame(FRAME);
        dead.takeDamage(dead.getHealth());
        fled.flee();

        frame(FRAME);
        frame(FRAME);

        assertFalse(session.getEnemies().contains(dead));
        assertFalse(session.getEnemies().contains(fled));
        assertEquals(List.of(Cue.BAT_DEATH), speaker.cues);
    }

    // The scene of GameSessionTest.brambleOfDay1StingsFromNight2: a bramble of day 1, active from night 2, stings a
    // witch once (100 % to 80 %): one sting heard.
    @Test
    void aBrambleThatStingsIsHeard() {
        Cell cell = session.getBoard().getCell(3, 4);
        Bramble bramble = buyBramble(cell);
        playQuietNight();
        session.getCycle().launchNight(session);
        Witch witch = new Witch(3, new Farm(new EnemyConfig().getFarmHealth()), session.getBoard(), new EnemyConfig(),
            (row, column, percent) -> {
            }, new Random(0));
        session.addEnemy(witch);
        while (!witch.isDead() && witch.getCellsToFarm() > 4) {
            frame(FRAME);
        }

        assertEquals(80, bramble.getDurability());
        assertEquals(1, count(Cue.BRAMBLE_STING));
    }

    // Worn down to 0 %, the bramble leaves its cell: its last sting, then the sound of a defense destroyed.
    @Test
    void aWornOutDefenseIsHeardFalling() {
        Bramble bramble = buyBramble(session.getBoard().getCell(3, 4));
        frame(FRAME);
        bramble.wear(100);

        frame(FRAME);

        assertTrue(bramble.isDestroyed());
        assertEquals(List.of(Cue.BRAMBLE_STING, Cue.DEFENSE_DESTROYED), speaker.cues);
    }

    //-------------------- THE NEIGHBOUR --------------------
    // On her day she walks to Garry, then writes her first bubble at 20 letters per second: about one syllable every
    // second letter, never the same twice in a row, and silence once the bubble is written, while she waits.
    @Test
    void theNeighbourBabblesWhileSheWrites() {
        Neighbour neighbour = session.getNeighbour();
        for (int night = 1; night < neighbour.getDay(); night++) {
            playQuietNight();
        }
        speaker.cues.clear();
        while (!neighbour.isTalking()) {
            frame(FRAME);
        }
        int frames = 0;
        while (!neighbour.isBubbleWritten()) {
            frame(FRAME);
            frames++;
        }
        List<Cue> babble = List.copyOf(speaker.cues);
        for (int step = 0; step < 60; step++) {
            frame(FRAME);
        }

        float seconds = frames * FRAME;
        assertEquals(seconds / AudioDirector.SYLLABLE_SECONDS, babble.size(), 2f);
        assertTrue(List.of(Cue.voices()).containsAll(babble));
        for (int i = 1; i < babble.size(); i++) {
            assertNotEquals(babble.get(i - 1), babble.get(i));
        }
        assertEquals(babble, speaker.cues);
    }
}
