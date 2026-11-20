package com.cropa.view.enemy;

// JUnit: the checks and the annotations. Java: the lists of calls and of enemies.
import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

// The model: a real bat, its farm and its numbers. The view: the fake Canvas and the layout of map_v1.tmx.
import com.cropa.model.enemy.Bat;
import com.cropa.model.enemy.EnemyConfig;
import com.cropa.model.enemy.EnemyType;
import com.cropa.model.enemy.EnemyView;
import com.cropa.model.enemy.Witch;
import com.cropa.model.world.Farm;
import com.cropa.view.BoardLayout;
import com.cropa.view.Bounds;
import com.cropa.view.Point;
import com.cropa.view.RecordingCanvas;
import com.cropa.view.TestLayouts;

// No window and no libGDX: the renderer draws on a RecordingCanvas, which writes down each call.
class EnemyRendererTest {

  // The drawn size of an enemy, in world pixels: one cell.
  private static final float ENEMY_SIZE = 16f;

  private final EnemyConfig config = new EnemyConfig();
  private final BoardLayout layout = TestLayouts.layout();

  private RecordingCanvas canvas;
  private EnemyRenderer renderer;
  private Bat bat;

  @BeforeEach
  void createABatOnRowTwo() {
    canvas = new RecordingCanvas();
    renderer = new EnemyRenderer(layout);
    bat = new Bat(2, new Farm(config.getFarmHealth()), config);
  }

  // On map_v1.tmx, row 2 is centred on y = 168 and 10 cells from the farm is x = 272.
  @Test
  void drawsAWalkingBatAtItsPlace() {
    renderer.render(canvas, List.of(bat), 0f);

    assertEquals(List.of("sprite bat " + Bounds.centeredOn(new Point(272, 168), ENEMY_SIZE)), canvas.calls);
  }

  // In front of the farm (0 cells left, x = 112), just after its first hit: the bat arrives after 10 cells at its
  // speed (about 28.6 s), hits at once (first delay 0 s), and shows its attack image for 0.3 s (day 14).
  @Test
  void drawsTheAttackImageInFrontOfTheFarmJustAfterAHit() {
    float arrival = config.getSpawnCellsToFarm() / config.getSpeed(EnemyType.BAT);
    bat.update(arrival + config.getFirstFarmHitDelay() + 0.1f);

    renderer.render(canvas, List.of(bat), 0f);

    assertEquals(List.of("sprite bat_attack " + Bounds.centeredOn(new Point(112, 168), ENEMY_SIZE)), canvas.calls);
  }

  // Asked by Axel: the witch at the size of the old Garry. 28 px instead of one cell, centred on the same point.
  @Test
  void drawsTheWitchBiggerThanOneCell() {
    Witch witch = new Witch(2, new Farm(config.getFarmHealth()), config);

    renderer.render(canvas, List.of(witch), 0f);

    assertEquals(List.of("sprite witch " + Bounds.centeredOn(new Point(272, 168), 28f)), canvas.calls);
  }

  // Day 14: a witch that leaves by a flee row is drawn from behind ("witch_back", east-witch.png), at her own size:
  // the 28 px of her other images, not one cell. An enemy of the test's own gives the key, at row 2 like the others.
  // Without this test, the witch would shrink to 16 px as soon as she turns her back.
  @Test
  void drawsTheWitchFromBehindAtHerOwnSize() {
    renderer.render(canvas, List.of(enemyShowing("witch_back")), 0f);

    assertEquals(List.of("sprite witch_back " + Bounds.centeredOn(new Point(272, 168), 28f)), canvas.calls);
  }

  // The bat from behind keeps one cell, like its other images.
  @Test
  void drawsTheBatFromBehindOnOneCell() {
    renderer.render(canvas, List.of(enemyShowing("bat_back")), 0f);

    assertEquals(List.of("sprite bat_back " + Bounds.centeredOn(new Point(272, 168), ENEMY_SIZE)), canvas.calls);
  }

  // Row 2, 10 cells from the farm (the entry point, x = 272), alive, showing the given key.
  private static EnemyView enemyShowing(String key) {
    return new EnemyView() {
      @Override
      public int getRow() {
        return 2;
      }

      @Override
      public float getCellsToFarm() {
        return 10f;
      }

      @Override
      public String spriteKey() {
        return key;
      }

      @Override
      public boolean isOnBoard() {
        return true;
      }

      @Override
      public int getHealth() {
        return 1;
      }
    };
  }

  @Test
  void doesNotDrawADeadEnemy() {
    bat.takeDamage(bat.getHealth());

    renderer.render(canvas, List.of(bat), 0f);

    assertEquals(List.of(), canvas.calls);
  }

  @Test
  void doesNotDrawAFledEnemy() {
    bat.flee();

    renderer.render(canvas, List.of(bat), 0f);

    assertEquals(List.of(), canvas.calls);
  }

  @Test
  void drawsEveryEnemyStillOnTheBoard() {
    Bat secondBat = new Bat(3, new Farm(config.getFarmHealth()), config);
    secondBat.flee();

    renderer.render(canvas, List.of(bat, secondBat), 0f);

    assertEquals(1, canvas.calls.size());
  }

  // A first frame to see its health, then a hit of 1: the next frame draws the bat in red.
  @Test
  void drawsAHitEnemyInRed() {
    renderer.render(new RecordingCanvas(), List.of(bat), 0.016f);
    bat.takeDamage(1);

    renderer.render(canvas, List.of(bat), 0.016f);

    assertEquals(List.of("sprite bat " + Bounds.centeredOn(new Point(272, 168), ENEMY_SIZE) + " HURT"), canvas.calls);
  }
}
