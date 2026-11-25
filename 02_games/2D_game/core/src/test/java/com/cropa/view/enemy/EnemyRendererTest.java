package com.cropa.view.enemy;

// JUnit: the checks and the annotations. Java: the lists of calls and of enemies.
import static org.junit.jupiter.api.Assertions.assertEquals;

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
import com.cropa.view.fx.Effects;
import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

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

    assertArrival("sprite bat " + Bounds.centeredOn(new Point(272, 168), ENEMY_SIZE));
  }

  // In front of the farm (0 cells left, x = 112), just after its first hit: the bat arrives after 10 cells at its
  // speed (about 28.6 s), hits at once (first delay 0 s), and shows its attack image for 0.3 s (day 14).
  @Test
  void drawsTheAttackImageInFrontOfTheFarmJustAfterAHit() {
    float arrival = config.getSpawnCellsToFarm() / config.getSpeed(EnemyType.BAT);
    bat.update(arrival + config.getFirstFarmHitDelay() + 0.1f);

    renderer.render(canvas, List.of(bat), 0f);

    assertArrival("sprite bat_attack " + Bounds.centeredOn(new Point(112, 168), ENEMY_SIZE));
  }

  // Asked by Axel: the witch at the size of the old Garry. 28 px instead of one cell, centred on the same point.
  @Test
  void drawsTheWitchBiggerThanOneCell() {
    Witch witch = new Witch(2, new Farm(config.getFarmHealth()), config);

    renderer.render(canvas, List.of(witch), 0f);

    assertArrival("sprite witch " + Bounds.centeredOn(new Point(272, 168), 28f));
  }

  // Day 14: a witch that leaves by a flee row is drawn from behind ("witch_back", east-witch.png), at her own size:
  // the 28 px of her other images, not one cell. An enemy of the test's own gives the key, at row 2 like the others.
  // Without this test, the witch would shrink to 16 px as soon as she turns her back.
  @Test
  void drawsTheWitchFromBehindAtHerOwnSize() {
    renderer.render(canvas, List.of(enemyShowing("witch_back")), 0f);

    assertArrival("sprite witch_back " + Bounds.centeredOn(new Point(272, 168), 28f));
  }

  // The bat from behind keeps one cell, like its other images.
  @Test
  void drawsTheBatFromBehindOnOneCell() {
    renderer.render(canvas, List.of(enemyShowing("bat_back")), 0f);

    assertArrival("sprite bat_back " + Bounds.centeredOn(new Point(272, 168), ENEMY_SIZE));
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

    assertArrival("sprite bat " + Bounds.centeredOn(new Point(272, 168), ENEMY_SIZE));
  }

  // A first frame to see its health, then a hit of 1: the next frame draws the bat in red.
  @Test
  void drawsAHitEnemyInRed() {
    renderer.render(new RecordingCanvas(), List.of(bat), 0.016f);
    bat.takeDamage(1);

    renderer.render(canvas, List.of(bat), 0.016f);

    assertArrival("sprite bat " + Bounds.centeredOn(new Point(272, 168), ENEMY_SIZE) + " HURT");
  }

  // Read the body between the ground shadow and the cloud.
  private void assertArrival(String body) {
    assertEquals(3, canvas.calls.size());
    assertEquals(true, canvas.calls.get(0).startsWith("sprite shadow "));
    assertEquals(body, canvas.calls.get(1));
    assertEquals(true, canvas.calls.get(2).startsWith("sprite puff "));
  }

  // Clear the recording so each assertion describes one frame.
  private List<String> frame(float delta, EnemyView... visible) {
    canvas.calls.clear();
    canvas.extras.clear();
    renderer.render(canvas, List.of(visible), delta);
    return canvas.calls.stream().map(call -> call.split(" ")[1]).toList();
  }

  // The last hit can happen between the last visible frame and removal.
  @Test
  void removedBatDiesThenDissolves() {
    frame(0, bat);
    bat.takeDamage(bat.getHealth());
    assertEquals(List.of("shadow", "bat_death"), frame(0));
    assertEquals(List.of("puff"), frame(0.49f));
    assertEquals(List.of(), frame(0.33f));
  }

  // Survivors at dawn must turn together and fade on the way out.
  @Test
  void survivorsTurnTogetherAndMoveRight() {
    EnemyView witch = enemyShowing("witch");
    frame(0, bat, witch);
    assertEquals(List.of("shadow", "bat_back", "shadow", "witch_back"), frame(0));
    frame(0.4f);
    assertEquals(true, canvas.extras.stream().anyMatch(c -> c.startsWith("styled witch_back") && c.contains("alpha=0.5")));
    assertEquals("sprite witch_back " + Bounds.centeredOn(layout.toScreen(2, 11), 28), canvas.calls.get(3));
    assertEquals(List.of("puff", "puff"), frame(0.41f));
    assertEquals(List.of(), frame(0.33f));
  }

  // Only the exposed mole casts a shadow during its meal.
  @Test
  void moleTravelsEmergesEatsAndDives() {
    EnemyView mole = enemyShowing("mole");
    assertEquals(List.of("mole_mound", "puff"), frame(0, mole));
    assertEquals("sprite mole_mound " + Bounds.centeredOn(layout.toScreen(2, 11.5f), 16), canvas.calls.get(0));
    assertEquals(List.of("shadow", "mole_emerge"), frame(0.37f, mole));
    assertEquals(List.of("shadow", "mole"), frame(0.3f, mole));
    assertEquals(List.of("shadow", "mole_emerge"), frame(0));
    assertEquals(List.of("mole_mound"), frame(0.31f));
    assertEquals(List.of(), frame(0.36f));
  }

  // Use the real service so these checks also cover the coordinates sent to the canvas.
  private Effects enableEffects() {
    Effects effects = new Effects(new Random(1));
    renderer = new EnemyRenderer(layout, effects);
    return effects;
  }

  // Read every particle before it moves, including any unexpected kind or duplicate.
  private void assertBurst(Effects effects, String key, float x, float y, int count) {
    canvas.extras.clear();
    effects.renderParticles(canvas);
    assertEquals(count, canvas.extras.size());
    String prefix = "particle " + key + " " + x + " " + y + " ";
    assertEquals(count, canvas.extras.stream().filter(call -> call.startsWith(prefix)).count());
  }

  // A second render at the same health must not add a damage number.
  @Test
  void damageAppearsOnceAboveTheWitch() {
    Effects effects = enableEffects();
    Witch witch = new Witch(2, new Farm(config.getFarmHealth()), config);
    frame(0, witch);
    witch.takeDamage(3);
    frame(0, witch);
    frame(0, witch);
    canvas.extras.clear();
    effects.renderTexts(canvas);
    assertEquals(List.of("float 3 272.0 182.0 1.0 ALERT"), canvas.extras);
  }

  // The model can remove the victim before its last health is drawn.
  @Test
  void lethalDamageSurvivesRemoval() {
    Effects effects = enableEffects();
    frame(0, bat);
    int health = bat.getHealth();
    bat.takeDamage(health);
    frame(0);
    frame(0);
    canvas.extras.clear();
    effects.renderTexts(canvas);
    assertEquals(List.of("float " + health + " 272.0 176.0 1.0 ALERT"), canvas.extras);
  }

  // The death pose lasts several frames but starts only one cloud of smoke.
  @Test
  void deathReleasesSixSmokeParticles() {
    Effects effects = enableEffects();
    frame(0, bat);
    assertBurst(effects, "fx_smoke", 272, 168, 0);
    bat.takeDamage(bat.getHealth());
    frame(0);
    frame(0.1f);
    assertBurst(effects, "fx_smoke", 272, 168, 6);
  }

  // A survivor leaves its smoke at the start of the retreat.
  @Test
  void flightReleasesSixSmokeParticles() {
    Effects effects = enableEffects();
    frame(0, bat);
    assertBurst(effects, "fx_smoke", 272, 168, 0);
    bat.flee();
    frame(0, bat);
    frame(0.1f);
    assertBurst(effects, "fx_smoke", 272, 168, 6);
  }

  // Pausing on the first mound frame must not disturb the soil twice.
  @Test
  void moundBreaksSoilOnce() {
    Effects effects = enableEffects();
    EnemyView mole = enemyShowing("mole");
    frame(0, mole);
    frame(0, mole);
    assertBurst(effects, "fx_dirt", 272, 160, 5);
  }

  // Clear the mound particles to isolate the moment the mole emerges.
  @Test
  void emergenceBreaksSoilOnce() {
    Effects effects = enableEffects();
    EnemyView mole = enemyShowing("mole");
    frame(0, mole);
    effects.update(1f);
    frame(0.35f, mole);
    assertBurst(effects, "fx_dirt", 272, 160, 0);
    frame(0.02f, mole);
    frame(0.1f, mole);
    assertBurst(effects, "fx_dirt", 272, 160, 5);
  }

  // A live mole leaves dirt instead of smoke when its meal ends.
  @Test
  void diveBreaksSoilOnce() {
    Effects effects = enableEffects();
    EnemyView mole = enemyShowing("mole");
    frame(0, mole);
    frame(0.7f, mole);
    effects.update(1f);
    frame(0);
    frame(0.1f);
    assertBurst(effects, "fx_dirt", 272, 160, 5);
  }

  // A new arrival or attack must not reset another enemy.
  @Test
  void arrivalAndAttackHaveIndependentClocks() {
    EnemyView second = enemyShowing("bat");
    frame(0, bat);
    frame(0.125f, bat, second);
    assertEquals(true, canvas.extras.stream().anyMatch(c -> c.startsWith("styled bat ")
        && c.contains("0.125 ") && c.contains("alpha=0.5") && c.contains("scaleX=0.8")));
    assertEquals(true, canvas.extras.stream().anyMatch(c -> c.startsWith("styled bat ")
        && c.contains("0.0 ") && c.contains("alpha=0.0") && c.contains("scaleX=0.6")));
    float arrival = config.getSpawnCellsToFarm() / config.getSpeed(EnemyType.BAT);
    bat.update(arrival + config.getFirstFarmHitDelay() + 0.1f);
    frame(0.125f, bat, second);
    assertEquals(true, canvas.extras.stream().anyMatch(c -> c.startsWith("styled bat_attack ")
        && c.contains(" 0.0 ") && c.contains("alpha=1.0")));
    assertEquals(true, canvas.extras.stream().anyMatch(c -> c.startsWith("styled bat ")
        && c.contains(" 0.125 ")));
  }
}
