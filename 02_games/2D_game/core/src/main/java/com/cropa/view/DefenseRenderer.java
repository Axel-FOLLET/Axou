package com.cropa.view;

import com.cropa.model.defense.Bramble;
import com.cropa.model.defense.Defense;
import com.cropa.model.defense.DefenseSlot;
import com.cropa.model.defense.DefenseSlots;
import com.cropa.model.defense.SlotSide;
import com.cropa.model.enemy.Enemy;
import com.cropa.model.world.Board;
import com.cropa.text.Texts;
import com.cropa.view.fx.Effects;
import com.cropa.view.fx.Particle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.function.Consumer;

/** Draws placed defenses, their labels and the visual consequences of model transitions. */
public class DefenseRenderer {

    //-------------------- CONSTANTS --------------------
    // Drawn size, in world pixels: 24 px from a 32 px image, centred on its 16 px slot, like the farmer in FarmRenderer.
    // 16 looked tiny, 32 covered the field.
    private static final float CATAPATATE_SIZE = 24f;
    // In world pixels: the space between the sprite and its label, and the height kept for the small text above
    // a sprite, because the canvas places the top of the text at the y it receives.
    private static final float LABEL_GAP = 2f;
    private static final float LABEL_HEIGHT = 6f;
    // Above a top slot, the label is raised by the bar and its gap: the bar ends 1 px over the sprite.
    private static final float LABEL_LINE = 11f;
    // A short puff keeps the breaking defense visible through the smoke.
    private static final int DESTRUCTION_SMOKE_COUNT = 6;
    // The health bar under the level label (the user, 25/11: no number, under "N1", bigger and contrasted). 14 px
    // wide: two bars of neighbouring slots, 16 px apart, keep 2 px between them. Its top is 12 px under the top of
    // the label: in a small window the canvas enlarges the label font (GdxCanvas.labelScale, at most 0.8 from the
    // card of the site up), and its bubble then reaches 11 px down. A 1 px black edge around the coloured part.
    private static final float BAR_WIDTH = 14f;
    private static final float BAR_HEIGHT = 6f;
    private static final float BAR_DROP = 12f;
    private static final float BAR_EDGE = 1f;
    // The empty part, dark grey, and the fill, bright on the black edge: green, yellow, orange, then red.
    private static final float[] BAR_EMPTY = {0.22f, 0.22f, 0.22f};
    private static final Map<String, float[]> BAR_FILL = Map.of(
            "new", new float[] {0.3f, 0.95f, 0.3f},
            "worn", new float[] {1f, 0.85f, 0.15f},
            "very_worn", new float[] {1f, 0.5f, 0.1f},
            "almost_broken", new float[] {1f, 0.18f, 0.18f});

    //-------------------- FIELDS --------------------
    // The places of the slots and cells, read from the map. It never changes: final.
    private final BoardLayout layout;
    // The words of the labels, in the language of the game.
    private final Texts texts;
    private static final float FLIGHT = .35f;
    private static final float ARC_HEIGHT = 18f;
    private static final int FIELD_OFFSET = 3;
    private static final int NEW_LIMIT = 75, WORN_LIMIT = 50, VERY_WORN_LIMIT = 25;
    private final Effects effects;
    private final Map<Defense, Pose> poses = new HashMap<>();
    private final List<Shot> shots = new ArrayList<>();
    private final List<Breakage> breaks = new ArrayList<>();
    // The labels and health bars of this frame, kept for renderLabels when the game draws them after the night
    // lighting, like the cat's bubble: graded, the green bar turned a dull teal at night (the user, 25/11).
    private final List<Consumer<Canvas>> labels = new ArrayList<>();
    private boolean labelsDeferred;
    private double now;

    /** A placement owns its clocks and flashes until that object leaves the board. */
    private static final class Pose {
        final Bounds area;
        final String base;
        final Optional<DefenseSlot> slot;
        final HitFlash hurt = new HitFlash();
        boolean attacking;
        int level, durability;
        String idle;
        String action = "";
        double start, end, sparkle = Double.NEGATIVE_INFINITY;

        Pose(Defense defense, Bounds area, String base, Optional<DefenseSlot> slot, String idle) {
            this.area = area;
            this.base = base;
            this.slot = slot;
            this.idle = idle;
            level = defense.getLevel();
            durability = defense.getDurability();
        }

        void play(String key, int frames, double now) {
            action = key;
            start = now;
            end = now + Animations.duration(key, frames);
        }
    }

    private record Shot(Point from, Point to, double start) {}
    private record Breakage(String key, Bounds area, double start) {}

    /** Creates a standalone renderer for callers without a shared effects service. */
    public DefenseRenderer(BoardLayout layout, Texts texts) {
        this(layout, texts, new Effects(new Random()));
    }

    /** Uses the effects service flushed by the game screen. */
    public DefenseRenderer(BoardLayout layout, Texts texts, Effects effects) {
        this.layout = layout;
        this.texts = texts;
        this.effects = effects;
    }

    /** Draws a board with no visible targets. */
    public void render(Canvas canvas, DefenseSlots slots, float delta) {
        render(canvas, slots, List.of(), delta);
    }

