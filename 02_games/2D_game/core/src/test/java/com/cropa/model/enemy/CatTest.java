package com.cropa.model.enemy;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cropa.model.world.Farm;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.Test;

// The farmer's cat (rules §9): it attacks nobody, runs away when an enemy comes onto it, and meows at random in a
// bubble, without sound. It sits at the top of row 1, half a cell from the farm (point "cat" of map_v1.tmx).
// It only reads the enemies (EnemyView): the tests give it real bats, placed with moveTo (same package).
// The chance is made predictable: a Random whose nextInt always gives the same number (0 = meow, 1 = no meow).
class CatTest {

  private final EnemyConfig config = new EnemyConfig();
  private final Farm farm = new Farm(config.getFarmHealth());

  // A Random whose draw is known: nextInt(30) always gives this number. 0 is the winning draw (1 chance in 30).
  private static Random drawAlways(int value) {
    return new Random() {
      @Override
      public int nextInt(int bound) {
        return value;
      }
    };
  }

  // The same, but it also counts its draws: to check when the cat draws, and when it does not.
  private static class CountingRandom extends Random {
    private int draws;

    @Override
    public int nextInt(int bound) {
      draws++;
      return 0;
    }
  }

  // A bat on a row, with that many cells left to the farm.
  private Bat batAt(int row, float cellsToFarm) {
    Bat bat = new Bat(1, farm, config);
    bat.moveTo(row, cellsToFarm);
    return bat;
  }

  // -------------------- A NEW CAT --------------------

  @Test
  void newCatNeitherFleesNorMeows() {
    Cat cat = new Cat(drawAlways(0));

    assertFalse(cat.isFleeing());
    assertFalse(cat.isMeowing());
  }

  // -------------------- FLEEING --------------------

  // The landmark of the day sheet: row 1, 1 cell from the farm: on the cat (it sits at 0.5 cell).
  @Test
  void batOnRowOneOneCellFromTheFarmMakesItFlee() {
    Cat cat = new Cat(drawAlways(1));

    cat.update(0.1f, List.of(batAt(1, 1f)));

    assertTrue(cat.isFleeing());
  }

  @Test
  void batOnRowOneTwoCellsAwayDoesNotScareIt() {
    Cat cat = new Cat(drawAlways(1));

    cat.update(0.1f, List.of(batAt(1, 2f)));

    assertFalse(cat.isFleeing());
  }

  // Row 2 is the row of the farmer, not of the cat: even half a cell from the farm, it does not flee.
  @Test
  void batOnRowTwoHalfACellAwayDoesNotScareIt() {
    Cat cat = new Cat(drawAlways(1));

    cat.update(0.1f, List.of(batAt(2, 0.5f)));

    assertFalse(cat.isFleeing());
  }

  // isOnBoard is false for a dead enemy: lying next to the cat, it scares nobody.
  @Test
  void deadEnemyNextToItDoesNotScareIt() {
    Cat cat = new Cat(drawAlways(1));
    Bat bat = batAt(1, 0.5f);
    bat.takeDamage(bat.getHealth());

    cat.update(0.1f, List.of(bat));

    assertFalse(cat.isFleeing());
  }

  // The enemy dies: at the next frame, the cat stops fleeing.
  @Test
  void catStopsFleeingOnceTheEnemyIsGone() {
    Cat cat = new Cat(drawAlways(1));
    Bat bat = batAt(1, 0.5f);
    cat.update(0.1f, List.of(bat));
    assertTrue(cat.isFleeing());

    bat.takeDamage(bat.getHealth());
    cat.update(0.1f, List.of(bat));

    assertFalse(cat.isFleeing());
  }

  // -------------------- MEOWING --------------------

  // The landmark of the day sheet: the first draw after 1 s wins, the meow lasts 2 s.
  @Test
  void aWinningDrawStartsAMeowOfTwoSeconds() {
    Cat cat = new Cat(drawAlways(0));

    cat.update(1f, List.of());
    assertTrue(cat.isMeowing());

    cat.update(2f, List.of());
    assertFalse(cat.isMeowing());
  }

