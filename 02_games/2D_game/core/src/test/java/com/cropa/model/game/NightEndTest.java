package com.cropa.model.game;

// JUnit: the checks the tests use, and the annotation that marks a test. The model: an enemy of the session.
// Random: asked by the session.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cropa.model.enemy.Enemy;
import java.util.Random;
import org.junit.jupiter.api.Test;

// Asked by Axel after his test of day 9: a night with no enemy left ends at once (NightState.isOver).
// A file of its own, so this rule is read in one place.
/** Tests for the end of a night before its timer. */
class NightEndTest {

    //-------------------- HELPERS --------------------
    // Night 1, just launched. Day 10: no bat of the POC any more; the wave of night 1 brings 2 bats, at 5 s and 10 s.
    private GameSession nightOne() {
        GameSession session = new GameSession(new GameConfig(), new Random(0));
        session.getCycle().launchNight(session);
        return session;
    }

    //-------------------- TESTS --------------------
    // Day 10: the whole wave of night 1 is out after 10.1 s (one frame: both bats appear at its end), then both die.
    // At the next frame, day 2 starts, about 35 s before the timer would have ended the night.
    @Test
    void theNightEndsOnceEveryEnemyIsDead() {
        GameSession session = nightOne();
        session.update(10.1f);
        assertEquals(2, session.getEnemies().size());

        for (Enemy bat : session.getEnemies()) {
            bat.takeDamage(bat.getHealth());
        }
        session.update(0.1f);

        assertFalse(session.getCycle().isNight());
        assertEquals(2, session.getCycle().getNumber());
    }

    // While the bat lives, the night goes on.
    @Test
    void theNightGoesOnWhileAnEnemyLives() {
        GameSession session = nightOne();

        session.update(10f);

        assertTrue(session.getCycle().isNight());
    }

    // The day has no enemy, yet it keeps its timer: only the night ends early.
    @Test
    void theDayDoesNotEndWithoutEnemies() {
        GameSession session = new GameSession(new GameConfig(), new Random(0));

        session.update(10f);

        assertFalse(session.getCycle().isNight());
        assertEquals(1, session.getCycle().getNumber());
    }

    // The bats of night 1 are dead, so night 1 ends; night 2 brings a new wave: the dead ones do not end night 2.
    // Day 10: the wave of night 1 is out after 10.1 s (one frame), and its 2 bats are killed by hand.
    // In night 2, after 1 s, its wave has not come yet: the night goes on.
    @Test
    void aDeadEnemyOfThePreviousNightDoesNotEndTheNext() {
        GameSession session = nightOne();
        session.update(10.1f);
        for (Enemy bat : session.getEnemies()) {
            bat.takeDamage(bat.getHealth());
        }
        session.update(0.1f);
        assertFalse(session.getCycle().isNight());

        session.getCycle().launchNight(session);
        session.update(1f);

        assertTrue(session.getCycle().isNight());
    }
}
