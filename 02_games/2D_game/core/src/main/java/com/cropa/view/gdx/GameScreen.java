package com.cropa.view.gdx;

// libGDX: Gdx and Input (the keyboard and the mouse), Screen (the interface), the Tiled map and its loader,
// the 2D camera, the viewport that keeps the map ratio, the batch, and Vector2 (a click turned into world pixels).
// The model: the session this screen moves forward, the config that gives the starting money and the price of the urn,
// and DefenseSlot, the slot under a click, given to the shop panel. Optional: "no slot under the click" without null.
// GameResult: VICTORY, the only end that shows a cinematic. List: the empty list of scenes after "Rejouer".
// The view: the layout, the HUD, the shop panel, the renderers, the end screen with the choice of its buttons,
// the title screen and the cinematics, none of which knows libGDX.
// WorldRenderer: draws the map, the crops and the defenses of the field. DefenseRenderer: the defenses on their slots
// and the labels of all of them. EnemyRenderer: the enemies.
// NightRenderer: the dark veil of the night. Bounds: the whole world, which the veil covers.
// GrowthRenderer: the colored dot of each crop. OutlineRenderer also veils the range of the defense shown.
// NeighbourRenderer: the neighbour while she talks, and the note of her words, which a click passes.
// TitleChoice: the click on the title screen, which may ask for the other language. Texts: every word of the screen, in
// the language of the game (GameConfig).
// The sound (20/11): AudioDirector makes the sounds of this game, Jukebox (given by CropaGame) plays them with the music,
// Cue names the click of the buttons. Random: the neighbour's syllables.
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Input;
import com.badlogic.gdx.Screen;
import com.badlogic.gdx.graphics.OrthographicCamera;
import com.badlogic.gdx.graphics.g2d.SpriteBatch;
import com.badlogic.gdx.graphics.glutils.ShaderProgram;
import com.badlogic.gdx.maps.tiled.TiledMap;
import com.badlogic.gdx.maps.tiled.TmxMapLoader;
import com.badlogic.gdx.math.Vector2;
import com.badlogic.gdx.utils.viewport.FitViewport;
import com.cropa.model.defense.DefenseSlot;
import com.cropa.model.game.GameConfig;
import com.cropa.model.game.GameResult;
import com.cropa.model.game.GameSession;
import com.cropa.view.BoardLayout;
import com.cropa.view.Bounds;
import com.cropa.view.Cinematic;
import com.cropa.view.DefenseRenderer;
import com.cropa.view.EndChoice;
import com.cropa.view.EndScene;
import com.cropa.view.FarmRenderer;
import com.cropa.view.GrowthRenderer;
import com.cropa.view.Hud;
import com.cropa.view.NeighbourRenderer;
import com.cropa.view.NightCard;
import com.cropa.view.NightRenderer;
import com.cropa.view.OutlineRenderer;
import com.cropa.view.Pointer;
import com.cropa.view.Tooltip;
import com.cropa.view.ShopWindow;
import com.cropa.view.SpriteStyle;
import com.cropa.text.Texts;
import com.cropa.view.Tint;
import com.cropa.view.TitleChoice;
import com.cropa.view.TitleScene;
import com.cropa.view.Transition;
import com.cropa.view.Tutorial;
import com.cropa.view.audio.AudioDirector;
import com.cropa.view.audio.Cue;
import com.cropa.view.audio.Jukebox;
import com.cropa.view.enemy.EnemyRenderer;
import com.cropa.view.fx.Effects;
import com.cropa.view.world.LivingDecor;
import com.cropa.view.world.WorldRenderer;
import java.util.List;
import java.util.Optional;
import java.util.Random;

// implements Screen: GameScreen writes the 7 methods of Screen, one per step of a screen's life.
/**
 * Game screen: loads the Tiled map {@code maps/map_v1.tmx}, moves the game forward on every frame
 * and has it drawn, scaled to the window without distortion. At launch, the title screen covers the frozen farm
 * until a click, then the intro cinematic until its last scene is clicked; after a victory, the victory cinematic
 * comes before the end screen. F1 shows or hides the outlines of the
 * cells and the defense slots; a click goes to the HUD ("Lancer la nuit"), then to the shop panel, which places a
 * defense, plants, opens a panel or sells; while the neighbour talks, a click goes to her "Passer à la suite" button only;
 * once the game is over, a click goes to the end screen only ("Rejouer",
 * "Quitter"). It holds no drawing rule: the renderers decide, {@link GdxCanvas} draws. The first click allows the
 * sound; the HUD's sound button cuts it or brings it back, at any time of the game.
 */