  // No draw before a whole second.
  @Test
  void noDrawBeforeASecond() {
    Cat cat = new Cat(drawAlways(0));

    cat.update(0.9f, List.of());

    assertFalse(cat.isMeowing());
  }

  // "Really not often" (Axel, day 12): each draw is nextInt(30), so 0, the winning draw, comes 1 time in 30.
  // A Random that keeps the bound it is asked for: the bound is the chance.
  @Test
  void eachDrawIsOneChanceInThirty() {
    List<Integer> bounds = new ArrayList<>();
    Cat cat = new Cat(new Random() {
      @Override
      public int nextInt(int bound) {
        bounds.add(bound);
        return 1;
      }
    });

    cat.update(1f, List.of());

    assertEquals(List.of(30), bounds);
  }

  // 29 chances in 30: a losing draw, no meow.
  @Test
  void aLosingDrawStartsNoMeow() {
    Cat cat = new Cat(drawAlways(1));

    for (int second = 0; second < 5; second++) {
      cat.update(1f, List.of());
    }

    assertFalse(cat.isMeowing());
  }

  // A meow in progress ends before the next draw: no draw during the 2 s of the meow, then the clock of the draws
  // starts again, so the next draw comes 1 s after the end of the meow.
  @Test
  void noDrawDuringAMeowAndTheNextOneASecondAfterIt() {
    CountingRandom random = new CountingRandom();
    Cat cat = new Cat(random);

    cat.update(1f, List.of());
    assertEquals(1, random.draws);

    cat.update(1f, List.of());
    cat.update(1f, List.of());
    assertEquals(1, random.draws);
    assertFalse(cat.isMeowing());

    cat.update(1f, List.of());
    assertEquals(2, random.draws);
    assertTrue(cat.isMeowing());
  }

  // -------------------- FLEEING AND MEOWING --------------------

  // The landmark of the day sheet: the winning Random, with an enemy on it: it flees and does not meow.
  @Test
  void aFleeingCatDoesNotMeow() {
    Cat cat = new Cat(drawAlways(0));

    cat.update(1f, List.of(batAt(1, 0.5f)));

    assertTrue(cat.isFleeing());
    assertFalse(cat.isMeowing());
  }

  // An enemy comes during a meow: the meow stops at once. No draw during the flight: once the enemy is gone, the
  // next draw comes 1 s later, not at once.
  @Test
  void anEnemyStopsTheMeowAndTheDrawsUntilItIsGone() {
    CountingRandom random = new CountingRandom();
    Cat cat = new Cat(random);
    cat.update(1f, List.of());
    assertTrue(cat.isMeowing());
    Bat bat = batAt(1, 0.5f);

    cat.update(0.5f, List.of(bat));
    assertFalse(cat.isMeowing());
    cat.update(5f, List.of(bat));
    assertEquals(1, random.draws);

    bat.takeDamage(bat.getHealth());
    cat.update(0.5f, List.of(bat));
    assertFalse(cat.isMeowing());
    cat.update(0.5f, List.of(bat));
    assertTrue(cat.isMeowing());
    assertEquals(2, random.draws);
  }

  // -------------------- TIME --------------------

  @Test
  void zeroOrNegativeDeltaIsIgnored() {
    CountingRandom random = new CountingRandom();
    Cat cat = new Cat(random);

    cat.update(0f, List.of());
    cat.update(-5f, List.of());

    assertEquals(0, random.draws);
    assertFalse(cat.isMeowing());
  }

  // Time stands still, but the cat still looks: an enemy on it makes it flee even with a delta of 0.
  @Test
  void catLooksAtTheEnemiesEvenWithoutTime() {
    Cat cat = new Cat(drawAlways(1));

    cat.update(0f, List.of(batAt(1, 0.5f)));

    assertTrue(cat.isFleeing());
  }
}
