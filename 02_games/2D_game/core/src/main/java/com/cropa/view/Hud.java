package com.cropa.view;

// The model: the interface the session calls when the game changes, and the ways a game can end. Texts: the words
// shown, in the language of the game.
// Java: Optional for "the game goes on" (no ending to show yet) without null.
import com.cropa.model.game.GameListener;
import com.cropa.model.game.GameResult;
import com.cropa.text.Texts;
import java.util.Optional;

// implements GameListener: the session can subscribe the HUD with addListener and call its on... methods,
// without knowing the Hud class. Java checks that the five without a body are written; onGameOver has a default body
// in GameListener, and the HUD writes its own.
/**
 * HUD, at the top left of the screen: the money, the farm's health, the day or night and its timer, and under them
 * the "Lancer la nuit" button by day, or the end of the game once it is over, and a red alert on the last night.
 * The day before the last night, the button turns red ("Lancer la dernière nuit") and warns that nothing can be
 * sold after it. Beside the button, the urn gauge: the money against the price of the urn, in words and as a bar.
 * At the bottom right of the world, the button that cuts the sound or brings it back.
 * It only shows the values it receives.
 */
public class Hud implements GameListener {

    //-------------------- CONSTANTS --------------------
    private static final int START_DAY = 1;
    // Gap between the text and the left and top edges of the world, in world pixels.
    private static final float MARGIN = 8f;
    // The second line is 24 px under the first one, like the rows of ShopWindow.
    private static final float ROW_SPACING = 24f;
    // The words come from Texts: "Lancer la nuit" (87 px wide in the default font), in red the day before the last
    // night "Lancer la dernière nuit" (144 px), the alert of the last night, and the warning of the last day to sell.
    // Day 10: no more alert for the day after the last night ("Dernier jour : achète l'urne !"). The game is settled
    // at that dawn (GameSession: the urn is bought if the money is there, otherwise it is sold), so that day was never
    // shown; Axel's choice (14/11): keep the dawn and remove the alert.
    // The warning (asked by Axel): two lines in one block, at half the size of the HUD text. The game is settled at
    // the next dawn: nothing can be sold after it.
    // The gauge shares the second row with the night button, whose right edge is at most x 155.
    private static final float GAUGE_X = 180f;
    private static final int ICON = 10, HEALTH_WIDTH = 24, BAR_HEIGHT = 6;
    private static final int ICON_GAP = 1, GROUP_GAP = 5, BAR_GAP = 3;
    private static final int SHOP_GAP = 4;
    private static final int BORDER = 4, SHOP_LEFT = 397, URN_STEPS = 10;
    private final int fullHealth;
    // The sound button (asked by Axel on 20/11, for the version of the website), in the bottom right corner: its right
    // edge where the outlines of the shop end (x 541), on the line of the urn (its words at y 24, like ShopWindow's
    // URN_TOP). The urn button stands just left of it, by day. "Son : non" is 62 px wide like "Sound off", so its
    // outline starts at x 473 at most (TextsLayoutTest checks both languages against the urn).
    private static final float SOUND_RIGHT = 541f;
    private static final float SOUND_TOP = 24f;

    //-------------------- FIELDS --------------------
    // The y of the top edge of the world.
    private final float worldTop;
    // The words of the HUD, in the language of the game.
    private final Texts texts;
    // The number of the last night and the price of the urn, read in GameConfig by GameScreen: no number of the rules
    // is copied here.
    private final int lastNight;
    private final int urnPrice;
    // Where a click on "Lancer la nuit" acts: computed once in the constructor, from worldTop and the width of its
    // words, then never changed. The last-night button is wider, for its longer text.
    private final Bounds nightButton;
    private final Bounds lastNightButton;
    // The sound button while the sound plays, and while it is cut: its words change, so its width too.
    private final Bounds soundOnButton;
    private final Bounds soundOffButton;
    private int money;
    private int farmHealth;
    // The number of the phase and its kind: day 1 and night 1 share the number 1, so the word is kept apart.
    private int number;
    private boolean night;
    // 0 until the first timer arrives; never seen, because the session sends it before the first render.
    private int secondsLeft;
    // Rebuilt only when a value changes: render runs on every frame and would otherwise build a new String each time.
    // The same for the words of the urn gauge.
    private java.util.List<String> parts;
    private String gaugeText;
    // The end of the game, in words. Empty while the game goes on.
    private Optional<String> ending = Optional.empty();
    // true while the neighbour is on screen (day 12): the night button is greyed and does nothing.
    private boolean nightLocked;
    // true while the sound is cut: the button then says so. Told by GameScreen, which asks the Jukebox.
    private boolean muted;

