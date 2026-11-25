package com.cropa.view;

import com.cropa.model.enemy.EnemyType;
import com.cropa.model.enemy.WaveTable;
import com.cropa.model.game.GameListener;
import com.cropa.text.Texts;
import java.util.EnumMap;
import java.util.Locale;

/** A short dusk announcement in the space between the field and the HUD. */
public final class NightCard implements GameListener {
    //-------------------- CONSTANTS --------------------
    private static final float DURATION = 2f;
    private static final int STRIPS = 16;

    //-------------------- FIELDS --------------------
    // Use the same wave composition as the game.
    private final WaveTable waves = new WaveTable();
    // Count each enemy type once at nightfall.
    private final EnumMap<EnemyType, Integer> counts = new EnumMap<>(EnemyType.class);
    // Keep the field and HUD outside the band.
    private final Bounds area;
    // The final heading follows the game configuration.
    private final int lastNight;
    // Use the language selected on the title screen.
    private final Texts texts;
    // Keep the announced night until the card fades.
    private int number;
    // Start hidden until the first night event.
    private float elapsed = DURATION;

    //-------------------- CONSTRUCTOR --------------------
    /**
     * Fits the card above the first row and below the HUD gauge.
     *
     * @param world the world rectangle
     * @param layout the field layout
     * @param lastNight the final night number
     * @param texts the current language
     */
    public NightCard(Bounds world, BoardLayout layout, int lastNight, Texts texts) {
        Bounds first = layout.getCellBounds(1, 1);
        float bottom = first.y() + first.height();
        // The HUD gauge ends 54 units below the world top.
        float top = world.y() + world.height() - 54f;
        area = new Bounds(world.x(), bottom, world.width(), Math.max(0f, top - bottom));
        this.lastNight = lastNight;
        this.texts = texts;
    }

    //-------------------- EVENTS --------------------
    /**
     * Reads the new wave once, when the model announces nightfall.
     *
     * @param night the night starting at one
     */
    @Override
    public void onNightStarted(int night) {
        number = night;
        elapsed = 0f;
        counts.clear();
        for (var entry : waves.getWave(night)) {
            counts.merge(entry.getType(), 1, Integer::sum);
        }
    }

    //-------------------- TIME --------------------
    /**
     * Advances the announcement by the given number of seconds.
     *
     * @param delta elapsed time in seconds
     */
    public void update(float delta) {
        elapsed = Math.min(DURATION, elapsed + delta);
    }

    //-------------------- DRAWING --------------------
    /**
     * Draws the dusk band, the heading and the enemies due tonight.
     *
     * @param canvas where to draw
     */
    public void render(Canvas canvas) {
        if (elapsed <= 0f || elapsed >= DURATION || area.height() <= 0f) {
            return;
        }
        float alpha = Math.min(1f, Math.min(elapsed / 0.3f, (DURATION - elapsed) / 0.4f));
        float center = area.x() + area.width() / 2;
        float middle = area.y() + area.height() / 2;
        boolean last = number == lastNight;

        // Adjacent strips blend from warm orange below to dark violet above.
        float step = area.height() / STRIPS;
        for (int i = 0; i < STRIPS; i++) {
            float t = (float) i / (STRIPS - 1);
            float edge = Math.min(1f, Math.min(i + 1, STRIPS - i) / 3f);
            Bounds strip = new Bounds(area.x(), area.y() + i * step, area.width(), step);
            canvas.drawColorLayer(strip, 0.86f - 0.68f * t, 0.36f - 0.28f * t,
                    0.12f + 0.15f * t, 0.75f * edge * alpha);
        }

        // Centre the whole stack, including the extra line on the last night.
        float titleTop = middle + (last ? 28f : 19f);
        canvas.drawFloatingText(texts.nightTitle(number), center, titleTop, alpha, TextStyle.NORMAL);
        if (last) {
            canvas.drawFloatingText(texts.lastNight(), center, titleTop - 19, alpha, TextStyle.NORMAL);
        }
        float y = titleTop - (last ? 58 : 39);
        float x = center - counts.size() * 24f;
        for (var group : counts.entrySet()) {
            String key = group.getKey().name().toLowerCase(Locale.ROOT);
            canvas.drawSprite(key, new Bounds(x, y, 20, 20), 0f, SpriteStyle.NORMAL.withAlpha(alpha));
            canvas.drawFloatingText(Integer.toString(group.getValue()), x + 32, y + 18, alpha, TextStyle.NORMAL);
            x += 48;
        }
    }

    //-------------------- EVENTS --------------------
    /**
     * Clears a pending announcement at dawn.
     *
     * @param day the day starting at one
     */
    @Override
    public void onDayStarted(int day) { elapsed = DURATION; }

    /**
     * Money changes do not affect the wave.
     *
     * @param balance the new balance
     */
    @Override
    public void onMoneyChanged(int balance) {}
    /**
     * Farm damage does not affect the wave.
     *
     * @param health the remaining health
     */
    @Override
    public void onFarmHealthChanged(int health) {}
    /**
     * The card uses frame time between timer events.
     *
     * @param secondsLeft the whole seconds left
     */
    @Override
    public void onTimerChanged(int secondsLeft) {}
}
