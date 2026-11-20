package com.cropa.view.audio;

// The three music loops of the game. Each one loops without a gap: tools/sounds/music.py folds its end onto its start.
// The day is Anto's track (made with Suno); the night and the last night are versions of it (docs/sounds.md).
/**
 * A music loop of the game.
 */
public enum Track {
    /** The day, and the title screen and the cinematics before the first day. */
    DAY("music_day"),
    /** The nights 1 to 7: the day's track, slower and out of tune, like a haunted music box. */
    NIGHT("music_night"),
    /** The last night: the same night with a boss-fight orchestra on top. */
    FINAL_NIGHT("music_final_night");

    //-------------------- FIELDS --------------------
    private final String name;

    //-------------------- CONSTRUCTOR --------------------
    Track(String name) {
        this.name = name;
    }

    //-------------------- QUERIES --------------------
    /**
     * Returns the file of this loop, from the assets folder.
     *
     * @return for example {@code "sounds/music_day.mp3"}
     */
    public String file() {
        return "sounds/" + name + ".mp3";
    }
}