public class GameScreen implements Screen {

    //-------------------- FIELDS --------------------
    // Created in show(), used by render, resize and dispose: they live as long as the screen.
    private TiledMap map;
    private OrthographicCamera camera;
    private FitViewport viewport;
    private SpriteBatch batch;
    // These programs share the batch vertex shader so geometry and animation stay in the original passes.
    private ShaderProgram sceneryShader;
    private ShaderProgram characterShader;
    private boolean gradingWorld;
    private GdxCanvas canvas;
    // The world renderers supply these bubble positions before the night pass.
    private Bounds catBubble;
    private Bounds neighbourBubble;
    private Effects effects;
    private Tooltip tooltip;
    private final Vector2 mouse = new Vector2();
    // Kept after show(): render looks for the slot under each click in it.
    private BoardLayout layout;
    private WorldRenderer worldRenderer;
    private LivingDecor livingDecor;
    private DefenseRenderer defenseRenderer;
    private EnemyRenderer enemyRenderer;
    private FarmRenderer farmRenderer;
    private NeighbourRenderer neighbourRenderer;
    // The five bubbles of the first day (day 14), shown only when the game starts with the title screen. Modal: while
    // they are shown, the day is frozen and every click goes to them.
    private Tutorial tutorial;
    private OutlineRenderer outlineRenderer;
    private NightRenderer nightRenderer;
    private GrowthRenderer growthRenderer;
    private Hud hud;
    private ShopWindow shopWindow;
    private EndScene endScene;
    private NightCard nightCard;
    private Transition transition;
    private TitleScene titleScene;
    // The story before the first day, shown after the title screen, and the one shown after a victory, before the
    // end screen.
    private Cinematic intro;
    private Cinematic victory;
    // The sounds of this game, created in show() like the HUD and subscribed to the session the same way.
    private AudioDirector audioDirector;
    // false by default: the outlines stay hidden until the first press on F1.
    private boolean outlinesVisible;
    // The session this screen moves forward and draws, and its numbers. They never change: final.
    private final GameSession session;
    private final GameConfig config;
    // true at launch, false after "Rejouer": the title screen is shown once, before the first game.
    private final boolean withTitle;
    // The music and the sounds of the whole game, kept by CropaGame across the screens.
    private final Jukebox jukebox;
    // What "Rejouer" does, and what the language button of the title screen does: given by CropaGame, which alone can
    // replace this screen by a new one.
    private final Runnable onReplay;
    private final Runnable onSwitchLanguage;

    //-------------------- CONSTRUCTOR --------------------
    // Called by CropaGame each time a game starts. The screen receives the session instead of creating it, so it holds
    // no rule.
    /**
     * Creates the screen of the given session.
     *
     * @param session the game session to move forward and draw
     * @param config the balancing numbers, for the starting money and the last night shown by the HUD, and the values
     *     of the crops shown by the shop panel
     * @param withTitle true to show the title screen before the game starts
     * @param jukebox plays the music and the sounds; it outlives this screen
     * @param onReplay what the "Rejouer" button of the end screen does: start a new game
     * @param onSwitchLanguage what the language button of the title screen does: start over in the other language
     */
    public GameScreen(GameSession session, GameConfig config, boolean withTitle, Jukebox jukebox, Runnable onReplay,
            Runnable onSwitchLanguage) {
        this.session = session;
        this.config = config;
        this.withTitle = withTitle;
        this.jukebox = jukebox;
        this.onReplay = onReplay;
        this.onSwitchLanguage = onSwitchLanguage;
    }

