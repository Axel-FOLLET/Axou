package com.cropa.model.enemy;

// Comparator: to pick the enemy closest to the farm. List: the enemies of the game. Optional: maybe nobody in reach.
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

// Old Garry (rules §9, §10): he never moves. He sits in front of the farm, on row 2, in the cell from 1 to 2 cells
// left to the farm (the "farmer" spot of the map). The team's rule (12/11): his pitchfork reaches the square around
// him, 1 cell on each side: rows 1 to 3, from 0 to 3 cells left to the farm. He is the last defense of the farm:
// the enemies that hit it (0 cells left) are in reach; the field (more than 3 cells left) is not, so he never
// reaches a mole, which only comes out on the field. 4 damage (5 before day 10), 1 hit per second.
// He asks an enemy the same questions as a defense (isOnBoard, isTargetable, its row, its cells left), then calls
// takeDamage: no test on its type.
// The enemies are given at each update, not kept: the list of the game changes every frame (new enemies, dead or
// fled ones removed), and GameSession owns it. The farmer only reads it, at the moment he hits.
/**
 * The farmer: hits with his pitchfork an enemy of the square around him, at his own pace.
 */
public class Farmer {

    //-------------------- CONSTANTS --------------------
    // Where he sits: row 2, in the cell that starts 1 cell left to the farm (and ends 2 cells left).
    private static final int FARMER_ROW = 2;
    private static final int FARMER_CELL_START = 1;
    // The pitchfork reaches 1 cell on each side of his cell.
    private static final int REACH = 1;
    // So the square: rows 1 to 3, from 0 to 3 cells left to the farm.
    private static final int FIRST_ROW_IN_REACH = FARMER_ROW - REACH;
    private static final int LAST_ROW_IN_REACH = FARMER_ROW + REACH;
    private static final float FURTHEST_CELLS_IN_REACH = FARMER_CELL_START + 1 + REACH;
    // The middle of his cell (1.5 cells left to the farm): an enemy closer to the farm is behind him, a further one is
    // ahead of him. Used to choose where he faces (day 14).
    private static final float FARMER_CELL_MIDDLE = FARMER_CELL_START + 0.5f;
    // How long his attack image stays after a hit, in seconds (day 14): the same 0.3 s as the defenses
    // (Defense.ATTACK_POSE_SECONDS) and the enemies (LaneEnemy), short next to his 1 s between two hits.
    private static final float ATTACK_POSE_SECONDS = 0.3f;

    //-------------------- STATE --------------------
    // Damage of one hit, and seconds between two hits: from the config, not written here.
    private final int damage;
    private final float cooldown;
    // Seconds before he can hit again. 0 at the start: ready, the first enemy in reach is hit at once.
    private float timeUntilReady;
    // Day 14 (feedback of the mid-term jury, then Yohan's remark): where he looks and when he strikes, read by
    // FarmRenderer to turn him to his target. Where he faces: towards his last target, east (the field) before his
    // first hit and once nobody is left on the board. The seconds left on his attack image, like
    // Defense.attackPoseLeft.
    private Facing facing = Facing.EAST;
    private float attackPoseLeft;

    //-------------------- CONSTRUCTOR --------------------
    /**
     * Creates the farmer.
     *
     * @param config the balancing numbers: damage and pace of the pitchfork
     */
    public Farmer(EnemyConfig config) {
        this.damage = config.getFarmerDamage();
        this.cooldown = config.getFarmerCooldown();
    }

