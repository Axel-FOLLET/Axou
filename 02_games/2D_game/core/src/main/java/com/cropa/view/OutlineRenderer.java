package com.cropa.view;

// SlotSide: the side of a defense slot, from the model. DefenseSlots and Board: asked which slots and cells are free;
// Board also gives the size of the field (ROWS, COLUMNS).
// Defense: asked which cells it reaches.
import com.cropa.model.defense.Bramble;
import com.cropa.model.defense.Catapatate;
import com.cropa.model.defense.DefenseConfig;
import com.cropa.model.defense.DefenseOffer;
import com.cropa.model.defense.DefenseType;
import com.cropa.model.defense.Scarecrow;
import java.util.List;
import com.cropa.model.defense.Defense;
import com.cropa.model.defense.DefenseSlots;
import com.cropa.model.defense.SlotSide;
import com.cropa.model.world.Board;

// The debug view shown by F1, and the free places shown to the player. Every value comes from the map, no pixel is
// written here.
/**
 * Draws the outlines of the 15 cells in green and of the 10 defense slots in yellow, the free places of a zone
 * in white, and the range of a defense under a white veil.
 */
public class OutlineRenderer {

    //-------------------- FIELDS --------------------
    private final BoardLayout layout;

    //-------------------- CONSTRUCTOR --------------------
    // Called once by GameScreen.show().
    /**
     * Creates the renderer of the outlines.
     *
     * @param layout the places read from the map
     */
    public OutlineRenderer(BoardLayout layout) {
        this.layout = layout;
    }

    //-------------------- DRAWING --------------------
    // Called by GameScreen on every frame while the outlines are visible, last: they stay over everything.
    /**
     * Draws the outlines.
     *
     * @param canvas where to draw
     */
    public void render(Canvas canvas) {
        for (int row = 1; row <= Board.ROWS; row++) {
            for (int column = 1; column <= Board.COLUMNS; column++) {
                canvas.drawOutline(layout.getCellBounds(row, column), OutlineColor.GREEN);
            }
        }
        for (int column = 1; column <= Board.COLUMNS; column++) {
            canvas.drawOutline(layout.getSlotBounds(SlotSide.TOP, column), OutlineColor.YELLOW);
            canvas.drawOutline(layout.getSlotBounds(SlotSide.BOTTOM, column), OutlineColor.YELLOW);
        }
    }

    // Called by GameScreen on every frame while ShopWindow names a zone: the places where the player can put something.
    // A switch over the enum, with no default: a third Zone does not compile until its line is written here.
    /**
     * Draws in white the free places of a zone: the empty cells of the field, or the empty defense slots.
     *
     * @param canvas where to draw
     * @param zone the zone the player is working on
     * @param board the field, asked which cells are empty
     * @param slots the defense slots, asked which ones are empty
     */
    public void renderFree(Canvas canvas, Zone zone, Board board, DefenseSlots slots) {
        switch (zone) {
            case FIELD -> renderFreeCells(canvas, board);
            case SLOTS -> renderFreeSlots(canvas, slots);
        }
    }

    // Called by GameScreen on every frame while the panel of a defense is open (ShopWindow.shownDefense), by day and
    // by night. Asked by Axel on day 10, like the range of a spell in a tactical game: the cells the defense reaches
    // get a light white veil. The defense decides (Defense.reaches): no shape is written in the view.
    /**
     * Veils in white the cells of the field a defense reaches.
     *
     * @param canvas where to draw
     * @param defense the defense whose panel is open
     */
    public void renderRange(Canvas canvas, Defense defense) {
        for (int row = 1; row <= Board.ROWS; row++) {
            for (int column = 1; column <= Board.COLUMNS; column++) {
                if (defense.reaches(row, column)) {
                    canvas.drawSprite(SpriteCatalog.RANGE_CELL, layout.getCellBounds(row, column));
                }
            }
        }
    }

    // Row by row, then column by column, like render: only the empty cells get an outline.
    private void renderFreeCells(Canvas canvas, Board board) {
        for (int row = 1; row <= Board.ROWS; row++) {
            for (int column = 1; column <= Board.COLUMNS; column++) {
                if (board.getCell(row, column).isEmpty()) {
                    canvas.drawFrame(SpriteCatalog.CELL_FRAME, layout.getCellBounds(row, column), Tint.NORMAL);
                }
            }
        }
    }

    // Both sides, column by column: only the empty slots get an outline.
    private void renderFreeSlots(Canvas canvas, DefenseSlots slots) {
        for (SlotSide side : SlotSide.values()) {
            for (int column = 1; column <= Board.COLUMNS; column++) {
                if (slots.getSlot(side, column).isEmpty()) {
                    canvas.drawFrame(SpriteCatalog.CELL_FRAME, layout.getSlotBounds(side, column), Tint.NORMAL);
                }
            }
        }
    }

    /** Builds a detached defense so its real reaches method decides which cells to draw. */
    public void preview(Canvas canvas, Pointer pointer, DefenseOffer offer, DefenseConfig config,
            Board board, DefenseSlots slots) {
        if (offer.isPlacedOnField()) {
            layout.findCell(pointer.x(), pointer.y(), board).filter(cell -> cell.isEmpty()).ifPresent(cell -> {
                boolean thorn = offer.getType() == DefenseType.BRAMBLE;
                Defense model = thorn ? new Bramble(cell, config) : new Scarecrow(cell, config, List.of());
                Bounds area = layout.getCellBounds(cell.getRow(), cell.getColumn());
                ghost(canvas, model, thorn ? "bramble_0" : "scarecrow", area, area);
            });
        } else {
            layout.findSlot(pointer.x(), pointer.y(), slots).filter(slot -> slot.isEmpty()).ifPresent(slot -> {
                Bounds area = layout.getSlotBounds(slot.getSide(), slot.getColumn());
                String key = slot.getSide() == SlotSide.TOP ? SpriteCatalog.CATAPATATE_TOP : SpriteCatalog.CATAPATATE_BOTTOM;
                ghost(canvas, new Catapatate(slot, config, List.of()), key, area, DefenseRenderer.slotSpriteArea(area));
            });
        }
    }

    private void ghost(Canvas canvas, Defense model, String key, Bounds area, Bounds sprite) {
        renderRange(canvas, model);
        canvas.drawSprite(SpriteCatalog.CELL_HOVER, area);
        canvas.drawSprite(key, sprite, Tint.GHOST);
    }
}