    //-------------------- LIFECYCLE --------------------
    // Called when the screen opens (setScreen). The path starts from assets/: assets/maps/map_v1.tmx.
    // Camera before viewport: the viewport receives it.
    // FitViewport(560, 320, camera): a world of 560 x 320 px (35 x 20 tiles of 16 px); keeps the ratio, adds bars.
    // TiledLayoutReader.read checks the 28 names once; if one is missing, it throws an exception naming it.
    // addListener comes before the first render: the first update sends everything to the HUD (night, timer, health).
    // The end screen listens the same way, hidden until the game is over; it covers the same world as the night veil.
    // Day 14: the farm renderer receives the health of the farm before the first update, its full health, to change
    // the image of the farm at half; the shop panel receives the values of the crops, for "Carotte 10 -> 40".
    // The title screen covers that world too; it listens to nothing, only a click closes it.
    // The director of the sounds listens like the HUD; it asks for the day music at once (Jukebox.playTrack).
    // Every word comes from the Texts of the language of the game (GameConfig): the HUD, the shop, the tutorial, the neighbour's
    // button, the end screen, the title screen and the cinematics.
    // The cinematics cover it as well. The intro comes with the title screen only: after "Rejouer", an empty
    // cinematic, over at once, so the new game starts at once. The victory cinematic is created for every game, but
    // only shown if the game ends on a victory.
    /**
     * Loads the map and creates the camera, a 560 x 320 viewport, the board layout,
     * the canvas, the renderers (the night veil covering the whole world), the HUD, which it subscribes to the session,
     * the closed shop panel, the end screen, also subscribed, hidden until the game is over, the title screen, the
     * intro cinematic (empty without the title screen) and the victory cinematic.
     */
    @Override
    public void show() {
        map = new TmxMapLoader().load("maps/map_v1.tmx");
        camera = new OrthographicCamera();
        viewport = new FitViewport(560, 320, camera);
        layout = TiledLayoutReader.read(map);
        batch = new SpriteBatch();
        sceneryShader = createGradeShader();
        characterShader = createGradeShader();
        // Defer only speech sprites so the farm and both speakers still receive the night colours.
        canvas = new GdxCanvas(batch, camera, map) {
            @Override
            public void drawSprite(String key, Bounds area) {
                switch (key) {
                    case "cat_meow" -> catBubble = area;
                    case "neighbour_bubble" -> neighbourBubble = area;
                    default -> super.drawSprite(key, area);
                }
            }

            @Override
            public void drawAnimation(String key, Bounds area, float time, Tint tint) {
                boolean actor = gradingWorld && isCharacter(key);
                if (actor) {
                    GameScreen.this.batch.setShader(characterShader);
                }
                super.drawAnimation(key, area, time, tint);
                if (actor) {
                    GameScreen.this.batch.setShader(sceneryShader);
                }
            }

            @Override
            public void drawSprite(String key, Bounds area, float time, SpriteStyle style) {
                boolean actor = gradingWorld && isCharacter(key);
                if (actor) {
                    GameScreen.this.batch.setShader(characterShader);
                }
                super.drawSprite(key, area, time, style);
                if (actor) {
                    GameScreen.this.batch.setShader(sceneryShader);
                }
            }
        };
        effects = new Effects(new Random());
        worldRenderer = new WorldRenderer(layout, effects);
        livingDecor = new LivingDecor();
        Texts texts = Texts.of(config.getLanguage());
        defenseRenderer = new DefenseRenderer(layout, effects);
        defenseRenderer.deferHealthBars();
        enemyRenderer = new EnemyRenderer(layout, effects);
        farmRenderer = new FarmRenderer(layout, session.getFarmHealth(), effects);
        neighbourRenderer = new NeighbourRenderer(layout, texts);
        outlineRenderer = new OutlineRenderer(layout);
        growthRenderer = new GrowthRenderer(layout);
        Bounds world = new Bounds(0, 0, viewport.getWorldWidth(), viewport.getWorldHeight());
        tooltip = new Tooltip(layout, world, texts);
        nightRenderer = new NightRenderer(world, farmRenderer.windowCenter());
        hud = new Hud(viewport.getWorldHeight(), config.getStartingMoney(), session.getFarmHealth(),
                config.getNightCount(), config.getUrnPrice(), texts);
        session.addListener(hud);
        shopWindow = new ShopWindow(session, config.getUrnPrice(), config.getCropConfig(), texts, jukebox);
        tutorial = new Tutorial(world, layout, shopWindow, withTitle, texts);
        endScene = new EndScene(world, texts);
        session.addListener(endScene);
        nightCard = new NightCard(world, layout, config.getNightCount(), texts);
        session.addListener(nightCard);
        transition = new Transition(world);
        titleScene = new TitleScene(world, withTitle, texts);
        intro = withTitle ? Cinematic.intro(world, texts) : new Cinematic(world, List.of(), texts);
        victory = Cinematic.victory(world, texts);
        audioDirector = new AudioDirector(session, config.getNightCount(), jukebox, new Random());
        session.addListener(audioDirector);
    }

