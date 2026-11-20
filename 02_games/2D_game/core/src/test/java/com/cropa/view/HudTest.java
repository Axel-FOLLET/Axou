package com.cropa.view;

// JUnit: the checks the tests use, and the annotations. The model: a real session, to check that the HUD hears it,
// its numbers, and the ways a game ends. Random: asked by the session.
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cropa.model.game.GameConfig;
import com.cropa.model.game.GameResult;
import com.cropa.model.game.GameSession;
// Language and Texts: the words of the game in French, the language its layout was measured on.
import com.cropa.text.Language;
import com.cropa.text.Texts;
import java.util.Random;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

// No window: the HUD draws on a RecordingCanvas and receives clicks as world points.
// The values it shows are tested in ViewRenderersTest; here, the lines under them: "Lancer la nuit", the end of the
// game, the alert of the last night and the urn gauge.
/** Tests for the button and the end of the game of {@link Hud}. */
class HudTest {

    //-------------------- CONSTANTS --------------------
    // The texts the game shows in French, its first language: the layout was measured on them.
    private static final Texts FRENCH = Texts.of(Language.FRENCH);

    //-------------------- FIELDS --------------------
    private Hud hud;
    private RecordingCanvas canvas;

    //-------------------- HELPERS --------------------
    // A world 320 px high, like the game: the first line at y 312, the second one at y 288, the third one at y 264.
    // 8 nights, like GameConfig.
    @BeforeEach
    void newHud() {
        hud = new Hud(320, 200, 100, 8, 10000, FRENCH);
        canvas = new RecordingCanvas();
    }

    // A click in the middle of the "Lancer la nuit" button.
    private boolean clickTheButton() {
        Bounds button = hud.getNightButton();
        return hud.handleClick(button.x() + button.width() / 2, button.y() + button.height() / 2);
    }

    // True if one recorded call contains the text.
    private boolean drew(String text) {
        return canvas.calls.stream().anyMatch(call -> call.contains(text));
    }

    // A real session on day 1, which has told the HUD its first values.
    private GameSession sessionHeardByTheHud() {
        GameSession session = new GameSession(new GameConfig(), new Random(0));
        session.addListener(hud);
        session.update(0f);
        return session;
    }

    //-------------------- "LANCER LA NUIT" (J9, Task 7) --------------------
    // By day: the button under the line of the HUD, with its white outline, and a click on it is used.
    @Test
    void byDayTheButtonIsShown() {
        hud.render(canvas);

        assertTrue(drew("text Lancer la nuit 8.0 288.0"));
        assertTrue(drew("outline WHITE"));
        assertTrue(clickTheButton());
    }

    // A click elsewhere is not on the button: GameScreen gives it to the shop.
    @Test
    void aClickElsewhereIsNotTheButton() {
        assertFalse(hud.handleClick(0, 0));
    }

    // Expected by the sheet of the day: by day, a click on the button starts the night. The test does what
    // GameScreen does with the answer (launchNight), then the next frame tells the HUD, which hides the button.
    @Test
    void theButtonLaunchesTheNight() {
        GameSession session = sessionHeardByTheHud();

        assertTrue(session.getCycle().canAct());
        assertTrue(clickTheButton());
        session.getCycle().launchNight(session);
        session.update(0f);
        hud.render(canvas);

        assertTrue(session.getCycle().isNight());
        assertTrue(drew("Nuit : 1"));
        assertFalse(drew("Lancer la nuit"));
    }

    // Expected by the sheet of the day: at night, the button is no longer offered, and its place is not a button.
    @Test
    void atNightNoButton() {
        hud.onNightStarted(1);
        hud.render(canvas);

        assertFalse(drew("Lancer la nuit"));
        assertFalse(clickTheButton());
    }

    // The next day, the button comes back.
    @Test
    void theButtonComesBackAtDawn() {
        hud.onNightStarted(1);
        hud.onDayStarted(2);
        hud.render(canvas);

        assertTrue(drew("Lancer la nuit"));
    }

