package com.cropa.view.world;

// The model, read only: the sprite key of each cell. FieldView has no method that changes the field.
// Board: only its size (ROWS, COLUMNS), written once in the model (L5).
import com.cropa.model.world.Board;
import com.cropa.model.world.FieldView;
// The view: the place of each cell on the screen, the rectangle of a cell, and what can be drawn.
import com.cropa.view.BoardLayout;
import com.cropa.view.Bounds;
import com.cropa.view.Canvas;

// The view of the world: it draws the map, then the sprite of each occupied cell. It knows no libGDX
// and no Crop: it asks the field for a sprite key and gives it to the canvas. A new occupant needs
// no change here, only one line in SpriteCatalog. The enemies and the defenses have their own renderers.
/**
 * Draws the map, then what stands on each cell of the field, on the rectangle of that cell.
 */
public class WorldRenderer {

  // -------------------- FIELDS --------------------
  // Turns a row and a column into a rectangle of the screen. Set once, never changed.
  private final BoardLayout layout;

  // -------------------- CONSTRUCTOR --------------------
  // Called once when the screen opens. No image is loaded here: GdxCanvas loads and frees them.
  /**
   * Creates the renderer of the world.
   *
   * @param layout the place of each cell on the screen
   */
  public WorldRenderer(BoardLayout layout) {
    this.layout = layout;
  }

  // -------------------- RENDERING --------------------
  // Called at each frame. The map comes first, so the sprites are drawn over it.
  // cellRow and cellColumn copy the loop counters: a lambda only uses variables that never change.
  /**
   * Draws the map, then the sprite of every occupied cell on its rectangle.
   *
   * @param canvas where to draw
   * @param field  the field to read, never changed
   */
  public void render(Canvas canvas, FieldView field) {
    canvas.drawMap();
    for (int row = 1; row <= Board.ROWS; row++) {
      for (int column = 1; column <= Board.COLUMNS; column++) {
        int cellRow = row;
        int cellColumn = column;
        field.spriteAt(row, column).ifPresent(spriteKey -> {
          Bounds bounds = layout.getCellBounds(cellRow, cellColumn);
          canvas.drawSprite(spriteKey, bounds);
        });
      }
    }
  }
}