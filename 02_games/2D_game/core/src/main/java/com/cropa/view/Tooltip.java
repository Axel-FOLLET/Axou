package com.cropa.view;

import com.cropa.model.game.GameSession;
import com.cropa.text.Texts;
import com.cropa.text.Texts.Action;
import java.util.List;
import java.util.Optional;

/** The hover clock restarts on movement, a changed action or any modal screen. */
public final class Tooltip {
    static final int WORDS = 160;
    private static final float WAIT = .5f;
    private static final int PAD = 5, GAP = 8, LINE = 18;
    // Hud.drawStatus puts the bottom of its tallest frame 8 + 20 units below the world top.
    private static final int HUD_DEPTH = 28;
    private static final int BUY_LINE = 15;
    private final BoardLayout layout;
    private final Bounds world;
    private final Texts texts;
    private Pointer last = Pointer.AWAY;
    private Optional<Action> previous = Optional.empty();
    private float still;

    public Tooltip(BoardLayout layout, Bounds world, Texts texts) {
        this.layout = layout;
        this.world = world;
        this.texts = texts;
    }

    /** Draw last, sharing the same pointer as placement and the controls. */
    public void render(Canvas canvas, Pointer pointer, GameSession session, boolean enabled, float delta) {
        Optional<Action> action = Optional.empty();
        if (enabled && !pointer.pressed() && session.getCycle().canAct()) {
            action = layout.findSlot(pointer.x(), pointer.y(), session.getDefenseSlots())
                    .map(slot -> slot.isEmpty() ? Action.BUY : Action.UPGRADE)
                    .or(() -> layout.findCell(pointer.x(), pointer.y(), session.getBoard())
                            .map(cell -> cell.isEmpty() ? Action.PLANT
                                    : session.getDefenseSlots().getDefenseOn(cell).isPresent() ? Action.UPGRADE : Action.HARVEST));
        }
        still = pointer.equals(last) && action.isPresent() && action.equals(previous) ? still + delta : 0f;
        last = pointer;
        previous = action;
        if (still >= WAIT) action.ifPresent(a -> draw(canvas, pointer, a));
    }

    private void draw(Canvas canvas, Pointer pointer, Action action) {
        List<String> lines = texts.hint(action);
        int lineStep = action == Action.BUY ? BUY_LINE : LINE;
        float w = WORDS + 2 * PAD, h = LINE + lines.size() * lineStep + 2 * PAD;
        float x = Math.max(world.x(), Math.min(pointer.x() + GAP, world.x() + world.width() - w));
        float ceiling = world.y() + world.height() - HUD_DEPTH;
        float y = Math.max(world.y(), Math.min(pointer.y() + GAP, ceiling - h));
        canvas.drawFrame(SpriteCatalog.TOOLTIP_FRAME, new Bounds(x, y, w, h), Tint.NORMAL);
        float top = y + h - PAD;
        canvas.drawPlainText(texts.title(action), x + PAD, top, TextStyle.NORMAL);
        top -= LINE;
        for (String line : lines) {
            canvas.drawPlainText(line, x + PAD, top, TextStyle.NORMAL);
            top -= lineStep;
        }
    }
}