    //-------------------- THE END OF THE GAME (J9, Task 8) --------------------
    // Expected by the sheet of the day: with 10 000 coins, the urn bought, "Victoire" shows at the next frame,
    // in place of the button, which no longer answers.
    @Test
    void theUrnBoughtShowsTheVictory() {
        GameSession session = sessionHeardByTheHud();
        session.getWallet().add(9800);

        session.buyUrn();
        session.update(0f);
        hud.render(canvas);

        assertTrue(drew("Victoire !"));
        assertFalse(drew("Lancer la nuit"));
        assertFalse(clickTheButton());
    }

    // Expected by the sheet of the day: the farm at 0 HP, the defeat shows.
    @Test
    void theDestroyedFarmShowsTheDefeat() {
        hud.onGameOver(GameResult.DEFEAT_FARM_DESTROYED);
        hud.render(canvas);

        assertTrue(drew("Défaite : la ferme est détruite"));
        assertFalse(drew("Lancer la nuit"));
    }

    // The other defeat: the urn sold at the last dawn.
    @Test
    void theUrnSoldShowsTheDefeat() {
        hud.onGameOver(GameResult.DEFEAT_URN_SOLD);
        hud.render(canvas);

        assertTrue(drew("Défaite : l'urne a été vendue"));
    }

    //-------------------- THE LAST NIGHT (J10) --------------------
    // Asked by Axel on day 10: night 8 is the last one. The HUD warns in red, on the second line, empty at night.
    @Test
    void theLastNightShowsTheAlert() {
        hud.onNightStarted(8);
        hud.render(canvas);

        assertTrue(drew("text Dernière nuit ! 8.0 288.0 ALERT"));
    }

    // Any other night: no alert.
    @Test
    void anotherNightShowsNoAlert() {
        hud.onNightStarted(7);
        hud.render(canvas);

        assertFalse(drew("Dernière nuit"));
    }

    // Day 10, Axel's choice: no alert the day after the last night. The game is settled at that dawn, so the day
    // was never shown; if the HUD heard of it all the same, it would show no red line.
    @Test
    void theDayAfterTheLastNightShowsNoAlert() {
        hud.onNightStarted(8);
        hud.onDayStarted(9);
        hud.render(canvas);

        assertFalse(drew("ALERT"));
        assertFalse(drew("Dernier jour"));
    }

    //-------------------- THE URN GAUGE (J10) --------------------
    // Asked by Axel on day 10: the urn was not visible enough. On the second line, right of the button: the money
    // against the price, then the bar under the words, 136 px wide: 200 / 10 000 of it in green, and its outline.
    @Test
    void theGaugeShowsTheMoneyAgainstTheUrn() {
        hud.render(canvas);

        assertTrue(drew("text Urne : 200 / 10 000 180.0 288.0"));
        assertTrue(drew("dot " + new Bounds(180, 266, 136f * (200f / 10000), 5) + " RIPE"));
        assertTrue(drew("outline WHITE " + new Bounds(180, 266, 136, 5)));
    }

    // It follows the money, with the thousands apart; past the price, the bar stays full, never wider.
    @Test
    void theGaugeFollowsTheMoneyAndStopsFull() {
        hud.onMoneyChanged(12345);
        hud.render(canvas);

        assertTrue(drew("text Urne : 12 345 / 10 000 180.0 288.0"));
        assertTrue(drew("dot " + new Bounds(180, 266, 136, 5) + " RIPE"));
    }

    // At 0 coins: the words and the empty outline, no green part.
    @Test
    void anEmptyWalletFillsNothing() {
        hud.onMoneyChanged(0);
        hud.render(canvas);

        assertTrue(drew("text Urne : 0 / 10 000"));
        assertFalse(drew("dot "));
        assertTrue(drew("outline WHITE " + new Bounds(180, 266, 136, 5)));
    }

    // Always there while the game goes on: at night too, where the button is gone.
    @Test
    void theGaugeStaysAtNight() {
        hud.onNightStarted(3);
        hud.render(canvas);

        assertTrue(drew("text Urne : 200 / 10 000"));
        assertFalse(drew("Lancer la nuit"));
    }

    // Once the game is over, the end takes the second line: no gauge.
    @Test
    void theEndHidesTheGauge() {
        hud.onGameOver(GameResult.VICTORY);
        hud.render(canvas);

        assertFalse(drew("Urne :"));
        assertTrue(drew("Victoire !"));
    }

