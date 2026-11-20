package com.cropa.view.audio;

// What the shop panel and the screen need to make a sound: one method, so a test gives a lambda (cue -> {}) or a list
// that writes the cues down. Jukebox writes it: it knows the volume of each cue and whether the sound is cut.
/**
 * Plays a short sound of the game.
 */
@FunctionalInterface
public interface CuePlayer {

    /**
     * Plays a short sound once, at its own volume, unless the sound is cut.
     *
     * @param cue the sound
     */
    void play(Cue cue);
}
