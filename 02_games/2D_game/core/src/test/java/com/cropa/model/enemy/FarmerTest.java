package com.cropa.model.enemy;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cropa.model.world.Board;
import com.cropa.model.world.Cell;
import com.cropa.model.world.Crop;
import com.cropa.model.world.CropConfig;
import com.cropa.model.world.CropType;
import com.cropa.model.world.DefenseLine;
import com.cropa.model.world.Farm;
import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

// Old Garry (rules §9, §10): he never moves. He sits on row 2, in the cell from 1 to 2 cells left to the farm,
// and hits with his pitchfork the enemies of the square around him, 1 cell on each side (the team's rule, 12/11):
// rows 1 to 3, from 0 to 3 cells left to the farm. The last defense of the farm: the enemies that hit it are in
// reach; the field (more than 3 cells left) is not. 5 damage, 1 hit per second. The expected values come from
// the config. Only the farmer is updated here: the enemies stay where the test puts them.
class FarmerTest {

  // A defense line that does nothing: these tests are not about the wear (see LaneEnemyWearTest).
  private static final DefenseLine NO_WEAR = (row, column, percent) -> { };

  // An enemy in reach that cannot be hit: no real enemy is like this today (the mole is off the board while
  // underground), but the farmer must ask isTargetable anyway, like a defense.
  private static class UntargetableEnemy extends Enemy {
    UntargetableEnemy(EnemyConfig config) {
      super(EnemyType.WITCH, 2, config);
      moveTo(2, 0.5f);
    }

    @Override
    public void update(float delta) {
    }

    @Override
    public String spriteKey() {
      return "untargetable";
    }

    @Override
    public boolean isTargetable() {
      return false;
    }

    @Override
    public void onEnterCell(Cell cell) {
    }
  }

  private final EnemyConfig config = new EnemyConfig();
  private final CropConfig cropConfig = new CropConfig();
  private final int damage = config.getFarmerDamage();
  private final float cooldown = config.getFarmerCooldown();

  private Board board;
  private Farm farm;
  private Farmer farmer;

  @BeforeEach
  void createTheFarmer() {
    board = new Board();
    farm = new Farm(config.getFarmHealth());
    farmer = new Farmer(config);
  }

  // A witch on a row, with that many cells left to the farm (0: in front of the farm, hitting it).
  private Witch witchAt(int row, float cellsToFarm) {
    Witch witch = new Witch(1, farm, board, config, NO_WEAR, new Random(1));
    witch.moveTo(row, cellsToFarm);
    return witch;
  }

  private int fullHealth(EnemyType type) {
    return config.getHealth(type);
  }

  // -------------------- THE PACE (§10) --------------------

  // 5 damage, 1 hit per second. A witch hitting the farm on row 2: two seconds, 2 hits, 10 damage.
  @Test
  void witchHittingTheFarmTakesTwoHitsInTwoSeconds() {
    Witch witch = witchAt(2, 0f);

    farmer.update(1f, List.of(witch));
    farmer.update(1f, List.of(witch));

    assertEquals(fullHealth(EnemyType.WITCH) - 2 * damage, witch.getHealth());
  }

  // Ready from the start: the first hit comes at once, the next one a full cooldown later.
  @Test
  void firstHitComesAtOnceThenOneHitPerCooldown() {
    Witch witch = witchAt(2, 0f);

    farmer.update(0.1f, List.of(witch));
    assertEquals(fullHealth(EnemyType.WITCH) - damage, witch.getHealth());

    farmer.update(cooldown - 0.2f, List.of(witch));
    assertEquals(fullHealth(EnemyType.WITCH) - damage, witch.getHealth());

    farmer.update(0.2f, List.of(witch));
    assertEquals(fullHealth(EnemyType.WITCH) - 2 * damage, witch.getHealth());
  }

  // Nobody in reach: he stays ready, without keeping hits in reserve. The witch that arrives is hit at once,
  // and only once.
  @Test
  void withoutATargetHeStaysReadyWithoutStoringHits() {
    farmer.update(5f, List.of());
    Witch witch = witchAt(2, 0f);

    farmer.update(0.1f, List.of(witch));
    farmer.update(0.1f, List.of(witch));

    assertEquals(fullHealth(EnemyType.WITCH) - damage, witch.getHealth());
  }

  @Test
  void zeroOrNegativeDeltaIsIgnored() {
    Witch witch = witchAt(2, 0f);

    farmer.update(0f, List.of(witch));
    farmer.update(-1f, List.of(witch));

    assertEquals(fullHealth(EnemyType.WITCH), witch.getHealth());
  }

  // -------------------- THE SQUARE AROUND HIM --------------------

