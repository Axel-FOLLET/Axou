package com.cropa.view;

// What the player picks on the end screen. An enum and not two booleans: a third button (the title screen, point 4)
// is one more value, and a switch over it with no default stops compiling until that value is handled.
/**
 * A button of the end screen.
 */
public enum EndChoice {
    /** "Rejouer": a new game starts. */
    REPLAY,
    /** "Quitter": the game closes. */
    QUIT
}
