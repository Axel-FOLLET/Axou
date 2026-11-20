package com.cropa.model.enemy;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cropa.model.world.Board;
import com.cropa.model.world.Crop;
import com.cropa.model.world.CropConfig;
import com.cropa.model.world.CropType;
import com.cropa.model.world.DefenseLine;
import com.cropa.model.world.Farm;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

// Rules §7, §8, §10: an enemy that flees along row 0 or row 4 wears the defenses of that line, by its own wear
// (bat -10 %, witch -20 %), once per column, from the column where it arrives on the line to column 5.
// The enemy never sees a defense: it calls DefenseLine.wearAt. Here a fake DefenseLine writes down its calls.
class LaneEnemyWearTest {

  // One call of wearAt, as the fake line writes it down.
  private record Wear(int row, int column, int percent) {
  }

  private final EnemyConfig config = new EnemyConfig();
  private final CropConfig cropConfig = new CropConfig();
  private final int witchWear = config.getDefenseWear(EnemyType.WITCH);
  private final int batWear = config.getDefenseWear(EnemyType.BAT);

  private Board board;
  private Farm farm;
  private List<Wear> wears;
  // The fake: a lambda, since DefenseLine has one method only. It writes down each call.
  private DefenseLine line;

  @BeforeEach
  void createAnEmptyBoard() {
    board = new Board();
    farm = new Farm(config.getFarmHealth());
    wears = new ArrayList<>();
    line = (row, column, percent) -> wears.add(new Wear(row, column, percent));
  }

  private void closeColumnWith(int column, CropType type) {
    for (int row = 1; row <= 3; row++) {
      board.getCell(row, column).place(new Crop(type, cropConfig));
    }
  }

  // Small frames until the enemy has fled (back to its starting point), 60 s at most.
  private static void runUntilFled(Enemy enemy) {
    for (int frame = 0; frame < 1200 && !enemy.hasFled(); frame++) {
      enemy.update(0.05f);
    }
  }

  // -------------------- THE LANDMARKS OF THE DAY SHEET --------------------

  // Row 1, column 5 closed: she leaves by row 0 at column 5, and that column is worn once, by 20 %.
  @Test
  void witchBlockedInColumnFiveWearsItOnce() {
    closeColumnWith(5, CropType.TURNIP);
    Witch witch = new Witch(1, farm, board, config, line, new Random(1));

    runUntilFled(witch);

    assertTrue(witch.hasFled());
    assertEquals(List.of(new Wear(0, 5, witchWear)), wears);
  }

  // Column 3 closed: she arrives on row 0 at column 3, then goes back through columns 4 and 5. Once each.
  @Test
  void witchBlockedInColumnThreeWearsColumnsThreeFourAndFive() {
    closeColumnWith(3, CropType.TURNIP);
    Witch witch = new Witch(1, farm, board, config, line, new Random(1));

    runUntilFled(witch);

    assertEquals(
        List.of(new Wear(0, 3, witchWear), new Wear(0, 4, witchWear), new Wear(0, 5, witchWear)), wears);
  }

  // The bat wears by its own number: 10 instead of 20, on the flee row it took.
  @Test
  void batWearsByTenInsteadOfTwenty() {
    closeColumnWith(5, CropType.GARLIC);
    Bat bat = new Bat(2, farm, board, config, line, new Random(1));

    runUntilFled(bat);

    assertEquals(1, wears.size());
    Wear wear = wears.get(0);
    assertTrue(wear.row() == Enemy.TOP_FLEE_ROW || wear.row() == Enemy.BOTTOM_FLEE_ROW);
    assertEquals(5, wear.column());
    assertEquals(batWear, wear.percent());
  }

  // Not fleeing: no wearAt, neither on the way to the farm nor in front of it.
  @Test
  void noWearOutsideTheFlight() {
    Witch witch = new Witch(2, farm, board, config, line, new Random(1));

    witch.update(60f);

    assertTrue(farm.getHealth() < config.getFarmHealth());
    assertEquals(List.of(), wears);
  }

  // Turning aside is not fleeing: one turnip, she goes to another row of the field and wears nothing.
  @Test
  void turningAsideWearsNothing() {
    board.getCell(1, 5).place(new Crop(CropType.TURNIP, cropConfig));
    Witch witch = new Witch(1, farm, board, config, line, new Random(1));

    witch.update(60f);

    assertEquals(List.of(), wears);
  }

  // -------------------- MORE CASES --------------------

  // Row 3 leaves by row 4: the wear goes to the line of the bottom defenses.
  @Test
  void witchOfRowThreeWearsTheBottomLine() {
    closeColumnWith(5, CropType.TURNIP);
    Witch witch = new Witch(3, farm, board, config, line, new Random(1));

    runUntilFled(witch);

    assertEquals(List.of(new Wear(4, 5, witchWear)), wears);
  }

  // Long frames: the first one ends at column 3 (the rest of the frame is not used), the second one takes her
  // back to her start in one go. Columns 4 and 5 are crossed in a single frame: both are still worn, once.
  @Test
  void longFramesStillWearEveryColumnOnce() {
    closeColumnWith(3, CropType.TURNIP);
    Witch witch = new Witch(1, farm, board, config, line, new Random(1));

    witch.update(60f);
    witch.update(60f);

    assertTrue(witch.hasFled());
    assertEquals(
        List.of(new Wear(0, 3, witchWear), new Wear(0, 4, witchWear), new Wear(0, 5, witchWear)), wears);
  }

  // The day breaks while she goes back, in column 4: she is gone, column 5 is never worn.
  @Test
  void dawnStopsTheWear() {
    closeColumnWith(3, CropType.TURNIP);
    Witch witch = new Witch(1, farm, board, config, line, new Random(1));
    witch.update(60f);
    // From 6 cells (edge of column 3) to 6.5: inside column 4.
    witch.update(0.5f / config.getSpeed(EnemyType.WITCH) + 0.1f);
    assertEquals(2, wears.size());

    witch.flee();
    witch.update(60f);

    assertEquals(List.of(new Wear(0, 3, witchWear), new Wear(0, 4, witchWear)), wears);
  }
}