  // The 9 cells of the square: rows 1 to 3, the cells centred on 0.5, 1.5 and 2.5 cells left. His own cell counts:
  // an enemy of row 2 walks through it on its way to the farm.
  @Test
  void everyCellOfTheSquareAroundHimIsInReach() {
    for (int row = 1; row <= 3; row++) {
      for (float cellsToFarm = 0.5f; cellsToFarm < 3f; cellsToFarm++) {
        Farmer freshFarmer = new Farmer(config);
        Witch witch = witchAt(row, cellsToFarm);

        freshFarmer.update(1f, List.of(witch));

        assertEquals(fullHealth(EnemyType.WITCH) - damage, witch.getHealth(), "row " + row + ", " + cellsToFarm);
      }
    }
  }

  // The edges of the square: in front of the farm (0 cells) and the left edge of the field (3 cells).
  @Test
  void theEdgesOfTheSquareAreInReach() {
    Witch atTheFarm = witchAt(3, 0f);
    Witch atTheFieldEdge = witchAt(1, 3f);

    farmer.update(1f, List.of(atTheFarm));
    new Farmer(config).update(1f, List.of(atTheFieldEdge));

    assertEquals(fullHealth(EnemyType.WITCH) - damage, atTheFarm.getHealth());
    assertEquals(fullHealth(EnemyType.WITCH) - damage, atTheFieldEdge.getHealth());
  }

  // The field starts 2 cells from him: column 1 (r2c1, 3.5 cells left) is out of reach.
  @Test
  void enemyOnTheFirstColumnOfTheFieldIsNotHit() {
    Witch witch = witchAt(2, Enemy.CELLS_FROM_FIELD_TO_FARM + 0.5f);

    farmer.update(1f, List.of(witch));

    assertEquals(fullHealth(EnemyType.WITCH), witch.getHealth());
  }

  // The flee rows 0 and 4 are outside the square, even close to the farm.
  @Test
  void enemyOnAFleeRowIsNotHit() {
    Witch above = witchAt(0, 1.5f);
    Witch below = witchAt(4, 1.5f);

    farmer.update(1f, List.of(above, below));

    assertEquals(fullHealth(EnemyType.WITCH), above.getHealth());
    assertEquals(fullHealth(EnemyType.WITCH), below.getHealth());
  }

  // -------------------- THE MOLE --------------------

  // The mole only comes out on the field, more than 3 cells from the farm: out of reach, while it eats on r2c1
  // as well as underground afterwards. The team's choice: the farmer never hits a mole.
  @Test
  void moleIsNeverInReach() {
    board.getCell(2, 1).place(new Crop(CropType.CARROT, cropConfig));
    Mole mole = new Mole(board, config, new Random(1));

    mole.update(0.1f);
    assertTrue(mole.isTargetable());
    farmer.update(1f, List.of(mole));
    assertEquals(fullHealth(EnemyType.MOLE), mole.getHealth());

    mole.update(config.getMoleMealDuration());
    assertFalse(mole.isTargetable());
    farmer.update(1f, List.of(mole));
    assertEquals(fullHealth(EnemyType.MOLE), mole.getHealth());
  }

  // -------------------- WHO CAN BE HIT --------------------

  // In reach and on the board, but it says it cannot be hit: the farmer leaves it alone.
  @Test
  void enemyThatCannotBeTargetedIsNotHit() {
    Enemy hidden = new UntargetableEnemy(config);

    farmer.update(1f, List.of(hidden));

    assertEquals(fullHealth(EnemyType.WITCH), hidden.getHealth());
  }

  // A fled enemy is no longer on the board.
  @Test
  void fledEnemyIsNotHit() {
    Witch witch = witchAt(2, 0f);
    witch.flee();

    farmer.update(1f, List.of(witch));

    assertEquals(fullHealth(EnemyType.WITCH), witch.getHealth());
  }

  // Two enemies in reach: one hit per second, on the one closest to the farm (the one hitting it).
  @Test
  void oneHitPerCooldownOnTheEnemyClosestToTheFarm() {
    Witch closer = witchAt(2, 0f);
    Witch further = witchAt(1, 2.5f);

    farmer.update(1f, List.of(further, closer));

    assertEquals(fullHealth(EnemyType.WITCH) - damage, closer.getHealth());
    assertEquals(fullHealth(EnemyType.WITCH), further.getHealth());
  }

  // -------------------- WHERE HE LOOKS (day 14) --------------------
  // Feedback of the mid-term jury: at night, Garry stands up and turns to the enemy he hits, in the 4 directions of
  // his images. He sits in the middle of the cell from 1 to 2 cells left to the farm (1.5), on row 2. An enemy
  // closer to the farm than him is behind him: he turns round, west. Further than him, ahead: east, towards the
  // field. On row 1, above him: north; on row 3, below him: south. Diagonally, the larger gap decides; on a tie, the
  // row (north or south). The model keeps where he faces and the 0.3 s of his attack pose; FarmRenderer chooses the
  // image.