    /** Samples each occupied place once, then plays effects that outlive their owner. */
    public void render(Canvas canvas, DefenseSlots slots, List<Enemy> enemies, float delta) {
        now += delta;
        labels.clear();
        var live = slots.getDefenses();
        poses.entrySet().removeIf(entry -> {
            Defense defense = entry.getKey();
            if (live.contains(defense)) return false;
            Pose pose = entry.getValue();
            if (defense.isDestroyed()) {
                if (defense.isAttacking() && !pose.attacking) {
                    pose.slot.ifPresent(slot -> shoot(defense, pose.area, slot, enemies));
                }
                breaks.add(new Breakage(pose.base + "_destroyed" + material(defense.getLevel()), pose.area, now));
                effects.shake(Effects.SMALL_SHAKE);
                Point origin = center(pose.area);
                effects.burst(Particle.SMOKE, origin.x(), origin.y(), DESTRUCTION_SMOKE_COUNT);
            }
            return true;
        });
        for (SlotSide side : SlotSide.values()) {
            for (int column = 1; column <= Board.COLUMNS; column++) {
                DefenseSlot slot = slots.getSlot(side, column);
                Bounds area = slotSpriteArea(layout.getSlotBounds(side, column));
                slot.getDefense().ifPresent(defense -> {
                    String base = side == SlotSide.TOP ? SpriteCatalog.CATAPATATE_TOP : SpriteCatalog.CATAPATATE_BOTTOM;
                    draw(canvas, defense, base, base, area, Optional.of(slot), enemies, delta);
                    float y = labelY(side, area) + (side == SlotSide.TOP ? LABEL_LINE : 0);
                    label(canvas, defense, center(area).x(), y);
                });
            }
        }
        slots.getFieldDefenses().forEach((cell, defense) -> {
            Bounds area = layout.getCellBounds(cell.getRow(), cell.getColumn());
            String idle = defense instanceof Bramble bramble ? bramble.spriteKey() : "scarecrow";
            draw(canvas, defense, defense instanceof Bramble ? "bramble" : idle, idle, area,
                    Optional.empty(), enemies, delta);
            // Above the cell, the bar sits on its top edge and the label over the bar.
            float y = area.y() + area.height() + BAR_DROP + BAR_HEIGHT;
            label(canvas, defense, center(area).x(), y);
        });
        breaks.removeIf(b -> now - b.start >= Animations.duration(b.key, 6));
        for (Breakage b : breaks) canvas.drawAnimation(b.key, b.area, (float) (now - b.start), Tint.NORMAL);
        shots.removeIf(shot -> now - shot.start >= FLIGHT + Animations.duration("potato_splash", 5));
        for (Shot shot : shots) drawShot(canvas, shot);
    }

    /** Chooses the active pose from edges, independently of the model's shorter attack flag. */
    private void draw(Canvas canvas, Defense defense, String base, String idle, Bounds area,
            Optional<DefenseSlot> slot, List<Enemy> enemies, float delta) {
        Pose p = poses.computeIfAbsent(defense, d -> new Pose(d, area, base, slot, idle));
        String level = material(defense.getLevel());
        if (defense.isAttacking() && !p.attacking) {
            if (slot.isPresent()) {
                p.play(base + "_throwing" + level, 5, now);
                shoot(defense, area, slot.get(), enemies);
            } else {
                p.play(base + "_attack" + level, 6, now);
            }
        } else if (defense instanceof Bramble) {
            if (defense.getDurability() < p.durability) p.play("bramble_strike" + level, 5, now);
            else if (!idle.equals(p.idle)) p.play("bramble_grow" + level, 6, now);
        }
        if (defense.getLevel() > p.level) {
            p.sparkle = now;
            p.end = now;
        }
        p.level = defense.getLevel();
        p.durability = defense.getDurability();
        p.attacking = defense.isAttacking();
        p.idle = idle;
        Tint tint = slot.isPresent() ? Tint.NORMAL : p.hurt.tintOf(defense, p.durability, delta);
        if (now < p.end) canvas.drawAnimation(p.action, area, (float) (now - p.start), tint);
        else canvas.drawSprite(idle + level, area, tint);
        String wear = wear(p.durability);
        if (!wear.equals("new")) canvas.drawSprite(base + "_wear" + level + "_" + wear, area, tint);
        if (now - p.sparkle < Animations.duration("upgrade_sparkle", 6)) {
            canvas.drawAnimation("upgrade_sparkle", area, (float) (now - p.sparkle), Tint.NORMAL);
        }
    }

    /**
     * From now on, render keeps the labels and health bars for {@link #renderLabels}: the game draws them after the
     * night lighting, so they keep their colours.
     */
    public void deferLabels() {
        labelsDeferred = true;
    }

    /** Draws the labels and health bars kept by the last render, then forgets them. */
    public void renderLabels(Canvas canvas) {
        for (Consumer<Canvas> label : labels) label.accept(canvas);
        labels.clear();
    }

