package com.cropa.view.audio;

// EnumMap: the level of each loop that plays, indexed by Track. Map: its interface. Iterator: removes a loop that has
// faded out while the map is walked.
import java.util.EnumMap;
import java.util.Iterator;
import java.util.Map;

// The sound of the whole game: which loop plays, the cross-fade from one to the other, and the "sound cut" button.
// Created once by CropaGame, so the music goes on and the sound stays cut across "Rejouer" and the language button;
// each GameScreen only tells it which loop to play (AudioDirector) and which cue to make (CuePlayer).
// It holds no libGDX: the Speaker plays the files, and the tests give a fake one.
/**
 * Chooses the music loop, fades from one loop to the next, plays the short sounds and cuts the sound on demand.
 * Nothing plays before the first click: a browser refuses any sound until the player has clicked on the page.
 */
public class Jukebox implements CuePlayer {

    //-------------------- CONSTANTS --------------------
    // The volume of the music under the sounds of the game, chosen on the listening page with the volumes of the cues.
    // The three loops share it: their own loudness already differs as Axel validated it (the night is the quietest,
    // the last night the loudest).
    static final float MUSIC_VOLUME = 0.45f;
    // How long a loop takes to fade in or out when the day turns to night and back.
    static final float FADE_SECONDS = 1.5f;

    //-------------------- FIELDS --------------------
    private final Speaker speaker;
    // The level of each loop that plays, from 0 to 1, before MUSIC_VOLUME and the cut. A loop leaves the map once it
    // has faded out to 0, and is stopped then.
    private final Map<Track, Float> levels = new EnumMap<>(Track.class);
    // The loop asked for, the one that fades in. null until the first playTrack.
    private Track current;
    // false until the first click: until then nothing plays, the loop asked for only waits.
    private boolean unlocked;
    private boolean muted;

    //-------------------- CONSTRUCTOR --------------------
    /**
     * Creates the jukebox, silent until {@link #unlock()}.
     *
     * @param speaker what plays the files
     */
    public Jukebox(Speaker speaker) {
        this.speaker = speaker;
    }

    //-------------------- MUSIC --------------------
    // Called by AudioDirector when a game starts (the day) and at each dawn and dusk.
    // The same loop again: nothing changes, it goes on where it is (the day after "Rejouer" by day).
    // A loop still fading out when it is asked again fades back in from where it is, without starting over.
    /**
     * Asks for a loop: it fades in over {@link #FADE_SECONDS} while the one before fades out.
     *
     * @param track the loop to play
     */
    public void playTrack(Track track) {
        if (track == current) {
            return;
        }
        current = track;
        if (unlocked) {
            startIfSilent(track);
        }
    }

    // Called by GameScreen on every click, before the click is handled: only the first one does something. The loop
    // asked for until then starts, and fades in like any other.
    /**
     * Allows the sound, after the player's first click.
     */
    public void unlock() {
        if (unlocked) {
            return;
        }
        unlocked = true;
        if (current != null) {
            startIfSilent(current);
        }
    }

    // Called on every frame by GameScreen, title screen and cinematics included, so a fade goes on behind them.
    // Each loop moves towards 1 if it is the one asked for, towards 0 otherwise, by delta / FADE_SECONDS: a straight
    // fade, from silence to full in FADE_SECONDS. Its volume is sent on every frame it plays, so the cut button acts
    // on the next frame. A loop that reaches 0 stops: started again later, it starts from its beginning.
    /**
     * Moves the fades forward.
     *
     * @param delta the seconds since the previous frame
     */
    public void update(float delta) {
        float step = Math.max(0f, delta) / FADE_SECONDS;
        Iterator<Map.Entry<Track, Float>> loops = levels.entrySet().iterator();
        while (loops.hasNext()) {
            Map.Entry<Track, Float> loop = loops.next();
            Track track = loop.getKey();
            float level = track == current
                ? Math.min(1f, loop.getValue() + step)
                : Math.max(0f, loop.getValue() - step);
            if (level == 0f && track != current) {
                speaker.stop(track);
                loops.remove();
                continue;
            }
            loop.setValue(level);
            speaker.setVolume(track, muted ? 0f : level * MUSIC_VOLUME);
        }
    }

    // A loop that does not play yet starts at 0 and joins the map; one that still plays (fading out) keeps its level.
    private void startIfSilent(Track track) {
        if (!levels.containsKey(track)) {
            speaker.start(track);
            levels.put(track, 0f);
        }
    }

    //-------------------- SHORT SOUNDS --------------------
    // Called by the shop panel, the screen and AudioDirector. Nothing before the first click: a browser would keep the
    // sounds and play them all at once after it. Nothing while the sound is cut either: a cut sound is not kept for
    // later.
    @Override
    public void play(Cue cue) {
        if (unlocked && !muted) {
            speaker.play(cue, cue.volume());
        }
    }

    //-------------------- CUT --------------------
    // Called by GameScreen when the button of the HUD is clicked. The music keeps playing at volume 0, so it goes on
    // where it would be when the sound comes back, like the radio of a car turned down.
    /**
     * Cuts the sound, or brings it back.
     */
    public void toggleMute() {
        muted = !muted;
    }

    /**
     * Tells whether the sound is cut.
     *
     * @return {@code true} while the sound is cut
     */
    public boolean isMuted() {
        return muted;
    }
}
