package com.cropa.view;

// What the player picks on the title screen, like EndChoice on the end screen: an enum, so a switch over it with no
// default stops compiling until a new value is handled.
/**
 * A click on the title screen.
 */
public enum TitleChoice {
    /** A click anywhere but on the language button: the title screen closes and the game starts. */
    PLAY,
    /** The language button: the game starts over, title screen included, in the other language. */
    SWITCH_LANGUAGE
}
