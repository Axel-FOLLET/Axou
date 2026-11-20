package com.cropa.model.game;

// JUnit: assertion helpers and the @Test marker. Random: GameSession takes one.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

// The bramble, the one defense that changes at dawn, and the offer it is bought through.
import com.cropa.model.defense.Bramble;
import com.cropa.model.defense.DefenseOffer;
import com.cropa.model.defense.DefenseType;
// A bat and its numbers: the enemy added by hand to see it flee at dawn.
import com.cropa.model.enemy.Bat;
import com.cropa.model.enemy.Enemy;
import com.cropa.model.enemy.EnemyConfig;
// The field: a cell, and the carrots the test plants on it.
import com.cropa.model.world.Cell;
import com.cropa.model.world.Crop;
import com.cropa.model.world.CropConfig;
import com.cropa.model.world.CropType;
import java.util.Random;
import org.junit.jupiter.api.Test;

/**
 * Tests for {@link DayState}: the player may act, and the day starts with the dawn.
 */
class DayStateTest {

  // -------------------- HELPERS --------------------
  // A real session at the start of night 1, to start the day on. The field starts empty and the wave comes after 5 s:
  // each test plants its carrots or adds its bat itself.
  /** Creates a session with the default configuration, at the start of night 1. */
  private GameSession newSession() {
    GameSession session = new GameSession(new GameConfig(), new Random(0));
    session.getCycle().launchNight(session);
    return session;
  }

  // -------------------- TESTS --------------------
  // The rules: buying, harvesting and upgrading are allowed by day.
  /** The player may act by day. */
  @Test
  void playerMayActByDay() {
    assertTrue(new DayState().canAct());
  }

  // The day starts with the dawn: every crop grows one stage. Two carrots planted by the test, both at stage 0.
  /** Entering the day makes every crop grow one stage. */
  @Test
  void enterMakesEveryCropGrow() {
    GameSession session = newSession();
    Crop first = new Crop(CropType.CARROT, new CropConfig());
    Crop second = new Crop(CropType.CARROT, new CropConfig());
    session.getBoard().getCell(1, 1).place(first);
    session.getBoard().getCell(3, 3).place(second);

    new DayState().enter(session);

    assertEquals(1, first.getStage());
    assertEquals(1, second.getStage());
  }

  // The enemies still on the field at dawn run away.
  // Day 10: the bat is added by hand: the night no longer starts with the bat of the POC, its wave comes after 5 s.
  /** Entering the day makes every enemy flee. */
  @Test
  void enterMakesEveryEnemyFlee() {
    GameSession session = newSession();
    Enemy bat = new Bat(2, session.getFarm(), new EnemyConfig());
    session.addEnemy(bat);

    new DayState().enter(session);

    assertTrue(bat.hasFled());
  }

  // The dawn also wakes the defenses: DayState calls onDawn on each one, the bramble grows.
  /** Entering the day calls onDawn on every defense: a young bramble becomes active. */
  @Test
  void enterCallsOnDawnOnEveryDefense() {
    GameSession session = newSession();
    DefenseOffer brambleOffer = session.getShop().getDefenseOffers().stream()
        .filter(offer -> offer.getType() == DefenseType.BRAMBLE)
        .findFirst()
        .orElseThrow();
    Cell cell = session.getBoard().getCell(2, 3);
    session.getShop().buyDefense(brambleOffer, cell);
    Bramble bramble = assertInstanceOf(Bramble.class, session.getDefenseSlots().getDefenseOn(cell).orElseThrow());

    new DayState().enter(session);

    assertTrue(bramble.isActive());
  }
}