    //-------------------- CONSTRUCTOR --------------------
    // Called once by GameScreen.show(). The starting values come from the model: no number of the rules is copied here.
    // The button: its bubble goes from 16 px under the top of its text to 3 px above it, 3 px on each side.
    /**
     * Shows the values of the start of a game.
     *
     * @param worldTop the y of the top edge of the world, in world pixels
     * @param money the starting money
     * @param farmHealth the starting health of the farm
     * @param lastNight the number of the last night of the game
     * @param urnPrice the price of the urn, the goal of the gauge
     * @param texts the words, in the language of the game
     */
    public Hud(float worldTop, int money, int farmHealth, int lastNight, int urnPrice, Texts texts) {
        this.worldTop = worldTop;
        this.texts = texts;
        this.lastNight = lastNight;
        this.urnPrice = urnPrice;
        this.money = money;
        this.farmHealth = farmHealth;
        this.fullHealth = Math.max(1, farmHealth);
        number = START_DAY;
        nightButton = new Bounds(MARGIN - 3, secondRowTop() - 16, TextWidth.of(texts.startNight()) + 6, 19);
        lastNightButton = new Bounds(MARGIN - 3, secondRowTop() - 16, TextWidth.of(texts.startLastNight()) + 6, 19);
        soundOnButton = soundButton(texts.sound(false));
        soundOffButton = soundButton(texts.sound(true));
        refreshText();
    }

    //-------------------- EVENTS --------------------
    // Called by GameSession.notifyChanges, at the end of an update, only when the value changed.
    // @Override: the method comes from GameListener; if its name were mistyped, the compiler would refuse it.
    /**
     * Shows the new amount of money.
     *
     * @param balance the player's money
     */
    @Override
    public void onMoneyChanged(int balance) {
        money = balance;
        refreshText();
    }

    /**
     * Shows the farm's new health.
     *
     * @param health the farm's health points
     */
    @Override
    public void onFarmHealthChanged(int health) {
        farmHealth = health;
        refreshText();
    }

    /**
     * Shows the number of the day that starts.
     *
     * @param day the number of the day
     */
    @Override
    public void onDayStarted(int day) {
        number = day;
        night = false;
        refreshText();
    }

    /**
     * Shows the number of the night that starts.
     *
     * @param night the number of the night
     */
    @Override
    public void onNightStarted(int night) {
        number = night;
        this.night = true;
        refreshText();
    }

    /**
     * Shows the whole seconds left in the current day or night.
     *
     * @param secondsLeft the seconds left, rounded up
     */
    @Override
    public void onTimerChanged(int secondsLeft) {
        this.secondsLeft = secondsLeft;
        refreshText();
    }

    // Called once by GameSession.notifyChanges, at the first frame where the game has a result.
    // @Override: it replaces the empty default body of GameListener. Texts.ending switches over the enum, with no
    // default: a fourth GameResult does not compile until its words are written there.
    /**
     * Shows how the game ended, in place of the "Lancer la nuit" button.
     *
     * @param result how the game ended
     */
    @Override
    public void onGameOver(GameResult result) {
        ending = Optional.of(texts.ending(result));
    }

    // Called by GameScreen at each frame, before the click, with Neighbour.isVisiting() (Axel, day 12): a night launched
    // during her walk would send her away before she talks. No event from the model: the HUD is told, like it is told
    // what it shows.
    /**
     * Locks or unlocks the "Lancer la nuit" button: locked, it is greyed and a click on it does nothing.
     *
     * @param locked {@code true} while the neighbour is on screen
     */
    public void lockNight(boolean locked) {
        nightLocked = locked;
    }

    // Called by GameScreen at each frame, with Jukebox.isMuted(), like lockNight: the HUD only shows what it is told.
    /**
     * Shows whether the sound is cut, on the sound button.
     *
     * @param muted {@code true} while the sound is cut
     */
    public void showMuted(boolean muted) {
        this.muted = muted;
    }

