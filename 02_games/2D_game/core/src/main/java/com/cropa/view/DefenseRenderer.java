package com.cropa.view;

// The model: the defenses of the game (slots and field), the side of a slot, and a defense.
// Board: the number of columns, one slot per column on each side. Cell: the cell a defense of the field stands on.
// Occupant: what that cell holds, which gives the sprite key. Texts: the letter of the level, in the language of the
// game.
import com.cropa.model.defense.Defense;
import com.cropa.model.defense.DefenseSlots;
import com.cropa.model.defense.SlotSide;
import com.cropa.model.world.Board;
import com.cropa.model.world.Cell;
import com.cropa.model.world.Occupant;
import com.cropa.text.Texts;
// Map: the defenses of the field, cell by cell.
import java.util.Map;

// The defenses on the slots above and under the field: each one with its sprite (throwing for 0.3 s after a shot),
// then its level and its durability.
// The defenses of the field (scarecrow, bramble): only their level and durability, because WorldRenderer already draws
// their sprite through Board.spriteAt, like a crop. Their sprite is drawn a second time only to flash it, for 0.2 s.
// It only talks to Canvas, so the test draws on a RecordingCanvas, without a window.
/**
 * Draws the defenses placed on the defense slots, the level and durability of every defense, and a short red flash
 * after a hit or blue flash after an upgrade.
 */
public class DefenseRenderer {

    //-------------------- CONSTANTS --------------------
    // Drawn size, in world pixels: 24 px from a 32 px image, centred on its 16 px slot, like the farmer in FarmRenderer.
    // 16 looked tiny, 32 covered the field.
    private static final float CATAPATATE_SIZE = 24f;
    // In world pixels: the space between the sprite and its label, and the height kept for the small text above
    // a sprite, because the canvas places the top of the text at the y it receives.
    private static final float LABEL_GAP = 2f;
    private static final float LABEL_HEIGHT = 6f;
    // Day 14: on a slot, the level is a second label stacked on the durability, one label lower or higher: 6 px of
    // text, 1 px of bubble above and under it (GdxCanvas), 1 px between the two bubbles. Side by side, "N1 92%" would
    // be about 27 px wide over 16 px slots: the labels of two catapatates next to each other would cover each other.
    private static final float LABEL_LINE = 9f;

    //-------------------- FIELDS --------------------
    // The places of the slots and cells, read from the map. It never changes: final.
    private final BoardLayout layout;
    // The words of the labels, in the language of the game.
    private final Texts texts;
    // Red after a hit, on a drop of the durability. Only for the defenses of the field: they wear only when an enemy
    // crosses them, so each drop is a real hit. The catapatate wears at each of its own shots: it never turns red.
    private final HitFlash hurtFlash = new HitFlash();
    // Blue after an upgrade, on a rise of the level, for every defense. The level never goes down.
    private final HitFlash upgradeFlash = new HitFlash(Tint.UPGRADED, true);

    //-------------------- CONSTRUCTOR --------------------
    // Called once by GameScreen.show(), like the other renderers.
    /**
     * Creates the renderer of the defenses.
     *
     * @param layout the places read from the map
     * @param texts the words of the labels, in the language of the game
     */
    public DefenseRenderer(BoardLayout layout, Texts texts) {
        this.layout = layout;
        this.texts = texts;
    }

    //-------------------- DRAWING --------------------
    // Called on every frame by GameScreen, after the world and before the enemies, so an enemy passes in front.
    // SlotSide.values(): TOP then BOTTOM, in the order of the enum; one slot per column of the field (Board.COLUMNS).
    // An empty slot draws nothing.
    // Then the defenses of the field, in the order they were placed. delta: the time the flashes count down.
    /**
     * Draws every defense placed on a slot with its level and durability, then the level and durability of every
     * defense of the field, with a short red flash after a hit or blue flash after an upgrade.
     *
     * @param canvas where to draw
     * @param slots the defenses of the game, on the slots and on the field
     * @param delta the time since the previous frame, in seconds
     */
    public void render(Canvas canvas, DefenseSlots slots, float delta) {
        for (SlotSide side : SlotSide.values()) {
            for (int column = 1; column <= Board.COLUMNS; column++) {
                Bounds area = layout.getSlotBounds(side, column);
                slots.getSlot(side, column).getDefense()
                        .ifPresent(defense -> drawOnSlot(canvas, defense, side, area, delta));
            }
        }
        for (Map.Entry<Cell, Defense> entry : slots.getFieldDefenses().entrySet()) {
            drawOnField(canvas, entry.getKey(), entry.getValue(), delta);
        }
    }