    /** Gives renderers the effects belonging to this screen. */
    public Effects getEffects() {
        return effects;
    }

    // Called on every frame by super.render() in CropaGame; delta: seconds since the previous frame.
    // isKeyJustPressed: true only on the frame of the press; isKeyPressed would switch on every frame the key is held.
    // session.update first: the frame then draws the model as it is now. The screen holds no rule, it only passes the time.
    // While the title screen or the intro is shown, no update: the game waits for the clicks, the first day does not
    // start. While the tutorial is shown (day 14), update(0): no time passes, the timer of the first day stays full
    // until "Commencer à jouer", but the HUD still hears the timer, the money and the health on the first frame.
    // The neighbour (day 12) is drawn with the enemies, before the front trees, which hide her in the forest. Her dialog comes
    // after the HUD and the shop panel, so nothing covers it while she talks. While she is on screen, the HUD's night
    // button is locked (told before the click); while she talks, the shop panel is closed, since only her button
    // answers. The cat is drawn by the farm renderer, from the session's cat.
    // Order: the map and the crops, then the sprites, the defenses, the enemies, the front trees, the free places in white
    // (only while the shop panel names a zone), the night veil, the growth dots of the crops and the range of the
    // defense shown (both after the veil: they stay readable at night), the HUD and the shop panel, the end screen
    // (only once the game is over), then the F1 outlines; each one is drawn over the previous one, so an enemy passes
    // in front of a defense, the night darkens everything but the dots, the range, the HUD and the panel, and the end
    // screen covers them all.
    // While the title screen is shown, it replaces the HUD, the panel and the end screen: the farm, then the title.
    // Then the intro does the same until its last scene is clicked; after a victory, the victory cinematic replaces
    // them until its last scene is clicked, then the end screen comes. A defeat goes to the end screen at once.
    // delta also goes to the renderers that keep a red after a hit.
    // The sound: the director looks at the game right after it moved, with the same delta; the jukebox moves its fades
    // on every frame, title screen and cinematics included, and the HUD is told whether the sound is cut.
    /**
     * Switches the outlines when F1 is pressed, gives a click to the shop panel or to what is under it, moves the game
     * forward, then draws the map and the crops, the sprites, the defenses, the enemies, the front trees, the free places
     * of the zone the player works on, the night veil, the growth dots of the crops, the range of the defense shown,
     * the HUD, the shop panel, the end screen once the game is over,
     * and the outlines if they are visible. While the title screen or the intro is shown, the game does not move
     * forward and they are drawn instead of the HUD, the shop panel and the end screen; after a victory, the victory
     * cinematic is drawn instead of them until it is over.
     *
     * @param delta time since the previous frame, in seconds
     */
    @Override
    public void render(float delta) {
        canvas.advance(delta);
        if (Gdx.input.isKeyJustPressed(Input.Keys.F1)) {
            outlinesVisible = !outlinesVisible;
        }
        hud.lockNight(session.getNeighbour().isVisiting());
        hud.showMuted(jukebox.isMuted());
        if (session.getNeighbour().isTalking()) {
            shopWindow.close();
        }
        // Advance the outgoing image before a click can replace it with a fresh one.
        if (titleScene.isVisible()) {
            titleScene.update(delta);
        } else if (!intro.isOver()) {
            intro.update(delta);
        } else if (isVictoryShown()) {
            victory.update(delta);
        } else if (session.isOver()) {
            endScene.update(delta);
        }
        nightCard.update(delta);
        // Remember the initial display even if the first frame consumes a click.
        updateTransition(0f);
        Vector2 position = viewport.unproject(mouse.set(Gdx.input.getX(), Gdx.input.getY()));
        Pointer pointer = new Pointer(position.x, position.y, Gdx.input.isTouched());
        handleClick(position);
        // Keep targets that a lethal shot may remove during this update.
        var targets = List.copyOf(session.getEnemies());
        if (!titleScene.isVisible() && intro.isOver()) {
            float gameDelta = tutorial.isOver() ? delta : 0f;
            session.update(gameDelta);
            effects.update(gameDelta);
            audioDirector.update(gameDelta);
        }
        jukebox.update(delta);
        boolean night = session.getCycle().isNight();
        float timeLeft = session.getCycle().getTimeLeft();
        worldRenderer.render(canvas, session.getBoard(), night, session.getEnemies(), delta);
        // Grade the background once, then grade incoming pixels before their normal alpha blend.
        NightRenderer.Grade scenery = nightRenderer.renderBase(canvas, night, timeLeft, delta);
        gradingWorld = scenery != null;
        if (gradingWorld) {
            canvas.endFrame();
            configure(characterShader, nightRenderer.characterGrade());
            configure(sceneryShader, scenery);
            batch.setShader(sceneryShader);
        }
        farmRenderer.render(canvas, session.getFarmHealth(), session.getFarmer(), session.getCycle().isNight(),
                session.getCat(), delta);
        defenseRenderer.render(canvas, session.getDefenseSlots(), targets, delta);
        enemyRenderer.render(canvas, session.getEnemies(), delta);
        neighbourRenderer.renderNeighbour(canvas, session.getNeighbour());
        canvas.drawFront();
        livingDecor.renderDay(canvas, night, timeLeft, delta);
        effects.renderParticles(canvas);
        shopWindow.highlightedZone()
                .ifPresent(zone -> outlineRenderer.renderFree(canvas, zone, session.getBoard(), session.getDefenseSlots()));
        // Restore normal drawing before additive lights, speech and interface elements.
        if (gradingWorld) {
            batch.setShader(null);
            gradingWorld = false;
        }
        nightRenderer.renderLights(canvas);
        farmRenderer.renderWindows(canvas, session.getFarmHealth(), night, timeLeft);
        livingDecor.renderLights(canvas, night, timeLeft);
        // Draw this frame's speech above the world lighting and below the interface.
        if (catBubble != null) {
            canvas.drawSprite("cat_meow", catBubble, Tint.NORMAL);
            catBubble = null;
        }
        if (neighbourBubble != null) {
            canvas.drawSprite("neighbour_bubble", neighbourBubble, Tint.NORMAL);
            neighbourBubble = null;
        }
        // The health bars of the defenses, also above the lighting: they keep their colours at night.
        defenseRenderer.renderHealthBars(canvas);
        growthRenderer.render(canvas, session.getBoard());
        effects.renderTexts(canvas);
        shopWindow.shownDefense().ifPresent(defense -> outlineRenderer.renderRange(canvas, defense));
        boolean playing = !titleScene.isVisible() && intro.isOver() && !session.isOver()
                && tutorial.isOver() && !session.getNeighbour().isTalking();
        if (playing && session.getCycle().canAct()) {
            shopWindow.getPendingOffer().ifPresent(offer -> outlineRenderer.preview(canvas, pointer, offer,
                    config.getDefenseConfig(), session.getBoard(), session.getDefenseSlots()));
        }
        if (titleScene.isVisible()) {
            titleScene.render(canvas, pointer);
        } else if (!intro.isOver()) {
            intro.render(canvas);
        } else if (isVictoryShown()) {
            victory.render(canvas);
        } else {
            hud.render(canvas, pointer);
            if (!session.isOver()) {
                nightCard.render(canvas);
            }
            shopWindow.render(canvas, playing ? pointer : Pointer.AWAY);
            tutorial.render(canvas, pointer);
            neighbourRenderer.renderDialog(canvas, session.getNeighbour(), pointer);
            endScene.render(canvas, pointer);
        }
        if (outlinesVisible) {
            outlineRenderer.render(canvas);
        }
        tooltip.render(canvas, pointer, session, playing && !shopWindow.isOpen(), delta);
        // Fade the complete frame, including any debug outlines.
        updateTransition(delta);
        transition.render(canvas);
        canvas.endFrame();
    }

