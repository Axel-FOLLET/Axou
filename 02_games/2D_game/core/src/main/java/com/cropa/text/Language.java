package com.cropa.text;

// No import: a plain enum.
/**
 * The languages of the game: every text the player reads exists in French and in English.
 */
public enum Language {
    /** French: the language the game was written in. */
    FRENCH("fr"),
    /** English. */
    ENGLISH("en");

    //-------------------- FIELDS --------------------
    // The two-letter code of the language, as in a web address (?lang=en) or a system setting (fr_FR).
    private final String code;

    //-------------------- CONSTRUCTOR --------------------
    Language(String code) {
        this.code = code;
    }

    //-------------------- ACCESSORS --------------------
    /**
     * Returns the two-letter code of the language.
     *
     * @return "fr" or "en"
     */
    public String getCode() {
        return code;
    }

    // Called by the button of the title screen: two languages, so the other one.
    /**
     * Returns the other language of the game.
     *
     * @return English for French, French for English
     */
    public Language other() {
        return this == FRENCH ? ENGLISH : FRENCH;
    }

    // Called by the launchers with the language of the computer or of the web page. Only French gives French: every
    // other language, or none, gives English, the language most players can read.
    /**
     * Returns the language of a language code, such as "fr", "fr_FR" or "en-GB".
     *
     * @param code a language code, or {@code null} when none is known
     * @return French if the code starts with "fr" (any case), English otherwise
     */
    public static Language fromCode(String code) {
        if (code != null && code.toLowerCase(java.util.Locale.ROOT).startsWith("fr")) {
            return FRENCH;
        }
        return ENGLISH;
    }
}
