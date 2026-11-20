package com.cropa.view.gdx;

// libGDX: Gdx (audio and files), Music (a long file read while it plays) and Sound (a short file kept in memory, which
// can play several times at once), Disposable (what holds memory the garbage collector does not free).
// The view: the cues and the loops, and the Speaker interface this class writes.
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.audio.Music;
import com.badlogic.gdx.audio.Sound;
import com.badlogic.gdx.utils.Disposable;
import com.cropa.view.audio.Cue;
import com.cropa.view.audio.Speaker;
import com.cropa.view.audio.Track;
// EnumMap: one file per cue and per loop, indexed by the enum. Map: its interface.
import java.util.EnumMap;
import java.util.Map;

// The only class that knows libGDX's audio, like GdxCanvas for the drawing. Created once by CropaGame, so the files
// are loaded once, not at each "Rejouer". On the web, gdx-teavm plays them with howler.js (Web Audio): a loop loops on
// the exact sample, without a gap, and a sound asked for before the first click waits for it.
/**
 * Plays the files of {@code assets/sounds} with libGDX.
 */
public class GdxSpeaker implements Speaker, Disposable {

    //-------------------- FIELDS --------------------
    private final Map<Cue, Sound> sounds = new EnumMap<>(Cue.class);
    private final Map<Track, Music> loops = new EnumMap<>(Track.class);

    //-------------------- CONSTRUCTOR --------------------
    // Every file at once: 33 files, 3.8 MB of mp3 (docs/sounds.md). The web version has already downloaded them with
    // the other assets before the game starts (assets.txt).
    /**
     * Loads every sound and every loop of the game.
     */
    public GdxSpeaker() {
        for (Cue cue : Cue.values()) {
            sounds.put(cue, Gdx.audio.newSound(Gdx.files.internal(cue.file())));
        }
        for (Track track : Track.values()) {
            Music music = Gdx.audio.newMusic(Gdx.files.internal(track.file()));
            music.setLooping(true);
            loops.put(track, music);
        }
    }

    //-------------------- SPEAKER --------------------
    @Override
    public void play(Cue cue, float volume) {
        sounds.get(cue).play(volume);
    }

    // setVolume before play: the loop starts silent, Jukebox raises it frame by frame.
    @Override
    public void start(Track track) {
        Music music = loops.get(track);
        music.setVolume(0f);
        music.play();
    }

    // stop also puts the loop back at its beginning (libGDX and howler.js both do).
    @Override
    public void stop(Track track) {
        loops.get(track).stop();
    }

    @Override
    public void setVolume(Track track, float volume) {
        loops.get(track).setVolume(volume);
    }

    //-------------------- LIFECYCLE --------------------
    // Called by CropaGame.dispose, when the window closes.
    @Override
    public void dispose() {
        sounds.values().forEach(Sound::dispose);
        loops.values().forEach(Music::dispose);
    }
}