    // Props, shadows and speech have their own lighting even when drawn by an actor renderer.
    private static boolean isCharacter(String key) {
        return key.equals("farmer") || (key.startsWith("farmer_") && !key.equals("farmer_chair"))
                || key.equals("cat") || key.equals("cat_grooming") || key.equals("cat_fleeing")
                || (key.startsWith("neighbour_") && !key.equals("neighbour_bubble"))
                || key.equals("bat") || key.startsWith("bat_") || key.equals("witch") || key.startsWith("witch_")
                || key.equals("mole") || key.startsWith("mole_");
    }

    // The affine transform commutes with alpha blending, so foreground foliage keeps its original coverage.
    private ShaderProgram createGradeShader() {
        String fragment = String.join(String.valueOf((char) 10),
                "#ifdef GL_ES",
                "precision mediump float;",
                "#endif",
                "varying vec4 v_color;",
                "varying vec2 v_texCoords;",
                "uniform sampler2D u_texture;",
                "uniform vec3 u_scale;",
                "uniform vec3 u_offset;",
                "void main() {",
                "    vec4 pixel = v_color * texture2D(u_texture, v_texCoords);",
                "    gl_FragColor = vec4(pixel.rgb * u_scale + u_offset, pixel.a);",
                "}",
                "");
        ShaderProgram shader = new ShaderProgram(batch.getShader().getVertexShaderSource(), fragment);
        if (!shader.isCompiled()) {
            String log = shader.getLog();
            shader.dispose();
            throw new IllegalStateException(log);
        }
        return shader;
    }

