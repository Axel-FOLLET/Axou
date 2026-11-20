package com.cropa.view;

// The model: the field, its size, its cells and the crops planted on it.
import com.cropa.model.world.Board;
import com.cropa.model.world.Crop;
// Java: the crops of the field, read once per frame.
import java.util.List;
import java.util.Optional;

// Asked by Axel on day 10: the sprite alone does not tell whether a crop is ripe. A small dot in the bottom right
// corner of each planted cell gives its growth: red for a seed, orange while it grows, green once ripe (Growth).
// Drawn by GameScreen after the night veil: the dots stay bright at night too. A defense of the field (scarecrow,
// bramble) is not a crop: no dot.
/**
 * Draws the growth dot of every crop of the field.
 */
public class GrowthRenderer {

    //-------------------- CONSTANTS --------------------
    // A cell is 16 px wide in the map: a dot of 3 px, 1 px from the edges, leaves the crop visible.
    private static final float DOT_SIZE = 3f;
    private static final float DOT_INSET = 1f;

    //-------------------- FIELDS --------------------
    // Turns a row and a column into the rectangle of a cell. Set once, never changed.
    private final BoardLayout layout;

    //-------------------- CONSTRUCTOR --------------------
    // Called once by GameScreen.show().
    /**
     * Creates the renderer of the growth dots.
     *
     * @param layout the place of each cell on the screen
     */
    public GrowthRenderer(BoardLayout layout) {
        this.layout = layout;
    }

    //-------------------- DRAWING --------------------
    // Called by GameScreen on every frame. Row by row, then column by column, like the other renderers of the field.
    /**
     * Draws a dot of the color of its growth on every cell that holds a crop.
     *
     * @param canvas where to draw
     * @param board the field, read only
     */
    public void render(Canvas canvas, Board board) {
        List<Crop> crops = board.getCrops();
        for (int row = 1; row <= Board.ROWS; row++) {
            for (int column = 1; column <= Board.COLUMNS; column++) {
                Bounds cell = layout.getCellBounds(row, column);
                cropOn(board, crops, row, column)
                        .ifPresent(crop -> canvas.drawDot(dotOf(cell), Growth.of(crop).getStyle()));
            }
        }
    }

    //-------------------- INTERNALS --------------------
    // The crop of a cell, without instanceof: the occupant kept is the very object found in Board.getCrops (==, like
    // ShopWindow.currentCrop). A defense or an empty cell gives none.
    private static Optional<Crop> cropOn(Board board, List<Crop> crops, int row, int column) {
        return board.getCell(row, column).getOccupant()
                .flatMap(occupant -> crops.stream().filter(crop -> crop == occupant).findFirst());
    }

    // The bottom right corner of the cell: y grows upwards, so the bottom is cell.y() itself.
    private static Bounds dotOf(Bounds cell) {
        return new Bounds(cell.x() + cell.width() - DOT_SIZE - DOT_INSET, cell.y() + DOT_INSET, DOT_SIZE, DOT_SIZE);
    }
}