  // Before any hit: facing the field, no pose.
  @Test
  void heFacesTheFieldAndDoesNotAttackBeforeHisFirstHit() {
    assertEquals(Facing.EAST, farmer.getFacing());
    assertFalse(farmer.isAttacking());
  }

  // Yohan's remark (day 14): an enemy hitting the farm (0 cell) is behind him. He turns round to hit it.
  @Test
  void heTurnsRoundToHitAnEnemyBehindHim() {
    farmer.update(0.1f, List.of(witchAt(2, 0f)));

    assertEquals(Facing.WEST, farmer.getFacing());
    assertTrue(farmer.isAttacking());
  }

  // Ahead of him, on his row, coming from the field: east.
  @Test
  void heFacesEastAnEnemyAheadOfHim() {
    farmer.update(0.1f, List.of(witchAt(2, 2.8f)));

    assertEquals(Facing.EAST, farmer.getFacing());
  }

  // In his column (1.5 cells), on row 1 then on row 3: north, then south.
  @Test
  void heFacesNorthOrSouthAnEnemyRightAboveOrBelowHim() {
    farmer.update(0.1f, List.of(witchAt(1, 1.5f)));
    assertEquals(Facing.NORTH, farmer.getFacing());

    farmer.update(cooldown, List.of(witchAt(3, 1.5f)));
    assertEquals(Facing.SOUTH, farmer.getFacing());
  }

  // Diagonally, the larger gap decides: row 1 in front of the farm is 1.5 cells behind and 1 row above: west.
  // Row 3 at 2.8 cells is 1.3 cells ahead and 1 row below: east.
  @Test
  void diagonallyTheLargerGapDecides() {
    farmer.update(0.1f, List.of(witchAt(1, 0f)));
    assertEquals(Facing.WEST, farmer.getFacing());

    farmer.update(cooldown, List.of(witchAt(3, 2.8f)));
    assertEquals(Facing.EAST, farmer.getFacing());
  }

  // A tie: 1 cell behind (0.5 cell left) and 1 row above. The row wins: north.
  @Test
  void onATieTheRowDecides() {
    farmer.update(0.1f, List.of(witchAt(1, 0.5f)));

    assertEquals(Facing.NORTH, farmer.getFacing());
  }

  // The pose lasts about 0.3 s: still on a little before, over a little after. He keeps facing the same way.
  @Test
  void hisAttackPoseLastsAboutThreeTenthsOfASecond() {
    List<Enemy> enemies = List.of(witchAt(2, 0f));
    farmer.update(0.1f, enemies);

    farmer.update(0.2f, enemies);
    assertTrue(farmer.isAttacking());

    farmer.update(0.2f, enemies);
    assertFalse(farmer.isAttacking());
    assertEquals(Facing.WEST, farmer.getFacing());
  }

  // One cooldown later (1 s), the next hit starts the pose again, turned to the new target.
  @Test
  void theNextHitStartsThePoseAgainTurnedToItsTarget() {
    Witch closer = witchAt(2, 0f);
    Witch further = witchAt(2, 2.8f);
    farmer.update(0.1f, List.of(closer, further));
    assertEquals(Facing.WEST, farmer.getFacing());
    closer.flee();

    farmer.update(cooldown, List.of(closer, further));

    assertTrue(farmer.isAttacking());
    assertEquals(Facing.EAST, farmer.getFacing());
  }

  // Nobody left on the board (the night is over, or every enemy is dead or gone): once his pose is over, he faces
  // the field again, so the next night starts like the first one.
  @Test
  void heFacesTheFieldAgainOnceNoEnemyIsLeftOnTheBoard() {
    Witch witch = witchAt(2, 0f);
    witch.takeDamage(fullHealth(EnemyType.WITCH) - damage);
    farmer.update(0.1f, List.of(witch));
    assertTrue(witch.isDead());

    farmer.update(0.1f, List.of(witch));
    assertEquals(Facing.WEST, farmer.getFacing());

    farmer.update(0.3f, List.of(witch));
    assertEquals(Facing.EAST, farmer.getFacing());
  }

  // While an enemy is still on the board, out of his reach, he keeps facing his last target.
  @Test
  void heKeepsFacingHisLastTargetWhileAnEnemyIsStillOnTheBoard() {
    Witch hit = witchAt(1, 1.5f);
    farmer.update(0.1f, List.of(hit));
    hit.flee();

    farmer.update(1f, List.of(hit, witchAt(2, 6f)));

    assertEquals(Facing.NORTH, farmer.getFacing());
  }
}
