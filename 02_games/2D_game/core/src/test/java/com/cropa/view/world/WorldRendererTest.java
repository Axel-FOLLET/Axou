package com.cropa.view.world;

// JUnit: the checks and the annotation that marks a test.
import static org.junit.jupiter.api.Assertions.assertEquals;

// The fake canvas that records its calls, and a real layout of the 15 cells.
import com.cropa.model.world.FieldView;
import com.cropa.view.BoardLayout;
import com.cropa.view.RecordingCanvas;
import com.cropa.view.TestLayouts;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

// No window and no libGDX: the renderer draws on a RecordingCanvas, and the field is a lambda.
/**
 * Tests that the world renderer asks for the map and for the right sprite on the right cell.
 */
class WorldRendererTest {

  // -------------------- FIELDS --------------------
  // A fresh canvas and layout for each test: JUnit creates a new instance per test.
  private final BoardLayout layout = TestLayouts.layout();
  private final RecordingCanvas canvas = new RecordingCanvas();
  private final WorldRenderer renderer = new WorldRenderer(layout);

  // -------------------- TESTS --------------------
  // Without this test, the map could be drawn last and hide every crop.
  @Test
  void drawsTheMapFirst() {
    renderer.render(canvas, (row, column) -> Optional.of("carrot_0"));
    assertEquals("map", canvas.calls.get(0));
  }

  // One carrot on r2c3: the map, then exactly one sprite, on the bounds of that cell.
  @Test
  void drawsACropOnItsCell() {
    FieldView field = (row, column) -> row == 2 && column == 3 ? Optional.of("carrot_0") : Optional.empty();
    renderer.render(canvas, field);
    assertEquals(List.of("map", "sprite carrot_0 " + layout.getCellBounds(2, 3)), canvas.calls);
  }

  // Without this test, an empty cell could still ask for a sprite.
  @Test
  void drawsNothingOnAnEmptyCell() {
    renderer.render(canvas, (row, column) -> Optional.empty());
    assertEquals(List.of("map"), canvas.calls);
  }
}