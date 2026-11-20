package com.cropa.view.audio;

// JUnit: the checks and the @Test and @BeforeEach markers. List: the calls expected, in order.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

// The jukebox with a RecordingSpeaker: what a browser would hear, written down. Time is injected like in the model:
// update(0.75f) is half of a 1.5 s fade (FADE_SECONDS), without waiting for it.
/** Tests for {@link Jukebox}. */
class JukeboxTest {

    //-------------------- CONSTANTS --------------------
    // A loop at full level plays at MUSIC_VOLUME, at half level at half of it. The volumes are floats: compared to the
    // millionth.
    private static final float FULL = Jukebox.MUSIC_VOLUME;
    private static final float HALF = Jukebox.MUSIC_VOLUME / 2;
    private static final float HALF_FADE = Jukebox.FADE_SECONDS / 2;
    private static final float PRECISION = 1e-6f;

    //-------------------- FIELDS --------------------
    private RecordingSpeaker speaker;
    private Jukebox jukebox;

    @BeforeEach
    void setUp() {
        speaker = new RecordingSpeaker();
        jukebox = new Jukebox(speaker);
    }

    //-------------------- BEFORE THE FIRST CLICK --------------------
    // A browser refuses any sound before a click: the jukebox does not even try. The sounds asked for meanwhile are
    // not kept for later, and the loop only waits.
    @Test
    void nothingPlaysBeforeTheFirstClick() {
        jukebox.playTrack(Track.DAY);
        jukebox.play(Cue.UI_CLICK);
        jukebox.update(1f);

        assertTrue(speaker.loops.isEmpty());
        assertTrue(speaker.cues.isEmpty());
    }

    // The first click starts the loop asked for, at 0, and it fades in like any other: half after half of the fade.
    @Test
    void theFirstClickStartsTheLoopAskedFor() {
        jukebox.playTrack(Track.DAY);
        jukebox.unlock();
        jukebox.update(HALF_FADE);

        assertEquals(List.of("start DAY"), speaker.loops);
        assertEquals(HALF, speaker.volumes.get(Track.DAY), PRECISION);
    }

    // Only the first click unlocks: the next ones do not start the loop a second time.
    @Test
    void theNextClicksStartNothingMore() {
        jukebox.playTrack(Track.DAY);
        jukebox.unlock();
        jukebox.unlock();

        assertEquals(List.of("start DAY"), speaker.loops);
    }

    //-------------------- THE FADES --------------------
    // The dusk: the night starts at 0 while the day goes down. Halfway, both are at half; at the end, the day has
    // stopped (it will start from its beginning at the next dawn) and the night is at full volume.
    @Test
    void theNightFadesInWhileTheDayFadesOut() {
        jukebox.unlock();
        jukebox.playTrack(Track.DAY);
        jukebox.update(Jukebox.FADE_SECONDS);
        jukebox.playTrack(Track.NIGHT);

        jukebox.update(HALF_FADE);
        assertEquals(HALF, speaker.volumes.get(Track.DAY), PRECISION);
        assertEquals(HALF, speaker.volumes.get(Track.NIGHT), PRECISION);

        jukebox.update(HALF_FADE);
        assertEquals(List.of("start DAY", "start NIGHT", "stop DAY"), speaker.loops);
        assertEquals(FULL, speaker.volumes.get(Track.NIGHT), PRECISION);
    }

    // The same loop again changes nothing: after "Rejouer" by day, the day goes on where it is.
    @Test
    void theSameLoopAgainGoesOn() {
        jukebox.unlock();
        jukebox.playTrack(Track.DAY);
        jukebox.update(Jukebox.FADE_SECONDS);
        jukebox.playTrack(Track.DAY);
        jukebox.update(Jukebox.FADE_SECONDS);

        assertEquals(List.of("start DAY"), speaker.loops);
        assertEquals(FULL, speaker.volumes.get(Track.DAY), PRECISION);
    }

    // "Rejouer" during the fade: the day, still at half, comes back up from there without starting over, and the night
    // goes down instead.
    @Test
    void aLoopAskedAgainWhileFadingOutComesBackWithoutStartingOver() {
        jukebox.unlock();
        jukebox.playTrack(Track.DAY);
        jukebox.update(Jukebox.FADE_SECONDS);
        jukebox.playTrack(Track.NIGHT);
        jukebox.update(HALF_FADE);
        jukebox.playTrack(Track.DAY);

        jukebox.update(HALF_FADE);

        assertEquals(List.of("start DAY", "start NIGHT", "stop NIGHT"), speaker.loops);
        assertEquals(FULL, speaker.volumes.get(Track.DAY), PRECISION);
    }

    //-------------------- SHORT SOUNDS --------------------
    // Each cue plays at the volume chosen for it on the listening page.
    @Test
    void aCuePlaysAtItsOwnVolume() {
        jukebox.unlock();
        jukebox.play(Cue.UI_CLICK);

        assertEquals(List.of(Cue.UI_CLICK), speaker.cues);
        assertEquals(Cue.UI_CLICK.volume(), speaker.cueVolumes.get(0), PRECISION);
    }

    //-------------------- THE CUT --------------------
    // Cut: the music goes on at volume 0 and no cue plays. Back: the music comes back at its level on the next frame.
    @Test
    void theCutSilencesTheMusicAndTheCues() {
        jukebox.unlock();
        jukebox.playTrack(Track.DAY);
        jukebox.update(Jukebox.FADE_SECONDS);

        jukebox.toggleMute();
        jukebox.update(0.1f);
        jukebox.play(Cue.UI_CLICK);
        assertTrue(jukebox.isMuted());
        assertEquals(0f, speaker.volumes.get(Track.DAY), PRECISION);
        assertTrue(speaker.cues.isEmpty());

        jukebox.toggleMute();
        jukebox.update(0.1f);
        assertFalse(jukebox.isMuted());
        assertEquals(FULL, speaker.volumes.get(Track.DAY), PRECISION);
        assertEquals(List.of("start DAY"), speaker.loops);
    }
}