    // Upload once per program per frame while the batch is closed.
    private static void configure(ShaderProgram shader, NightRenderer.Grade grade) {
        shader.bind();
        shader.setUniformf("u_scale", grade.r(), grade.g(), grade.b());
        shader.setUniformf("u_offset", grade.addR(), grade.addG(), grade.addB());
    }

    // Use the same priority as the drawing branch, including each cinematic image.
    private void updateTransition(float delta) {
        Object phase;
        int image = 0;
        if (titleScene.isVisible()) {
            phase = titleScene;
        } else if (!intro.isOver()) {
            phase = intro;
            image = intro.imageIndex();
        } else if (isVictoryShown()) {
            phase = victory;
            image = victory.imageIndex();
        } else {
            phase = session.isOver() ? endScene : session;
        }
        transition.update(phase, image, delta);
    }
    // Called when the window size changes, and once right after show().
    // true: centres the camera on the world (280, 160); without it, the map's bottom-left corner sits in the middle.
    /**
     * Fits the map to the new window size and centres the camera on it.
     *
     * @param width new window width, in pixels
     * @param height new window height, in pixels
     */
    @Override
    public void resize(int width, int height) {
        viewport.update(width, height, true);
    }

    // Nothing to pause or resume yet.
    /**
     * Does nothing yet.
     */
    @Override
    public void pause() {
    }

    /**
     * Does nothing yet.
     */
    @Override
    public void resume() {
    }

    // Called when another screen replaces this one (setScreen) or when the game closes (Game.dispose()).
    /**
     * Does nothing yet.
     */
    @Override
    public void hide() {
    }

    // Frees all that show() created and that holds graphics memory: Java's garbage collector does not free it.
    // libGDX never calls it by itself: Game.dispose() only calls hide(). CropaGame.dispose() calls it.
    // The canvas and the renderers use the map and the batch: they are freed first.
    /**
     * Frees the renderers, the canvas, the sprite batch and the map.
     */
    @Override
    public void dispose() {
        canvas.dispose();
        sceneryShader.dispose();
        characterShader.dispose();
        batch.dispose();
        map.dispose();
    }