    // The level, then the health bar under it; drawn at once, or kept for renderLabels.
    private void label(Canvas canvas, Defense defense, float centerX, float y) {
        String level = levelOf(defense);
        int durability = defense.getDurability();
        Consumer<Canvas> draw = target -> {
            target.drawLabel(level, centerX, y);
            drawHealth(target, durability, centerX, y);
        };
        if (labelsDeferred) labels.add(draw);
        else draw.accept(canvas);
    }

    /** Draws the health bar under a level label whose top is at labelTop: black edge, grey empty part, bright fill. */
    private static void drawHealth(Canvas canvas, int percent, float centerX, float labelTop) {
        Bounds frame = new Bounds(centerX - BAR_WIDTH / 2, labelTop - BAR_DROP - BAR_HEIGHT, BAR_WIDTH, BAR_HEIGHT);
        canvas.drawColorLayer(frame, 0f, 0f, 0f, 1f);
        float inner = BAR_WIDTH - 2 * BAR_EDGE;
        float x = frame.x() + BAR_EDGE;
        float y = frame.y() + BAR_EDGE;
        float height = BAR_HEIGHT - 2 * BAR_EDGE;
        canvas.drawColorLayer(new Bounds(x, y, inner, height), BAR_EMPTY[0], BAR_EMPTY[1], BAR_EMPTY[2], 1f);
        if (percent <= 0) return;
        float[] fill = BAR_FILL.get(wear(percent));
        canvas.drawColorLayer(new Bounds(x, y, inner * Math.min(percent, 100) / 100f, height),
                fill[0], fill[1], fill[2], 1f);
    }

    /** Chooses a target in the same row and distance order as Catapatate.findTarget. */
    private void shoot(Defense defense, Bounds area, DefenseSlot slot, List<Enemy> enemies) {
        boolean top = slot.getSide() == SlotSide.TOP;
        int front = top ? 1 : Board.ROWS;
        Optional<Enemy> target = enemies.stream().filter(e -> !e.hasFled() && e.isTargetable())
                .filter(e -> defense.reaches(e.getRow(), (int) Math.ceil(e.getCellsToFarm()) - FIELD_OFFSET))
                .min(Comparator.comparingInt((Enemy e) -> Math.abs(e.getRow() - front))
                        .thenComparingDouble(Enemy::getCellsToFarm));
        int row = target.map(Enemy::getRow).orElse(front);
        Point to = target.filter(Enemy::isOnBoard).map(e -> layout.toScreen(e.getRow(), e.getCellsToFarm()))
                .orElseGet(() -> center(layout.getCellBounds(row, slot.getColumn())));
        Point from = new Point(center(area).x(), area.y() + area.height() * (top ? .85f : .15f));
        shots.add(new Shot(from, to, now));
    }

    /** The shadow interpolates on the ground while the potato rises above it. */
    private void drawShot(Canvas canvas, Shot shot) {
        float age = (float) (now - shot.start);
        if (age >= FLIGHT) {
            canvas.drawAnimation("potato_splash", Bounds.centeredOn(shot.to, 24), age - FLIGHT, Tint.NORMAL);
            return;
        }
        float t = age / FLIGHT;
        float x = shot.from.x() + (shot.to.x() - shot.from.x()) * t;
        float y = shot.from.y() + (shot.to.y() - shot.from.y()) * t;
        canvas.drawSprite("potato_shadow", new Bounds(x - 3, y - 1.5f, 6, 3));
        Point flying = new Point(x, y + 4 * ARC_HEIGHT * t * (1 - t));
        canvas.drawAnimation("potato", Bounds.centeredOn(flying, 8), age, Tint.NORMAL);
    }

    /** Shared by portraits of the next level and by placed defenses. */
    static String material(int level) {
        return switch (level) {
            case 1 -> "";
            case 2 -> "_reinforced";
            case 3 -> "_metal";
            default -> throw new IllegalArgumentException("Defense level " + level);
        };
    }

    /** Atlas suffix for both the wear overlay and the shop gauge. */
    static String wear(int percent) {
        if (percent > NEW_LIMIT) return "new";
        if (percent > WORN_LIMIT) return "worn";
        if (percent > VERY_WORN_LIMIT) return "very_worn";
        return "almost_broken";
    }

    private static Point center(Bounds area) {
        return new Point(area.x() + area.width() / 2, area.y() + area.height() / 2);
    }

    // Package-private and static: the tutorial draws its ghost catapatate (day 14) at the very place of a real one,
    // with this one rule. The sprite is centred on its slot.
    static Bounds slotSpriteArea(Bounds slotArea) {
        Point center = new Point(slotArea.x() + slotArea.width() / 2, slotArea.y() + slotArea.height() / 2);
        return Bounds.centeredOn(center, CATAPATATE_SIZE);
    }

    private String levelOf(Defense defense) {
        return texts.level(defense.getLevel());
    }

    // On the side away from the field, so the labels never hide a crop: above a top sprite, under a bottom one.
    // The top of the label closest to the sprite; drawOnSlot stacks the second one from it.
    private static float labelY(SlotSide side, Bounds area) {
        if (side == SlotSide.TOP) {
            return area.y() + area.height() + LABEL_GAP + LABEL_HEIGHT;
        }
        return area.y() - LABEL_GAP;
    }
}