    // Asked by Axel: the day before the last night (day 8), the button is red and says it is the last night, with
    // its white outline, and under it one block of two small red lines warns that nothing can be sold after it.
    @Test
    void theDayBeforeTheLastNightWarnsInRed() {
        hud.onNightStarted(7);
        hud.onDayStarted(8);
        hud.render(canvas);

        assertTrue(drew("text Lancer la dernière nuit 8.0 288.0 ALERT"));
        assertTrue(drew("outline WHITE " + new Bounds(5, 272, 150, 19)));
        assertTrue(drew("note Vous ne pourrez plus rien vendre après. / Seule la défense de votre ferme comptera."
                + " 8.0 264.0 ALERT"));
        assertFalse(drew("Lancer la nuit"));
    }

    // The red button is wider, and a click on its end (x 140, past the 93 px of the usual one) launches the night;
    // the day before, the same click is not on the button.
    @Test
    void theLastNightButtonIsWider() {
        hud.onDayStarted(7);
        assertFalse(hud.handleClick(140, 280));

        hud.onNightStarted(7);
        hud.onDayStarted(8);
        assertTrue(hud.handleClick(140, 280));
        assertTrue(clickTheButton());
    }

    // Once the game is over, its end replaces the button and the alert.
    @Test
    void theEndHidesTheAlert() {
        hud.onNightStarted(8);
        hud.onGameOver(GameResult.DEFEAT_FARM_DESTROYED);
        hud.render(canvas);

        assertTrue(drew("Défaite : la ferme est détruite"));
        assertFalse(drew("Dernière nuit"));
    }

    //-------------------- NEIGHBOUR (J12) --------------------
    // While the neighbour is on screen, the button is greyed and a click on it is not used; once she left, it works again.
    // Without this test, a night launched during her walk would send her away before she talks.
    @Test
    void theButtonIsLockedWhileNeighbourIsHere() {
        hud.lockNight(true);
        hud.render(canvas);

        assertTrue(drew("text Lancer la nuit 8.0 288.0 GREYED"));
        assertFalse(clickTheButton());

        hud.lockNight(false);
        assertTrue(clickTheButton());
    }

    // The red button of the day before the last night is greyed too: grey wins over red while she is here.
    @Test
    void theLastNightButtonIsGreyedWhileNeighbourIsHere() {
        hud.onDayStarted(8);
        hud.lockNight(true);
        hud.render(canvas);

        assertTrue(drew("text Lancer la dernière nuit 8.0 288.0 GREYED"));
        assertFalse(clickTheButton());
    }

    //-------------------- SOUND BUTTON (20/11) --------------------
    // A click in the middle of the sound button, as it is now.
    private boolean clickTheSoundButton() {
        Bounds button = hud.getSoundButton();
        return hud.handleSoundClick(button.x() + button.width() / 2, button.y() + button.height() / 2);
    }

    // In the bottom right corner, with its white outline ending at x 541: "Son : oui" is 57 px wide, so its words start
    // at 481, on the line of the urn (y 24).
    @Test
    void theSoundButtonSaysTheSoundPlays() {
        hud.render(canvas);

        assertTrue(drew("text Son : oui 481.0 24.0"));
        assertTrue(drew("outline WHITE " + new Bounds(478, 8, 63, 19)));
        assertTrue(clickTheSoundButton());
    }

    // Cut: the words change, and the button keeps its right edge, so it grows to the left.
    @Test
    void theSoundButtonSaysTheSoundIsCut() {
        hud.showMuted(true);
        hud.render(canvas);

        assertTrue(drew("text Son : non 476.0 24.0"));
        assertTrue(clickTheSoundButton());
    }

    // By night and once the game is over, the button stays: the sound can be cut at any time.
    @Test
    void theSoundButtonStaysAtNightAndAtTheEnd() {
        hud.onNightStarted(1);
        hud.onGameOver(GameResult.DEFEAT_FARM_DESTROYED);
        hud.render(canvas);

        assertTrue(drew("text Son : oui"));
        assertTrue(clickTheSoundButton());
    }

    // A click on "Lancer la nuit" is not a click on the sound button.
    @Test
    void theNightButtonIsNotTheSoundButton() {
        Bounds night = hud.getNightButton();

        assertFalse(hud.handleSoundClick(night.x() + night.width() / 2, night.y() + night.height() / 2));
    }
}