    //-------------------- CLICKS --------------------
    // Called on every frame by render, before session.update.
    // justTouched: true only on the frame of the click, like isKeyJustPressed for F1; isTouched would answer true on
    // every frame the button is held.
    // getX and getY are window pixels, y going down from the top; unproject turns them into world pixels, y going up,
    // through the camera and the black bars of the FitViewport. Without it, the same slot would move with the window size.
    // The title screen first: while it is shown, a click on its language button starts over in the other language
    // (postRunnable, like "Rejouer"), a click anywhere else only closes it, and the board behind it receives nothing.
    // The cinematics before unproject: a click anywhere goes to the next scene, so no position is needed. The intro,
    // then, after a victory, the victory one; the click that ends it does not reach the end screen, whose buttons
    // appear only then.
    // A game over gives the click to the end screen only: after a victory by day, canAct stays true, so without the
    // early return the shop would still sell, and launchNight would start a night (it goes through the cycle).
    // The HUD first, by day: "Lancer la nuit". && stops at canAct when it is false: at night, the HUD is not even asked.
    // While the neighbour talks, she takes every click (her "Passer à la suite" button, or nothing): no buying, no planting,
    // no harvest until her last bubble (Axel, day 12).
    // Then the shop panel: a click on its buttons, its lists or its panels must not also reach the board behind it.
    // Then the slot under the click, then the cell: the shop panel decides (place the defense picked, plant, open);
    // no slot and no cell closes the panel, and forgets a line or a defense picked.
    // The sound (20/11): every click first allows it (a browser plays nothing before one). The title screen, the
    // cinematics and the buttons of the end screen click. The sound button comes before the end screen, the neighbour
    // and the tutorial, which take every other click: it works at any time of the game. Its click is heard when the
    // sound comes back, not when it is cut.
    private void handleClick(Vector2 world) {
        if (!Gdx.input.justTouched()) {
            return;
        }
        jukebox.unlock();
        Optional<TitleChoice> titleChoice = titleScene.handleClick(world.x, world.y);
        if (titleChoice.isPresent()) {
            jukebox.play(Cue.UI_CLICK);
            if (titleChoice.get() == TitleChoice.SWITCH_LANGUAGE) {
                Gdx.app.postRunnable(onSwitchLanguage);
            }
            return;
        }
        if (intro.handleClick()) {
            jukebox.play(Cue.UI_CLICK);
            return;
        }
        if (isVictoryShown()) {
            victory.handleClick();
            jukebox.play(Cue.UI_CLICK);
            return;
        }
        if (hud.handleSoundClick(world.x, world.y)) {
            jukebox.toggleMute();
            jukebox.play(Cue.UI_CLICK);
            return;
        }
        if (session.isOver()) {
            Optional<EndChoice> choice = endScene.handleClick(world.x, world.y);
            choice.ifPresent(this::choose);
            choice.ifPresent(chosen -> jukebox.play(Cue.UI_CLICK));
            return;
        }
        if (neighbourRenderer.handleClick(session.getNeighbour(), world.x, world.y)) {
            return;
        }
        // The tutorial before the HUD: modal, it takes every click while it is shown, so nothing launches the night,
        // opens the shop panel or reaches the field; only its own button moves it on.
        if (tutorial.handleClick(world.x, world.y)) {
            return;
        }
        if (session.getCycle().canAct() && hud.handleClick(world.x, world.y)) {
            session.getCycle().launchNight(session);
            return;
        }
        if (shopWindow.handleClick(world.x, world.y)) {
            return;
        }
        Optional<DefenseSlot> slot = layout.findSlot(world.x, world.y, session.getDefenseSlots());
        if (slot.isPresent()) {
            shopWindow.handleSlotClick(slot.get());
            return;
        }
        layout.findCell(world.x, world.y, session.getBoard())
                .ifPresentOrElse(shopWindow::handleCellClick, shopWindow::close);
    }

    // Called by render and handleClick, on every frame and every click. true while a won game shows its cinematic:
    // the game is over on a victory and its last scene is not clicked yet. getResult() is empty while the game goes
    // on, and a defeat gives another result: in both cases false, so a defeat goes to the end screen at once.
    private boolean isVictoryShown() {
        return session.getResult().filter(GameResult.VICTORY::equals).isPresent() && !victory.isOver();
    }

    // The choice of a button of the end screen. postRunnable: libGDX runs it at the start of the next frame, before
    // render (Lwjgl3Window.update). Replacing this screen right away would free its map while the rest of this render
    // still draws with it. exit: asks libGDX to close the window.
    private void choose(EndChoice choice) {
        switch (choice) {
            case REPLAY -> Gdx.app.postRunnable(onReplay);
            case QUIT -> Gdx.app.exit();
        }
    }
}
