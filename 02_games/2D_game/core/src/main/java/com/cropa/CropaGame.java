package com.cropa;

// Game (libGDX): shows one Screen at a time and passes it every frame. Screen: the screen of the game before,
// freed once "Rejouer" replaces it.
// ScreenUtils: clear(...) fills the whole window with one colour.
// GameScreen: our first screen, the one that draws the map.
// GameConfig: the balancing numbers of the game. GameSession: the model of the game.
// Language: French or English, every text the player reads.
// Random: the source of randomness given to the session.
import com.badlogic.gdx.Game;
import com.badlogic.gdx.Screen;
import com.badlogic.gdx.utils.ScreenUtils;
import com.cropa.model.game.GameConfig;
import com.cropa.model.game.GameSession;
import com.cropa.text.Language;
import com.cropa.view.gdx.GameScreen;
import java.util.Random;

// extends Game: CropaGame inherits setScreen and the screen handling; each launcher creates it with the language to
// start in (the computer's for the desktop, the web page's for the browser).
/**
 * {@link com.badlogic.gdx.Game} implementation shared by all
 * platforms.
 */
public class CropaGame extends Game {

    //-------------------- FIELDS --------------------
    // The language of the games to come: given by the launcher, changed by the button of the title screen.
    private Language language;

    //-------------------- CONSTRUCTOR --------------------
    /**
     * Creates the game. Its first screen opens later, in {@link #create()}, once libGDX is ready.
     *
     * @param language the language the game starts in
     */
    public CropaGame(Language language) {
        this.language = language;
    }

    //-------------------- GAMES --------------------
    // Called by create with the title screen, then by "Rejouer" without it (GameScreen runs it at the start of a
    // frame). A new session and a new screen each time: nothing of the game before is kept.
    // () -> startNewGame(false): a Runnable whose run() calls this very method without the title, given to the screen
    // as what "Rejouer" does. setScreen hides the screen before, then calls show() and resize(width, height) on the
    // new one; it does not free the one before, so it is freed here, once it is no longer shown.
    // One GameConfig for the session and the screen: the HUD shows the money the rules really give.
    // withTitle also tells the first game from a "Rejouer": GameConfig gives Melda's second version at the first game,
    // her first version after.
    // this::switchLanguage: the same kind of Runnable, for the language button of the title screen.
    private void startNewGame(boolean withTitle) {
        GameConfig config = new GameConfig(language, withTitle);
        Screen previous = getScreen();
        GameSession session = new GameSession(config, new Random());
        setScreen(new GameScreen(session, config, withTitle, () -> startNewGame(false), this::switchLanguage));
        if (previous != null) {
            previous.dispose();
        }
    }

    // Called by the language button of the title screen (GameScreen runs it at the start of a frame): the other
    // language, and the game starts over from its title screen, so the player reads it in the new language at once.
    private void switchLanguage() {
        language = language.other();
        startNewGame(true);
    }

    //-------------------- LIFECYCLE --------------------
    // Called once at launch: the first game, behind the title screen.
    /**
     * Opens the first screen of the game, the {@link GameScreen}, with its title screen.
     */
    @Override
    public void create() {
        startNewGame(true);
    }

    // Called on every frame. clear(red, green, blue, alpha), each between 0 and 1: opaque black, the color of the bars
    // around the world when the window or the card of the website does not have its shape.
    // super.render() calls render(delta) on the current screen; Game draws nothing by itself.
    /**
     * Clears the window, then lets the current screen draw itself.
     */
    @Override
    public void render() {
        ScreenUtils.clear(0f, 0f, 0f, 1f);
        super.render();
    }

    // Called once when the window closes. super.dispose() only calls hide() on the screen,
    // so the screen's own dispose() is called here; without it, the map and its renderer are never freed.
    // getScreen() is null if no screen was opened.
    /**
     * Hides the current screen, then frees it.
     */
    @Override
    public void dispose() {
        super.dispose();
        if (getScreen() != null) {
            getScreen().dispose();
        }
    }
}
