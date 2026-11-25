package com.cropa.view.world;

// JUnit: the checks and the annotation that marks a test.
import static org.junit.jupiter.api.Assertions.assertEquals;

// The fake canvas that records its calls, and a real layout of the 15 cells.
import com.cropa.model.world.Board;
import com.cropa.model.world.Crop;
import com.cropa.model.world.CropConfig;
import com.cropa.model.world.CropType;
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
    int crop = canvas.calls.indexOf("sprite carrot_0 " + layout.getCellBounds(2, 3));
    assertEquals("sprite field_furrows " + layout.getCellBounds(2, 3), canvas.calls.get(crop - 1));
  }

  // Without this test, an empty cell could still ask for a sprite.
  @Test
  void drawsNothingOnAnEmptyCell() {
    renderer.render(canvas, (row, column) -> Optional.empty());
    var expected = new java.util.ArrayList<>(List.of("map"));
    for (int row = 1; row <= com.cropa.model.world.Board.ROWS; row++) {
      for (int col = 1; col <= com.cropa.model.world.Board.COLUMNS; col++) {
        expected.add("sprite field_furrows " + layout.getCellBounds(row, col));
      }
    }
    expected.add("sprite gate_open " + new com.cropa.view.Bounds(96, 128, 32, 48));
    assertEquals(expected, canvas.calls);
  }

  @Test
  void fieldDefensesLeaveOnlyTheGroundForTheWorldToDraw() {
    renderer.render(canvas, (row, column) -> Optional.empty());
    List<String> ground = List.copyOf(canvas.calls);
    for (String key : List.of("scarecrow", "scarecrow_attack", "bramble_0", "bramble_1")) {
      canvas.calls.clear();
      renderer.render(canvas, (row, column) -> row == 2 && column == 3 ? Optional.of(key) : Optional.empty());
      assertEquals(ground, canvas.calls, key);
    }
  }

  // Keep one cell under observation across a sequence of frames.
  private final CropPose pose = new CropPose();
  private final com.cropa.view.fx.Effects effects = new com.cropa.view.fx.Effects(new java.util.Random(1));

  private void frame(String key, boolean night, boolean mole, float time) {
    canvas.extras.clear();
    pose.draw(canvas, layout.getCellBounds(1, 1), key, night, mole, time, 0f, effects, null);
  }

  private long count(String prefix) {
    return canvas.extras.stream().filter(call -> call.startsWith(prefix)).count();
  }

  private final Board board = new Board();
  private final WorldRenderer liveRenderer = new WorldRenderer(layout, effects);

  private void renderBoard() {
    canvas.extras.clear();
    liveRenderer.render(canvas, board, false, List.of(), 0f);
  }

  @Test
  void harvestShowsTheValueOfTheLastVisibleStage() {
    for (boolean mature : List.of(false, true)) {
      Crop carrot = new Crop(CropType.CARROT, new CropConfig());
      board.getCell(1, 1).place(carrot);
      renderBoard();
      if (mature) {
        carrot.grow();
        renderBoard();
      }
      board.getCell(1, 1).remove();
      renderBoard();
      renderBoard();
      effects.renderTexts(canvas);
      assertEquals(1, count("float "));
      assertEquals(1, count(mature ? "float +40 " : "float +5 "));
      effects.update(2f);
    }
  }

  @Test
  void harvestScattersLeavesAtTheCellCentre() {
    board.getCell(1, 1).place(new Crop(CropType.CARROT, new CropConfig()));
    renderBoard();
    board.getCell(1, 1).remove();
    renderBoard();
    renderBoard();
    effects.renderParticles(canvas);
    var cell = layout.getCellBounds(1, 1);
    assertEquals(8, count("particle fx_leaf " + (cell.x() + cell.width() / 2) + " "
        + (cell.y() + cell.height() / 2) + " "));
  }

  @Test
  void onlyPlantingScattersDirt() {
    Crop carrot = new Crop(CropType.CARROT, new CropConfig());
    renderBoard();
    board.getCell(1, 1).place(carrot);
    renderBoard();
    renderBoard();
    effects.renderParticles(canvas);
    assertEquals(8, count("particle fx_dirt "));
    effects.update(2f);
    carrot.grow();
    renderBoard();
    effects.renderParticles(canvas);
    assertEquals(0, count("particle fx_dirt "));
  }

  @Test
  void growsOnlyWhenTheSameVegetableAdvances() {
    frame("carrot_0", false, false, 0f);
    assertEquals(0, count("styled "));
    frame("pumpkin_1", false, false, 1f);
    assertEquals(0, count("styled "));
    frame("pumpkin_2", false, false, 2f);
    assertEquals(1, count("styled pumpkin_2 "));
    frame("pumpkin_2", false, false, 3f);
    assertEquals(1, count("animation pumpkin_2 "));
  }

  @Test
  void daytimeHarvestJumpsAndPaysOnce() {
    frame("pumpkin_2", false, false, 0f);
    frame(null, false, false, 0f);
    frame(null, false, false, .225f);
    assertEquals(1, count("styled pumpkin_2 "));
    org.junit.jupiter.api.Assertions.assertTrue(canvas.extras.get(0).contains("offsetY=10.0"));
    // The fifth coin starts after 0.20 s. All five are in flight at 0.225 s.
    effects.update(.225f);
    effects.renderParticles(canvas);
    assertEquals(5, count("particle fx_coin "));

    // Sample the last percent of each flight, just before Effects removes the coin.
    RecordingCanvas arrivals = new RecordingCanvas() {
      @Override
      public void drawParticle(String key, float x, float y, float size, float rotation, float alpha) {
        if ("fx_coin".equals(key) && alpha < .01f) {
          assertEquals(32f, x, 3f);
          assertEquals(312f, y, 3f);
          super.drawParticle(key, x, y, size, rotation, alpha);
        }
      }
    };
    for (int step = 0; step < 200; step++) {
      effects.update(.005f);
      effects.renderParticles(arrivals);
    }
    org.junit.jupiter.api.Assertions.assertTrue(arrivals.extras.size() >= 5);
    org.junit.jupiter.api.Assertions.assertTrue(effects.isEmpty());
    frame(null, false, false, 2f);
    assertEquals(0, count("styled "));
  }

  @Test
  void remembersTheMoleThatJustFinishedEating() {
    frame("turnip_2", true, true, 0f);
    frame(null, true, false, 1f);
    assertEquals(1, count("styled turnip_2_eaten "));
    frame(null, true, false, 2f);
    assertEquals(0, count("styled "));
  }

  @Test
  void tramplingFlattensThePlantAndIgnoresBramble() {
    frame("garlic_2", true, false, 0f);
    frame(null, true, false, 1f);
    frame(null, true, false, 1.3f);
    assertEquals(1, count("styled garlic_2 "));
    org.junit.jupiter.api.Assertions.assertTrue(canvas.extras.get(0).contains("scaleY=0.25"));
    frame("bramble", true, false, 2f);
    frame(null, true, false, 3f);
    assertEquals(0, count("styled "));
  }

  @Test
  void decorSwitchesBetweenDayAndNightLayers() {
    LivingDecor decor = new LivingDecor();
    decor.renderDay(canvas, false, 10f, 1f);
    decor.renderLights(canvas, false, 10f);
    assertEquals(4, count("styled butterfly"));
    assertEquals(1, count("styled cloud_shadow "));
    assertEquals(0, count("light firefly "));
    canvas.extras.clear();
    decor.renderDay(canvas, true, 10f, 1f);
    assertEquals(0, count("styled "));
    decor.renderLights(canvas, true, 10f);
    assertEquals(10, count("light firefly "));
  }
}