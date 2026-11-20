package com.cropa.view.audio;

// The model the director listens to and looks at: the session and its listener interface, the end of a game, the
// defenses, the enemies with their kinds, and the neighbour. It only reads them: it never changes the game.
import com.cropa.model.defense.Defense;
import com.cropa.model.enemy.Enemy;
import com.cropa.model.enemy.EnemyType;
import com.cropa.model.game.GameListener;
import com.cropa.model.game.GameResult;
import com.cropa.model.game.GameSession;
import com.cropa.model.game.Neighbour;
// IdentityHashMap: what each defense and each enemy did at the frame before, keyed by the object itself (two enemies
// of the same kind on the same row are still two enemies). Map: its interface. Random: the neighbour's syllables.
import java.util.IdentityHashMap;
import java.util.Map;
import java.util.Random;

// The sounds of one game: GameScreen creates it with the session, subscribes it, and calls update after each
// session.update. Two ways to hear the game, like the HUD and the renderers:
// - GameListener for what the session already tells: the dawn, the dusk and the end;
// - update, on every frame, for what only the model's state shows: a defense that starts its attack pose, a bramble
//   that loses durability, an enemy that hits the farm, comes out to eat or leaves the list dead.
// The model holds no sound and is not changed for them: the director compares each frame with the one before.
/**
 * Chooses the music of the phase and makes the sounds of the game: the stings of the cycle and of the end, the attacks
 * and the defenses destroyed, the attacks and the deaths of the enemies, and the neighbour's babble.
 */
public class AudioDirector implements GameListener {

    //-------------------- CONSTANTS --------------------
    // The neighbour writes 20 letters per second (GameConfig): one syllable every 0.1 s, every second letter, about the
    // length of a syllable (0.08 to 0.12 s), so they follow one another without piling up.
    static final float SYLLABLE_SECONDS = 0.1f;
    // The pose a witch or a bat shows for 0.3 s after each hit on the farm (LaneEnemy.spriteKey).
    private static final String ATTACK_POSE = "_attack";

    //-------------------- FIELDS --------------------
    private final GameSession session;
    // The number of the last night, read in GameConfig by GameScreen: its own music.
    private final int lastNight;
    private final Jukebox jukebox;
    private final Random random;
    // The frame before. A defense or an enemy missing from these maps is new: what it shows now is not a change.
    private final Map<Defense, Boolean> defenseAttacking = new IdentityHashMap<>();
    private final Map<Defense, Integer> defenseDurability = new IdentityHashMap<>();
    private final Map<Enemy, Boolean> enemyAttacking = new IdentityHashMap<>();
    private final Map<Enemy, Boolean> moleEating = new IdentityHashMap<>();
    private boolean farmerAttacking;
    // Seconds before the next syllable while the neighbour writes; 0 when she starts a bubble, so the first letter
    // already speaks. The last syllable, never said twice in a row.
    private float syllableLeft;
    private Cue lastSyllable;

    //-------------------- CONSTRUCTOR --------------------
    // The day music is asked for at once: the title screen and the cinematics already play it (after the first click,
    // see Jukebox.unlock); after "Rejouer" at night, the night fades out into it.
    /**
     * Creates the director of one game, and asks for the music of the day.
     *
     * @param session the game to listen to
     * @param lastNight the number of the last night, which has its own music
     * @param jukebox what plays the music and the sounds
     * @param random draws the neighbour's syllables
     */
    public AudioDirector(GameSession session, int lastNight, Jukebox jukebox, Random random) {
        this.session = session;
        this.lastNight = lastNight;
        this.jukebox = jukebox;
        this.random = random;
        jukebox.playTrack(Track.DAY);
    }

    //-------------------- CYCLE --------------------
    // Day 1 is the start of the game, not a dawn: no rooster. The day after the last night ends the game at its dawn
    // (GameSession: the urn is bought or sold), and the session tells the end in the same frame: the sting of the end
    // plays alone, without the rooster under it.
    @Override
    public void onDayStarted(int day) {
        jukebox.playTrack(Track.DAY);
        if (day > 1 && !session.isOver()) {
            jukebox.play(Cue.STING_DAWN);
        }
    }

    @Override
    public void onNightStarted(int night) {
        jukebox.playTrack(night == lastNight ? Track.FINAL_NIGHT : Track.NIGHT);
        jukebox.play(Cue.STING_DUSK);
    }

    // The music does not change at the end (Axel's choice): only a sting on top of it.
    @Override
    public void onGameOver(GameResult result) {
        jukebox.play(result == GameResult.VICTORY ? Cue.STING_VICTORY : Cue.STING_DEFEAT);
    }

    // The rest of the listener is shown by the HUD and needs no sound: no ticking of the timer (Axel's choice), and the
    // farm's health only drops when a witch or a bat hits it, which update hears.
    @Override
    public void onMoneyChanged(int balance) {
    }

    @Override
    public void onFarmHealthChanged(int health) {
    }

    @Override
    public void onTimerChanged(int secondsLeft) {
    }

    //-------------------- FRAME --------------------
    // Called by GameScreen after each session.update, with the same delta (0 while the tutorial freezes the day).
    /**
     * Compares the game with the frame before and makes the sounds of what changed.
     *
     * @param delta the seconds the game moved forward
     */
    public void update(float delta) {
        listenToDefenses();
        listenToFarmer();
        listenToEnemies();
        listenToNeighbour(delta);
    }

