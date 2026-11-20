package com.cropa.view;

// JUnit: the checks the tests use, and the annotations. The model: a real session, to check that the end screen hears
// it, its numbers, and the ways a game ends. Java: Optional for "no button", Random asked by the session.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cropa.model.game.GameConfig;
import com.cropa.model.game.GameResult;
import com.cropa.model.game.GameSession;
// Language and Texts: the words of the game in French, the language its layout was measured on.
import com.cropa.text.Language;
import com.cropa.text.Texts;
import java.util.Optional;
import java.util.Random;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

// No window: the end screen draws on a RecordingCanvas and receives clicks as world points.
/** Tests for {@link EndScene}. */
class EndSceneTest {

    //-------------------- CONSTANTS --------------------
    // The texts the game shows in French, its first language: the layout was measured on them.
    private static final Texts FRENCH = Texts.of(Language.FRENCH);

    //-------------------- FIELDS --------------------
    private EndScene scene;
    private RecordingCanvas canvas;

    //-------------------- HELPERS --------------------
    // The world of the game: 560 x 320, its middle at x 280.
    @BeforeEach
    void newScene() {
        scene = new EndScene(new Bounds(0, 0, 560, 320), FRENCH);
        canvas = new RecordingCanvas();
    }

    // True if one recorded call contains the text.
    private boolean drew(String text) {
        return canvas.calls.stream().anyMatch(call -> call.contains(text));
    }

    // A click in the middle of an area.
    private Optional<EndChoice> clickIn(Bounds area) {
        return scene.handleClick(area.x() + area.width() / 2, area.y() + area.height() / 2);
    }

    //-------------------- WHILE THE GAME GOES ON --------------------
    // Nothing drawn, and the place of the buttons is not a button: the game is still played under it.
    @Test
    void hiddenWhileTheGameGoesOn() {
        scene.onNightStarted(3);
        scene.render(canvas);

        assertTrue(canvas.calls.isEmpty());
        assertEquals(Optional.empty(), clickIn(scene.getReplayButton()));
    }

    //-------------------- THE THREE SCENES --------------------
    // Asked by Axel: Garry, the urn and the ghost of his wife, "VICTOIRE !", and the day the urn was bought back.
    // The veil comes first: it covers the game, the scene is drawn over it.
    @Test
    void theVictoryShowsGarryTheUrnAndTheGhost() {
        scene.onDayStarted(6);
        scene.onGameOver(GameResult.VICTORY);
        scene.render(canvas);

        assertTrue(canvas.calls.get(0).startsWith("veil "));
        assertTrue(drew("centered VICTOIRE ! 280.0 280.0"));
        assertTrue(drew("sprite " + SpriteCatalog.FARMER_STANDING));
        assertTrue(drew("sprite " + SpriteCatalog.URN));
        assertTrue(drew("sprite " + SpriteCatalog.GHOST));
        assertTrue(drew("Garry a racheté l'urne de sa femme."));
        assertTrue(drew("Rachetée au jour 6"));
    }

    // Asked by Axel: one screen per defeat. The farm fell at night 5: the destroyed farm and when it fell.
    @Test
    void theDestroyedFarmShowsTheNightItFell() {
        scene.onNightStarted(5);
        scene.onGameOver(GameResult.DEFEAT_FARM_DESTROYED);
        scene.render(canvas);

        assertTrue(drew("centered DÉFAITE"));
        assertTrue(drew("sprite " + SpriteCatalog.FARM_DESTROYED));
        assertTrue(drew("La ferme est tombée la nuit 5."));
        assertFalse(drew("sprite " + SpriteCatalog.CHMUNKS));
    }

    // The same defeat by day: the screen says "le jour 5", not "la nuit 5". The view shows what the model tells it,
    // whatever the phase the farm fell in.
    @Test
    void theDestroyedFarmShowsTheDayItFell() {
        scene.onDayStarted(5);
        scene.onGameOver(GameResult.DEFEAT_FARM_DESTROYED);
        scene.render(canvas);

        assertTrue(drew("La ferme est tombée le jour 5."));
        assertFalse(drew("la nuit"));
    }

    // The other defeat: M. Chmunks goes away with the urn, between Hugo and Alexis.
    @Test
    void theUrnSoldShowsChmunksAndHisHenchmen() {
        scene.onDayStarted(9);
        scene.onGameOver(GameResult.DEFEAT_URN_SOLD);
        scene.render(canvas);

        assertTrue(drew("centered DÉFAITE"));
        assertTrue(drew("sprite " + SpriteCatalog.HUGO));
        assertTrue(drew("sprite " + SpriteCatalog.CHMUNKS));
        assertTrue(drew("sprite " + SpriteCatalog.URN));
        assertTrue(drew("sprite " + SpriteCatalog.ALEXIS));
        assertTrue(drew("M. Chmunks a vendu l'urne. Trop tard."));
        assertFalse(drew("sprite " + SpriteCatalog.FARM_DESTROYED));
    }

    // Every figure stands on the same line: the bottom of its square plus its empty rows is y 150. Checked on Garry,
    // whose image has the most empty rows under his feet (11 of 48): his square starts at 150 - 68 * 11 / 48.
    @Test
    void theFiguresStandOnTheSameLine() {
        scene.onGameOver(GameResult.VICTORY);
        scene.render(canvas);

        float garryBottom = 150f - 68f * 11 / 48;
        assertTrue(drew("sprite " + SpriteCatalog.FARMER_STANDING + " " + new Bounds(190, garryBottom, 68, 68)));
    }

    //-------------------- THE BUTTONS --------------------
    // Asked by Axel: "Rejouer" and "Quitter", with their white outline.
    @Test
    void theTwoButtonsAreShown() {
        scene.onGameOver(GameResult.DEFEAT_URN_SOLD);
        scene.render(canvas);

        assertTrue(drew("centered Rejouer 220.0 60.0"));
        assertTrue(drew("centered Quitter 340.0 60.0"));
        assertTrue(drew("outline WHITE " + scene.getReplayButton()));
        assertTrue(drew("outline WHITE " + scene.getQuitButton()));
    }

    // Once the game is over, each button answers its choice, and a click elsewhere answers nothing.
    @Test
    void eachButtonAnswersItsChoice() {
        scene.onGameOver(GameResult.VICTORY);

        assertEquals(Optional.of(EndChoice.REPLAY), clickIn(scene.getReplayButton()));
        assertEquals(Optional.of(EndChoice.QUIT), clickIn(scene.getQuitButton()));
        assertEquals(Optional.empty(), scene.handleClick(0, 0));
    }

    //-------------------- WITH A REAL SESSION --------------------
    // The end screen hears the session like the HUD: the urn bought on day 1, the next frame shows the victory.
    @Test
    void theSessionShowsTheVictoryAtTheNextFrame() {
        GameSession session = new GameSession(new GameConfig(), new Random(0));
        session.addListener(scene);
        session.update(0f);
        session.getWallet().add(9800);

        session.buyUrn();
        session.update(0f);
        scene.render(canvas);

        assertTrue(drew("centered VICTOIRE !"));
        assertTrue(drew("Rachetée au jour 1"));
    }
}
