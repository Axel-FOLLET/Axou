package com.cropa.view.world;

// The model, read only: the sprite key of each cell. FieldView has no method that changes the field.
// Board: only its size (ROWS, COLUMNS), written once in the model (L5).
import com.cropa.model.enemy.Enemy;
import com.cropa.model.enemy.EnemyType;
import com.cropa.model.world.Board;
import com.cropa.model.world.FieldView;
// The view: the place of each cell on the screen, the rectangle of a cell, and what can be drawn.
import com.cropa.view.BoardLayout;
import com.cropa.view.Bounds;
import com.cropa.view.Canvas;
import com.cropa.view.Point;
import com.cropa.view.fx.Effects;
import java.util.List;

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
  // Gate bounds on map_v1 and the delay between neighbouring plants in seconds.
  private static final Bounds GATE = new Bounds(96, 128, 32, 48);
  private static final float PHASE_STEP = 0.17f;
  private final CropPose[][] poses = new CropPose[Board.ROWS][Board.COLUMNS];
  private final Effects effects;
  private float clock;

  // -------------------- CONSTRUCTOR --------------------
  // Called once when the screen opens. No image is loaded here: GdxCanvas loads and frees them.
  /**
   * Creates the renderer of the world.
   *
   * @param layout the place of each cell on the screen
   */
  public WorldRenderer(BoardLayout layout) {
    this(layout, null);
  }

  /** Creates a field renderer that sends harvest coins to the shared effects service. */
  public WorldRenderer(BoardLayout layout, Effects effects) {
    this.layout = layout;
    this.effects = effects;
    for (CropPose[] row : poses) {
      java.util.Arrays.setAll(row, column -> new CropPose());
    }
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
    render(canvas, field, false, List.of(), 0f);
  }

  /** Draws a frame using the visible enemies to locate feeding moles. */
  public void render(Canvas canvas, FieldView field, boolean night, List<Enemy> enemies, float delta) {
    render(canvas, field, night, enemies, delta, null);
  }

  /** Draws the live board and remembers the harvest value of each visible crop. */
  public void render(Canvas canvas, Board board, boolean night, List<Enemy> enemies, float delta) {
    render(canvas, board, night, enemies, delta, board);
  }

  private void render(Canvas canvas, FieldView field, boolean night, List<Enemy> enemies, float delta, Board board) {
    clock += delta;
    canvas.drawMap();
    for (int row = 1; row <= Board.ROWS; row++) {
      for (int column = 1; column <= Board.COLUMNS; column++) {
        Bounds cell = layout.getCellBounds(row, column);
        canvas.drawSprite("field_furrows", cell);
        boolean mole = false;
        for (Enemy enemy : enemies) {
          if (enemy.getType() == EnemyType.MOLE && enemy.isOnBoard() && enemy.getRow() == row) {
            Point point = layout.toScreen(row, enemy.getCellsToFarm());
            if (cell.contains(point.x(), point.y())) mole = true;
          }
        }
        float phase = ((row - 1) * Board.COLUMNS + column - 1) * PHASE_STEP;
        // The board exposes the harvest price while the occupant is still on the cell.
        Integer value = board == null ? null : board.getCell(row, column).getOccupant()
            .map(occupant -> occupant.onHarvested()).filter(price -> price.isPresent())
            .map(price -> price.getAsInt()).orElse(null);
        poses[row - 1][column - 1].draw(canvas, cell, field.spriteAt(row, column).orElse(null),
            night, mole, clock, phase, effects, value);
      }
    }
    canvas.drawSprite("gate_open", GATE);
  }
}