package com.cropa.model.enemy;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.cropa.model.world.Farm;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

// Day 14 (feedback of the mid-term jury): in front of the farm, the bat and the witch show their attack image for
// 0.3 s after each hit, and their walking image between two hits, like the defenses (Defense.isAttacking).
// Before, they kept the attack image as soon as they arrived: the player never saw the hits.
// The times are computed from the config: the first hit comes at the arrival (first delay 0 s), the next one a
// cooldown later (5 s). 0.3 s is the length of the pose asked by the day sheet, the same as the defenses.
class LaneEnemyAttackPoseTest {

  private static final float POSE = 0.3f;

  private final EnemyConfig config = new EnemyConfig();
  // About 33.3 s for the witch (10 cells at 0.3 cell/s), about 28.6 s for the bat (at 0.35).
  private final float witchArrival = config.getSpawnCellsToFarm() / config.getSpeed(EnemyType.WITCH);
  private final float batArrival = config.getSpawnCellsToFarm() / config.getSpeed(EnemyType.BAT);
  private final float firstHit = config.getFirstFarmHitDelay();
  private final float cooldown = config.getFarmHitCooldown();
  private final int witchDamage = config.getFarmDamage(EnemyType.WITCH);

  private Farm farm;
  private Witch witch;

  @BeforeEach
  void createAWitchOnRowTwo() {
    farm = new Farm(config.getFarmHealth());
    witch = new Witch(2, farm, config);
  }

  // The landmark of the day sheet: just after the first hit, at the arrival, the attack image.
  @Test
  void theWitchShowsHerAttackImageRightAfterHerFirstHit() {
    witch.update(witchArrival + firstHit + 0.1f);

    assertEquals(config.getFarmHealth() - witchDamage, farm.getHealth());
    assertEquals("witch_attack", witch.spriteKey());
  }

  // 0.3 s after the hit, she is back to her walking image, still in front of the farm and with no new hit.
  @Test
  void theWitchIsBackToHerWalkingImageOnceThePoseIsOver() {
    witch.update(witchArrival + firstHit + 0.1f);
    witch.update(POSE);

    assertEquals(0f, witch.getCellsToFarm(), 0.001f);
    assertEquals(config.getFarmHealth() - witchDamage, farm.getHealth());
    assertEquals("witch", witch.spriteKey());
  }

  // Edges of the pose: still the attack image a little before 0.3 s, the walking image a little after.
  @Test
  void thePoseLastsAboutThreeTenthsOfASecond() {
    witch.update(witchArrival + firstHit + 0.05f);
    witch.update(POSE - 0.1f);

    assertEquals("witch_attack", witch.spriteKey());

    witch.update(0.1f);

    assertEquals("witch", witch.spriteKey());
  }

  // The next hit, one cooldown later (5 s), starts the pose again.
  @Test
  void theNextHitShowsTheAttackImageAgain() {
    witch.update(witchArrival + firstHit + 0.1f);
    witch.update(cooldown - 0.2f);

    assertEquals("witch", witch.spriteKey());

    witch.update(0.2f);

    assertEquals(config.getFarmHealth() - 2 * witchDamage, farm.getHealth());
    assertEquals("witch_attack", witch.spriteKey());
  }

  // One long frame gives the same image as many small ones (like every LaneEnemy rule): the first hit was 1 s ago,
  // at the arrival, so the pose is over even though the hit happened during this very frame.
  @Test
  void aLongFrameDoesNotShowAHitThatIsAlreadyOver() {
    witch.update(witchArrival + firstHit + 1f);

    assertEquals(config.getFarmHealth() - witchDamage, farm.getHealth());
    assertEquals("witch", witch.spriteKey());
  }

  // On the way, before any hit, the walking image.
  @Test
  void theWitchWalksWithHerWalkingImageBeforeTheFarm() {
    witch.update(witchArrival - 1f);

    assertEquals("witch", witch.spriteKey());
  }

  // The same rule for the bat: it is written once, in LaneEnemy.
  @Test
  void theBatShowsItsAttackImageAfterAHitThenItsFlyingImage() {
    Bat bat = new Bat(2, farm, config);

    bat.update(batArrival + firstHit + 0.1f);

    assertEquals("bat_attack", bat.spriteKey());

    bat.update(POSE);

    assertEquals("bat", bat.spriteKey());
  }
}