    //-------------------- CLICKS --------------------
    // Called by GameScreen first, before the shop: true if the click is on the button while it is shown.
    // The HUD does not launch the night itself: it only knows what it shows; GameScreen calls the cycle.
    // Locked (the neighbour is here): false, so the click goes on to the shop and the field, which still work.
    /**
     * Tells whether a click, in world pixels, lands on the "Lancer la nuit" button.
     *
     * @param x the x of the click
     * @param y the y of the click
     * @return {@code true} if the button is shown, not locked, and the click is on it
     */
    public boolean handleClick(float x, float y) {
        return !nightLocked && buttonShown() && button().contains(x, y);
    }

    // Called by GameScreen before the neighbour and the tutorial, which take every other click: the sound can be cut
    // while they are shown, by day, by night, and at the end of a game. GameScreen cuts it: the HUD only answers.
    /**
     * Tells whether a click, in world pixels, lands on the sound button.
     *
     * @param x the x of the click
     * @param y the y of the click
     * @return {@code true} if the click is on it
     */
    public boolean handleSoundClick(float x, float y) {
        return soundButton().contains(x, y);
    }

    // Read by the tests, like getNightButton.
    /**
     * Returns the clickable area of the sound button, for its words of now.
     *
     * @return its area, in world pixels
     */
    public Bounds getSoundButton() {
        return soundButton();
    }

    // Read by the tests, which click in its middle instead of copying numbers.
    /**
     * Returns the clickable area of the button of today: "Lancer la nuit", or the wider "Lancer la dernière nuit".
     *
     * @return its area, in world pixels
     */
    public Bounds getNightButton() {
        return button();
    }

    //-------------------- DRAWING --------------------
    // Called on every frame by GameScreen. The y is the top of the text, so it hangs under the top edge of the world.
    // Second line: the end of the game once it is over; otherwise the button, by day only, with its white outline.
    // The day before the last night, the button text is red and says it is the last one, with its warning under it:
    // two small red lines in one block. Then the alert, in red: on the second line at night, under the button by day.
    // The urn gauge while the game goes on, by day and by night; once it is over, the end of the game takes the line.
    /**
     * Draws the text at the top left of the world, and under it the end of the game or the "Lancer la nuit" button
     * with the urn gauge, then the alert of the last night or the warning of the day before it.
     *
     * @param canvas where to draw
     */
    public void render(Canvas canvas) {
        render(canvas, Pointer.AWAY);
    }

    /** Draws the controls at the current world-space pointer. */
    public void render(Canvas canvas, Pointer pointer) {
        drawStatus(canvas);
        if (ending.isPresent()) {
            canvas.drawText(ending.get(), MARGIN, secondRowTop());
        } else {
            drawUrnGauge(canvas);
        }
        if (buttonShown()) {
            if (lastSaleDay()) {
                TextStyle style = nightLocked ? TextStyle.GREYED : TextStyle.ALERT;
                pointer.button(canvas, button(), texts.startLastNight(), style);
                canvas.drawNote(texts.lastSaleWarning(), MARGIN, alertTop(), TextStyle.ALERT);
            } else {
                pointer.button(canvas, button(), texts.startNight(),
                        nightLocked ? TextStyle.GREYED : TextStyle.NORMAL);
            }
        }
        alert().ifPresent(words -> canvas.drawText(words, MARGIN, alertTop(), TextStyle.ALERT));
        Bounds sound = soundButton();
        pointer.button(canvas, sound, texts.sound(muted), TextStyle.NORMAL);
    }

