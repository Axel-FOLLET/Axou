package com.cropa.view.audio;

// What the game asks of the sound card, and nothing more. GdxSpeaker writes it with libGDX (Gdx.audio); the tests use
// a fake that only writes down the calls, so Jukebox and AudioDirector are tested without libGDX, like the renderers
// with their Canvas.
/**
 * Plays the files of the game: the short sounds once, the music loops with their volume.
 */
public interface Speaker {

    /**
     * Plays a short sound once, over whatever plays already.
     *
     * @param cue the sound
     * @param volume between 0 and 1
     */
    void play(Cue cue, float volume);

    /**
     * Starts a loop from its beginning, at volume 0; it loops until {@link #stop(Track)}.
     *
     * @param track the loop
     */
    void start(Track track);

    /**
     * Stops a loop; the next {@link #start(Track)} starts it from its beginning again.
     *
     * @param track the loop
     */
    void stop(Track track);

    /**
     * Changes the volume of a loop that plays.
     *
     * @param track the loop
     * @param volume between 0 and 1
     */
    void setVolume(Track track, float volume);
}