    // The catapatate and the scarecrow show their attack pose for 0.3 s after each attack, and attack at most once per
    // second: a pose that starts is an attack. The bramble never shows a pose; it only loses durability when it stings
    // (Bramble.onCrossedBy), so a lower durability is a sting. An upgrade raises it again: that is no sting.
    // A defense of the frame before that is gone left its place: destroyed if worn down to 0 % (the last sting of a
    // bramble too), removed for nothing by "Retirer" otherwise, which makes no sound here.
    private void listenToDefenses() {
        Map<Defense, Boolean> attacking = new IdentityHashMap<>();
        Map<Defense, Integer> durability = new IdentityHashMap<>();
        for (Defense defense : session.getDefenseSlots().getDefenses()) {
            boolean attacks = defense.isAttacking();
            if (attacks && Boolean.FALSE.equals(defenseAttacking.get(defense))) {
                jukebox.play(attackOf(defense));
            }
            Integer before = defenseDurability.get(defense);
            if (before != null && defense.getDurability() < before && stingsWhenWorn(defense)) {
                jukebox.play(Cue.BRAMBLE_STING);
            }
            attacking.put(defense, attacks);
            durability.put(defense, defense.getDurability());
        }
        for (Defense gone : defenseAttacking.keySet()) {
            if (!attacking.containsKey(gone) && gone.isDestroyed()) {
                if (stingsWhenWorn(gone)) {
                    jukebox.play(Cue.BRAMBLE_STING);
                }
                jukebox.play(Cue.DEFENSE_DESTROYED);
            }
        }
        defenseAttacking.clear();
        defenseAttacking.putAll(attacking);
        defenseDurability.clear();
        defenseDurability.putAll(durability);
    }

    // A switch with no default: a fourth defense does not compile until its sound is chosen. The bramble never shows
    // a pose; its sound comes from its durability (listenToDefenses).
    private static Cue attackOf(Defense defense) {
        return switch (defense.getType()) {
            case CATAPATATE -> Cue.CATAPATATE_FIRE;
            case SCARECROW -> Cue.SCARECROW_PUNCH;
            case BRAMBLE -> Cue.BRAMBLE_STING;
        };
    }

    // The scarecrow also wears when it punches, and the catapatate when it is hit: only the bramble's wear is a sting.
    private static boolean stingsWhenWorn(Defense defense) {
        return switch (defense.getType()) {
            case BRAMBLE -> true;
            case CATAPATATE, SCARECROW -> false;
        };
    }

    // Old Garry hits once per second and shows his pose for 0.3 s: a pose that starts is a hit of the pitchfork.
    private void listenToFarmer() {
        boolean attacks = session.getFarmer().isAttacking();
        if (attacks && !farmerAttacking) {
            jukebox.play(Cue.GARRY_FORK);
        }
        farmerAttacking = attacks;
    }

    // A witch or a bat hits the farm every 5 s and shows its pose for 0.3 s after each hit: a pose that starts is a
    // hit. A mole that becomes targetable has come out of the ground to eat. An enemy of the frame before that left the
    // list is dead or fled (GameSession.update removes both): only the dead make a sound, no sound for an arrival
    // either (Axel's choice).
    private void listenToEnemies() {
        Map<Enemy, Boolean> attacking = new IdentityHashMap<>();
        Map<Enemy, Boolean> eating = new IdentityHashMap<>();
        for (Enemy enemy : session.getEnemies()) {
            if (enemy.getType() == EnemyType.MOLE) {
                boolean eats = enemy.isTargetable();
                if (eats && Boolean.FALSE.equals(moleEating.get(enemy))) {
                    jukebox.play(Cue.MOLE_MUNCH);
                }
                eating.put(enemy, eats);
            } else {
                boolean attacks = enemy.spriteKey().endsWith(ATTACK_POSE);
                if (attacks && !Boolean.TRUE.equals(enemyAttacking.get(enemy))) {
                    jukebox.play(enemy.getType() == EnemyType.WITCH ? Cue.WITCH_ATTACK : Cue.BAT_ATTACK);
                }
                attacking.put(enemy, attacks);
            }
        }
        playDeaths(enemyAttacking, attacking);
        playDeaths(moleEating, eating);
        enemyAttacking.clear();
        enemyAttacking.putAll(attacking);
        moleEating.clear();
        moleEating.putAll(eating);
    }

    // The enemies of the frame before that are no longer in the list of this frame, and are dead.
    private void playDeaths(Map<Enemy, Boolean> before, Map<Enemy, Boolean> now) {
        for (Enemy enemy : before.keySet()) {
            if (!now.containsKey(enemy) && enemy.isDead()) {
                jukebox.play(deathOf(enemy.getType()));
            }
        }
    }

    // A switch with no default, like attackOf: a fourth enemy does not compile until its death has a sound.
    private static Cue deathOf(EnemyType type) {
        return switch (type) {
            case MOLE -> Cue.MOLE_DEATH;
            case BAT -> Cue.BAT_DEATH;
            case WITCH -> Cue.WITCH_DEATH;
        };
    }

    // While the neighbour writes a bubble, one syllable every SYLLABLE_SECONDS, drawn among the eight, never the same
    // twice in a row; silence once the bubble is written, while she waits for "Passer à la suite".
    private void listenToNeighbour(float delta) {
        Neighbour neighbour = session.getNeighbour();
        if (!neighbour.isTalking() || neighbour.isBubbleWritten()) {
            syllableLeft = 0f;
            return;
        }
        syllableLeft -= delta;
        if (syllableLeft > 0f) {
            return;
        }
        syllableLeft += SYLLABLE_SECONDS;
        jukebox.play(nextSyllable());
    }

    // Draws among the seven syllables that are not the last one: the index skips it.
    private Cue nextSyllable() {
        Cue[] voices = Cue.voices();
        int index = random.nextInt(lastSyllable == null ? voices.length : voices.length - 1);
        if (lastSyllable != null && index >= lastSyllable.ordinal() - voices[0].ordinal()) {
            index++;
        }
        lastSyllable = voices[index];
        return lastSyllable;
    }
}
