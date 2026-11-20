package com.cropa.view.audio;

// No import: plain Java, like the rest of the view. The files themselves are read by GdxSpeaker, the only class that
// knows libGDX's audio.

// Every short sound of the game, with its file and its volume. An enum, not a String: a typo like "UI_CLIK" does not
// compile, and GdxSpeaker loads each one once by walking values().
// The files are rendered by tools/sounds/render_sounds.py into assets/sounds (docs/sounds.md). The volumes are the
// ones of the listening page Axel validated on 20/11, between 0 (silent) and 1 (the file as it is).
/**
 * A short sound of the game: a sting of the cycle, an attack, a death, a sound of the shop or a syllable of the
 * neighbour.
 */
public enum Cue {
    //-------------------- STINGS --------------------
    // The rooster at dawn, the gong at dusk, and the two ends of a game. The music goes on under them.
    /** The rooster, at each dawn from day 2. */
    STING_DAWN("sting_dawn", 0.6f),
    /** The gong, when the night starts. */
    STING_DUSK("sting_dusk", 0.6f),
    /** The end of a won game. */
    STING_VICTORY("sting_victory", 0.7f),
    /** The end of a lost game, whatever the defeat. */
    STING_DEFEAT("sting_defeat", 0.7f),

    //-------------------- DEFENSES --------------------
    /** A potato thrown by a catapatate. */
    CATAPATATE_FIRE("catapatate_fire", 0.35f),
    /** A punch of a scarecrow. */
    SCARECROW_PUNCH("scarecrow_punch", 0.4f),
    /** A bramble that stings the enemy crossing it. */
    BRAMBLE_STING("bramble_sting", 0.35f),
    /** A defense worn down to 0 %, which leaves its place. */
    DEFENSE_DESTROYED("defense_destroyed", 0.55f),
    /** A hit of Old Garry's pitchfork, sharp like a sword. */
    GARRY_FORK("garry_fork", 0.35f),

    //-------------------- ENEMIES --------------------
    // No sound when an enemy arrives (Axel's choice): only its attacks and its death.
    /** A mole that comes out of the ground to eat a crop. */
    MOLE_MUNCH("mole_munch", 0.45f),
    /** A mole killed. */
    MOLE_DEATH("mole_death", 0.45f),
    /** A witch kicking the farm. */
    WITCH_ATTACK("witch_attack", 0.4f),
    /** A witch killed. */
    WITCH_DEATH("witch_death", 0.45f),
    /** A bat hitting the farm. */
    BAT_ATTACK("bat_attack", 0.4f),
    /** A bat killed. */
    BAT_DEATH("bat_death", 0.45f),

    //-------------------- FARM AND SHOP --------------------
    /** A seed bought and planted. */
    PLANT("plant", 0.45f),
    /** A crop sold. */
    HARVEST("harvest", 0.5f),
    /** A defense bought and placed. */
    DEFENSE_PLACE("defense_place", 0.5f),
    /** A defense upgraded. */
    DEFENSE_UPGRADE("defense_upgrade", 0.5f),
    /** A button, a line picked, a scene passed. */
    UI_CLICK("ui_click", 0.3f),
    /** A list or a panel of the shop that opens. */
    UI_SHOP_OPEN("ui_shop_open", 0.35f),
    /** A purchase or a placement the shop refuses (not enough money, a taken place). */
    UI_REFUSED("ui_refused", 0.35f),

    //-------------------- NEIGHBOUR --------------------
    // Eight short syllables, played one after another while she writes, like the babble of a cartoon character.
    /** A syllable of the neighbour. */
    NEIGHBOUR_VOICE_1("neighbour_voice_1", 0.4f),
    /** A syllable of the neighbour. */
    NEIGHBOUR_VOICE_2("neighbour_voice_2", 0.4f),
    /** A syllable of the neighbour. */
    NEIGHBOUR_VOICE_3("neighbour_voice_3", 0.4f),
    /** A syllable of the neighbour. */
    NEIGHBOUR_VOICE_4("neighbour_voice_4", 0.4f),
    /** A syllable of the neighbour. */
    NEIGHBOUR_VOICE_5("neighbour_voice_5", 0.4f),
    /** A syllable of the neighbour. */
    NEIGHBOUR_VOICE_6("neighbour_voice_6", 0.4f),
    /** A syllable of the neighbour. */
    NEIGHBOUR_VOICE_7("neighbour_voice_7", 0.4f),
    /** A syllable of the neighbour. */
    NEIGHBOUR_VOICE_8("neighbour_voice_8", 0.4f);

    //-------------------- CONSTANTS --------------------
    // The eight syllables, in order: AudioDirector draws one at random for each syllable she says.
    private static final Cue[] VOICES = {
        NEIGHBOUR_VOICE_1, NEIGHBOUR_VOICE_2, NEIGHBOUR_VOICE_3, NEIGHBOUR_VOICE_4,
        NEIGHBOUR_VOICE_5, NEIGHBOUR_VOICE_6, NEIGHBOUR_VOICE_7, NEIGHBOUR_VOICE_8,
    };

    //-------------------- FIELDS --------------------
    // The name of the file, without folder nor extension, and the volume it is played at.
    private final String name;
    private final float volume;

    //-------------------- CONSTRUCTOR --------------------
    Cue(String name, float volume) {
        this.name = name;
        this.volume = volume;
    }

    //-------------------- QUERIES --------------------
    /**
     * Returns the file of this sound, from the assets folder.
     *
     * @return for example {@code "sounds/ui_click.mp3"}
     */
    public String file() {
        return "sounds/" + name + ".mp3";
    }

    /**
     * Returns the volume this sound is played at.
     *
     * @return between 0 and 1
     */
    public float volume() {
        return volume;
    }

    // A copy: the caller cannot change the order AudioDirector draws from.
    /**
     * Returns the eight syllables of the neighbour.
     *
     * @return a new array, from the first syllable to the eighth
     */
    public static Cue[] voices() {
        return VOICES.clone();
    }
}
