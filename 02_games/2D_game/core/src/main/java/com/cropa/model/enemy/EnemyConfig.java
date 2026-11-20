package com.cropa.model.enemy;

// EnumMap and Map: the table of the numbers of each enemy.
import java.util.EnumMap;
import java.util.Map;

// All the balancing numbers of track B, from the rules (§10), in one place:
// they can be tuned during playtests without touching the enemies' logic.
// Rebalanced on day 9 after Axel's playtest ("they come at us far too fast"): the bat and the witch walk slower,
// have more health and hit the farm harder, every 5 s instead of 10 s, so that they still reach it within the 45 s
// of the night and hurt it about as much in fewer hits. Checked by simulating the 8 waves.
// Not static: one EnemyConfig object is created and passed to whoever needs it (EnemyFactory, Farm, Farmer),
// so a test can give its own numbers.
/**
 * Balancing numbers of the enemies, the farm and the farmer.
 */
public class EnemyConfig {

    //-------------------- ENEMIES --------------------
    // The five numbers of one enemy, in the order of the table of the rules (§10). A record: a class of data in one
    // line, with its accessors (health(), speed()...). Private: only EnemyConfig reads it; the getters below keep
    // their signatures, so no caller changes.
    private record EnemyStats(int health, float speed, int farmDamage, int reward, int defenseWear) {
    }

    // The table: one line per enemy, filled once, when the config is created. EnumMap: a map whose keys are the
    // values of an enum, kept in their order. Before day 10 (L5), five switch repeated the list of the enemies, one
    // per number; now rebalancing an enemy changes one line. The switch without default refused to compile when a
    // new enemy had no numbers; a table cannot, so EnemyConfigTest checks that every EnemyType has its line.
    // The mole does not walk along a row (speed 0), never hits the farm (damage 0), and stays underground (wear 0).
    private final Map<EnemyType, EnemyStats> stats = new EnumMap<>(EnemyType.class);

    //-------------------- CONSTRUCTOR --------------------
    // Fills the table, once. Each line reads like §10: health, speed (cells/s), damage per hit on the farm, reward
    // (coins), wear of a defense (percent).
    /**
     * Creates the balancing numbers of the rules.
     */
    public EnemyConfig() {
        stats.put(EnemyType.MOLE, new EnemyStats(5, 0f, 0, 20, 0));
        stats.put(EnemyType.BAT, new EnemyStats(20, 0.35f, 10, 30, 10));
        stats.put(EnemyType.WITCH, new EnemyStats(45, 0.3f, 20, 80, 20));
    }

    //-------------------- ENEMY NUMBERS --------------------

    /**
     * Returns the starting health of an enemy.
     *
     * @param type the kind of enemy
     * @return its starting health
     */
    public int getHealth(EnemyType type) {
        return stats.get(type).health();
    }

    /**
     * Returns the speed of an enemy along its row.
     *
     * @param type the kind of enemy
     * @return its speed, in cells per second (0 for the mole, which does not walk along a row)
     */
    public float getSpeed(EnemyType type) {
        return stats.get(type).speed();
    }

    /**
     * Returns the damage an enemy deals to the farm with each hit.
     *
     * @param type the kind of enemy
     * @return the damage of one hit on the farm (0 for the mole)
     */
    public int getFarmDamage(EnemyType type) {
        return stats.get(type).farmDamage();
    }

    /**
     * Returns the coins earned by killing an enemy.
     *
     * @param type the kind of enemy
     * @return the reward, in coins
     */
    public int getReward(EnemyType type) {
        return stats.get(type).reward();
    }

    // Durability removed from a defense the enemy goes through while it flees.
    /**
     * Returns the durability an enemy removes from a defense it goes through.
     *
     * @param type the kind of enemy
     * @return the durability removed, in percent (0 for the mole)
     */
    public int getDefenseWear(EnemyType type) {
        return stats.get(type).defenseWear();
    }

    //-------------------- WALKING ENEMIES --------------------
    // Same for the bat and the witch, so no type parameter. The mole never hits the farm.
    /**
     * Returns the time between two hits of an enemy standing in front of the farm.
     * The first hit comes sooner: see {@link #getFirstFarmHitDelay()}.
     *
     * @return the time between two hits on the farm, in seconds
     */
    public float getFarmHitCooldown() {
        return 5f;
    }

    // Day 11 (Yohan's choice): the enemies hit the farm as soon as they arrive (0 s), then every cooldown (5 s).
    // Before, the first hit came a whole cooldown after the arrival. The game is harder on purpose: in the whole-game
    // test, the farm of a small player now falls before the end of the 8 nights. Its own number, distinct from the
    // cooldown, so the first hit can be tuned without touching the logic (2 s was tried: the farm fell at night 7).
    /**
     * Returns the time between the arrival of an enemy in front of the farm and its first hit.
     *
     * @return the delay before the first hit on the farm, in seconds (0: at once; at most one cooldown)
     */
    public float getFirstFarmHitDelay() {
        return 0f;
    }

    // Counts the cells left to the farm: 10 when the enemy enters its row, 0 in front of the farm.
    /**
     * Returns the cells left to the farm when an enemy enters its row.
     *
     * @return the number of cells between the entry point and the farm
     */
    public float getSpawnCellsToFarm() {
        return 10f;
    }

    //-------------------- MOLE --------------------
    // The mole's rhythm (rules §8, §10): visible while it eats, then underground, a limited number of times.
    /**
     * Returns how long the mole eats a crop, visible and attackable.
     *
     * @return the duration of one meal, in seconds
     */
    public float getMoleMealDuration() {
        return 3f;
    }

    /**
     * Returns how long the mole stays underground between two meals, where nothing can hit it.
     *
     * @return the waiting time between two meals, in seconds
     */
    public float getMoleWaitDuration() {
        return 11f;
    }

    // After its last meal, the mole leaves the board. 2 since day 10 (was 3): with 3 meals, the moles of the late
    // nights ate the whole field, whatever the defense (balance simulated over whole games, rules.md §10).
    /**
     * Returns the number of meals after which the mole leaves.
     *
     * @return the most meals a mole eats
     */
    public int getMoleMaxMeals() {
        return 2;
    }

    //-------------------- FARM AND FARMER --------------------
    // 150 since day 10 (was 100): Garry hits less hard, so the farm takes hits; it must last until the last night
    // for a player with an average defense.
    /**
     * Returns the starting health of the farm.
     *
     * @return the starting health of the farm
     */
    public int getFarmHealth() {
        return 150;
    }

    // 4 since day 10 (was 5): at 5, Garry killed every enemy that reached his 3 cells on his own, and the farm never
    // took a hit (Axel's playtest of day 10). At 4, a lone witch (45 HP, 10 s in his reach) reaches the farm.
    /**
     * Returns the damage of one pitchfork hit from the farmer.
     *
     * @return the damage of one farmer hit
     */
    public int getFarmerDamage() {
        return 4;
    }

    // Rules §10: the farmer hits once per second with his pitchfork. Read by Farmer, like a defense's cooldown.
    /**
     * Returns the time between two pitchfork hits from the farmer.
     *
     * @return the time between two farmer hits, in seconds
     */
    public float getFarmerCooldown() {
        return 1f;
    }
}