    /** Keep even the longest normal status left of the shop. For a larger balance the bar sits under HP. */
    private void drawStatus(Canvas canvas) {
        float top = worldTop - MARGIN;
        float x = BORDER;
        int words = parts.stream().mapToInt(TextWidth::of).sum();
        int inlineGap = BAR_GAP + HEALTH_WIDTH + BAR_GAP;
        int baseWidth = 2 * BORDER + words + 3 * (ICON + ICON_GAP) + 2 * GROUP_GAP;
        boolean under = baseWidth + inlineGap > SHOP_LEFT - SHOP_GAP;
        int healthGap = under ? GROUP_GAP : inlineGap;
        int width = baseWidth + healthGap;
        Bounds frame = new Bounds(0, top - (under ? 20 : 16), width, under ? 24 : 20);
        canvas.drawFrame(SpriteCatalog.HUD_FRAME, frame, Tint.NORMAL);
        for (int i = 0; i < parts.size(); i++) {
            if (i < 3) {
                String icon = i == 0 ? "icon_coin" : i == 1 ? "icon_heart" : night ? "dial_night" : "dial_day";
                canvas.drawSprite(icon, new Bounds(x, top - ICON, ICON, ICON));
                x += ICON + ICON_GAP;
            }
            float start = x;
            canvas.drawPlainText(parts.get(i), x, top, TextStyle.NORMAL);
            x += TextWidth.of(parts.get(i));
            if (i == 0 || i == 2) x += GROUP_GAP;
            if (i == 1) {
                float barX = under ? start : x + BAR_GAP;
                float barY = top - (under ? 18 : 9);
                canvas.drawSprite("lifebar_back", new Bounds(barX, barY, HEALTH_WIDTH, BAR_HEIGHT));
                float fill = (HEALTH_WIDTH - 2) * Math.min(1f, (float) farmHealth / fullHealth);
                if (fill > 0) canvas.drawSprite("lifebar_fill", new Bounds(barX + 1, barY + 1, fill, BAR_HEIGHT - 2));
                x += healthGap;
            }
        }
    }

    /** Use the atlas index as an explicit one-second animation time. */
    private void drawUrnGauge(Canvas canvas) {
        float top = secondRowTop();
        Bounds urn = new Bounds(GAUGE_X + TextWidth.of(gaugeText) + BORDER, top - 20, 16, 20);
        float left = GAUGE_X - BORDER;
        Bounds frame = new Bounds(left, urn.y() - BORDER, urn.x() + urn.width() + BORDER - left,
                urn.height() + 2 * BORDER);
        canvas.drawFrame(SpriteCatalog.HUD_FRAME, frame, Tint.NORMAL);
        canvas.drawPlainText(gaugeText, GAUGE_X, top, TextStyle.NORMAL);
        float share = Math.max(0f, Math.min(1f, (float) money / urnPrice));
        canvas.drawAnimation("urn_gauge", urn, (int) (share * URN_STEPS), Tint.NORMAL);
    }

    //-------------------- TEXT --------------------
    // Called by the constructor and the on... methods. The words come from Texts, in the language of the game; the
    // thousands of the gauge are apart as its players read them ("3 450" in French, "3,450" in English).
    // The timer changes about once per second: the text is rebuilt once per second, not on every frame.
    private void refreshText() {
        parts = texts.statusParts(money, farmHealth, night, number, secondsLeft);
        gaugeText = texts.urnGauge(money, urnPrice);
    }

    // The button only means something by day, and while the game goes on.
    private boolean buttonShown() {
        return !night && ending.isEmpty();
    }

    // The day before the last night (day 8): the last day to sell.
    private boolean lastSaleDay() {
        return !night && number == lastNight;
    }

    // The outline of the sound button for some words: 3 px around them, like the other buttons, ending at SOUND_RIGHT.
    private Bounds soundButton(String words) {
        float width = TextWidth.of(words) + 6;
        return new Bounds(SOUND_RIGHT - width, SOUND_TOP - 16, width, 19);
    }

    // The sound button of now: its words say whether the sound plays.
    private Bounds soundButton() {
        return muted ? soundOffButton : soundOnButton;
    }

    // The button of today: wider the day before the last night, for its longer text.
    private Bounds button() {
        return lastSaleDay() ? lastNightButton : nightButton;
    }

    // The alert of this phase, if any: the last night. None once the game is over: its end replaces it. The day before
    // the last night has its warning under the button instead (render).
    private Optional<String> alert() {
        if (ending.isPresent()) {
            return Optional.empty();
        }
        if (night && number == lastNight) {
            return Optional.of(texts.lastNight());
        }
        return Optional.empty();
    }

    // Under the button while it is shown (by day), otherwise in its place, on the second line.
    private float alertTop() {
        return buttonShown() ? secondRowTop() - ROW_SPACING : secondRowTop();
    }

    // The top of the second line, under the text of the first one.
    private float secondRowTop() {
        return worldTop - MARGIN - ROW_SPACING;
    }
}