    // The sprite first, blue for 0.2 s after an upgrade, then the two labels: "N1" read above "92%" on both sides.
    // All are centred on the middle of the slot. labelY is the top of the label closest to the sprite: above a top
    // slot, the level goes one line higher; under a bottom slot, the durability goes one line lower.
    private void drawOnSlot(Canvas canvas, Defense defense, SlotSide side, Bounds slotArea, float delta) {
        Bounds spriteArea = slotSpriteArea(slotArea);
        Point center = new Point(spriteArea.x() + spriteArea.width() / 2, spriteArea.y() + spriteArea.height() / 2);
        canvas.drawSprite(spriteKeyOf(side, defense), spriteArea,
                upgradeFlash.tintOf(defense, defense.getLevel(), delta));
        float levelTop = side == SlotSide.TOP ? labelY(side, spriteArea) + LABEL_LINE : labelY(side, spriteArea);
        canvas.drawLabel(levelOf(defense), center.x(), levelTop);
        canvas.drawLabel(durabilityOf(defense), center.x(), levelTop - LABEL_LINE);
    }

    // WorldRenderer has already drawn the sprite on the cell. Both flashes are asked on every frame, so each one keeps
    // the value of the previous frame. If one is on, the same sprite is drawn again over it, tinted; blue wins over red
    // (an upgrade puts the durability back to 100 %, a rise, so both at once only after a hit just before the upgrade).
    // The sprite key comes from the cell's occupant, which is this very defense: no cast, no instanceof.
    // Then one label above the cell, "N1 92%" on one line: two stacked labels would cover the whole cell above, often a
    // crop. One line covers its bottom only, as before day 14; it is wider than the cell, but two defenses of the field
    // side by side are rare, while a crop above one is common.
    private void drawOnField(Canvas canvas, Cell cell, Defense defense, float delta) {
        Bounds cellArea = layout.getCellBounds(cell.getRow(), cell.getColumn());
        Tint hurt = hurtFlash.tintOf(defense, defense.getDurability(), delta);
        Tint upgraded = upgradeFlash.tintOf(defense, defense.getLevel(), delta);
        Tint tint = upgraded != Tint.NORMAL ? upgraded : hurt;
        if (tint != Tint.NORMAL) {
            cell.getOccupant().map(Occupant::spriteKey).ifPresent(key -> canvas.drawSprite(key, cellArea, tint));
        }
        float labelTop = cellArea.y() + cellArea.height() + LABEL_GAP + LABEL_HEIGHT;
        String label = levelOf(defense) + " " + durabilityOf(defense);
        canvas.drawLabel(label, cellArea.x() + cellArea.width() / 2, labelTop);
    }

    // Package-private and static: the tutorial draws its ghost catapatate (day 14) at the very place of a real one,
    // with this one rule. The sprite is centred on its slot.
    static Bounds slotSpriteArea(Bounds slotArea) {
        Point center = new Point(slotArea.x() + slotArea.width() / 2, slotArea.y() + slotArea.height() / 2);
        return Bounds.centeredOn(center, CATAPATATE_SIZE);
    }

    // Only the catapatate stands on a slot: its image depends on the side it faces the field from, and on whether it
    // has just shot (Defense.isAttacking, 0.3 s after each shot): then it is throwing its potato.
    private static String spriteKeyOf(SlotSide side, Defense defense) {
        if (defense.isAttacking()) {
            return side == SlotSide.TOP
                    ? SpriteCatalog.CATAPATATE_TOP_THROWING
                    : SpriteCatalog.CATAPATATE_BOTTOM_THROWING;
        }
        return side == SlotSide.TOP ? SpriteCatalog.CATAPATATE_TOP : SpriteCatalog.CATAPATATE_BOTTOM;
    }

    // "N1" ("L1" in English): the level, from 1 to 3, the same letter as in the panel of the shop ("Catapatate N1 92%").
    private String levelOf(Defense defense) {
        return texts.level(defense.getLevel());
    }

    // "92%": the durability left.
    private static String durabilityOf(Defense defense) {
        return defense.getDurability() + "%";
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