    //-------------------- ACTIONS --------------------
    // The same pace as Catapatate: the timer goes down; while it is above 0, nothing happens.
    // Nobody in reach: he stays ready (timer at 0), without keeping hits in reserve.
    // After a hit, += and not =: the fraction of a frame already spent counts, so the pace stays exactly 1 hit/s.
    // Day 14: the attack image is counted down first, then started again by a hit, as in Catapatate.update. He hits at
    // most once per frame, so the pose simply starts again at 0.3 s. Once his pose is over and nobody is left on the
    // board (every enemy dead or gone, or the day), he faces the field again: the next night starts like the first one.
    // Not during his pose: an enemy he just killed leaves the board, and he would turn away in mid-hit.
    /**
     * Hits the enemy in reach of the pitchfork, at most once per cooldown.
     *
     * <p>An enemy is in reach if it is on the board, can be targeted, and stands in the square around the farmer:
     * rows 1 to 3, from 0 to 3 cells left to the farm. If several are, the one closest to the farm is hit. Each hit
     * turns the farmer to its target and shows the attack pose for 0.3 s; once the pose is over and no enemy is left
     * on the board, he faces the field again.
     *
     * @param delta the seconds elapsed since the previous frame; ignored if not positive
     * @param enemies the enemies of the game, at this frame
     */
    public void update(float delta, List<Enemy> enemies) {
        if (delta <= 0) {
            return;
        }
        attackPoseLeft = Math.max(0, attackPoseLeft - delta);
        if (attackPoseLeft == 0 && enemies.stream().noneMatch(Enemy::isOnBoard)) {
            facing = Facing.EAST;
        }
        timeUntilReady -= delta;
        if (timeUntilReady > 0) {
            return;
        }
        Optional<Enemy> target = findTarget(enemies);
        if (target.isEmpty()) {
            timeUntilReady = 0;
            return;
        }
        target.get().takeDamage(damage);
        facing = facingOf(target.get());
        attackPoseLeft = ATTACK_POSE_SECONDS;
        timeUntilReady += cooldown;
    }

    //-------------------- QUERIES --------------------
    // Read by FarmRenderer at night, at each frame, to choose his image.
    /**
     * Returns where the farmer faces: towards the last enemy he hit.
     *
     * @return the direction of his last target; {@link Facing#EAST}, the field, before his first hit and once no
     *         enemy is left on the board after his last attack pose
     */
    public Facing getFacing() {
        return facing;
    }

    // Read by FarmRenderer: the pitchfork forward during the 0.3 s after a hit, like Defense.isAttacking.
    /**
     * Tells whether the farmer has just hit, to show his attack image.
     *
     * @return {@code true} during the 0.3 s that follow a hit
     */
    public boolean isAttacking() {
        return attackPoseLeft > 0;
    }

    //-------------------- TARGETING --------------------
    // Keeps the enemies the pitchfork reaches, then the one closest to the farm: the most dangerous.
    private Optional<Enemy> findTarget(List<Enemy> enemies) {
        return enemies.stream()
                .filter(this::isInReach)
                .min(Comparator.comparingDouble(Enemy::getCellsToFarm));
    }

    // Where he faces to hit this enemy (day 14, Yohan's remark: an enemy that passes behind him makes him turn round).
    // The gap along the row, from the middle of his cell (positive: ahead, towards the field; negative: behind, towards
    // the farm), against the gap between the rows (positive: below him; negative: above him), a row counting as one
    // cell. The larger gap decides; on a tie, the row: an enemy right above or below him is north or south. On his own
    // row: behind him west, ahead of him (or on him) east. Only the place of the enemy is read, never its type.
    private static Facing facingOf(Enemy target) {
        float ahead = target.getCellsToFarm() - FARMER_CELL_MIDDLE;
        int below = target.getRow() - FARMER_ROW;
        if (below != 0 && Math.abs(below) >= Math.abs(ahead)) {
            return below < 0 ? Facing.NORTH : Facing.SOUTH;
        }
        return ahead < 0 ? Facing.WEST : Facing.EAST;
    }

    // On the board (not dead, not fled, not underground), can be hit now, and in the square around him.
    // No lower bound on the cells: an enemy never goes below 0, in front of the farm.
    private boolean isInReach(Enemy enemy) {
        return enemy.isOnBoard() && enemy.isTargetable()
                && enemy.getRow() >= FIRST_ROW_IN_REACH && enemy.getRow() <= LAST_ROW_IN_REACH
                && enemy.getCellsToFarm() <= FURTHEST_CELLS_IN_REACH;
    }
}
