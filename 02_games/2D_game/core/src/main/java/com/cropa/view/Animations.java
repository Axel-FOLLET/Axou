package com.cropa.view;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Timing of the numbered images in a sprite's atlas region. */
public final class Animations {
    private record Clip(String key, boolean loop, float... seconds) {
        float at(int frame) {
            return seconds[Math.min(Math.max(0, frame), seconds.length - 1)];
        }
    }

    private static final Clip DEFAULT = new Clip("", true, 0.15f);
    // LOT A: falling dirt settles, a coin keeps turning.
    private static final List<Clip> LOT_A = List.of(new Clip("fx_dirt", false, 0.08f, 0.12f, 0.16f),
            new Clip("fx_coin", true, 0.10f));
    // LOT B: animation timing.
    private static final List<Clip> LOT_B = List.of(
            new Clip("farm", true, 0.18f),
            new Clip("farm_broken_windows", true, 0.18f),
            new Clip("farm_half_destroyed", true, 0.09f),
            new Clip("farm_smoke", true, 0.15f),
            new Clip("farm_flames", true, 0.12f),
            // Leaves sway slowly enough to keep each growth stage readable.
            new Clip("carrot_1", true, 0.24f),
            new Clip("turnip_1", true, 0.24f),
            new Clip("turnip_2", true, 0.24f),
            new Clip("garlic_1", true, 0.24f),
            new Clip("garlic_2", true, 0.24f),
            new Clip("pumpkin_1", true, 0.24f),
            new Clip("pumpkin_2", true, 0.24f),
            new Clip("pumpkin_3", true, 0.24f),
            // A bite plays once so the last image can remain until the crop fades.
            new Clip("carrot_0_eaten", false, 0.16f, 0.20f),
            new Clip("carrot_1_eaten", false, 0.16f, 0.20f),
            new Clip("turnip_0_eaten", false, 0.16f, 0.20f),
            new Clip("turnip_1_eaten", false, 0.16f, 0.20f),
            new Clip("turnip_2_eaten", false, 0.16f, 0.20f),
            new Clip("garlic_0_eaten", false, 0.16f, 0.20f),
            new Clip("garlic_1_eaten", false, 0.16f, 0.20f),
            new Clip("garlic_2_eaten", false, 0.16f, 0.20f),
            new Clip("pumpkin_0_eaten", false, 0.16f, 0.20f),
            new Clip("pumpkin_1_eaten", false, 0.16f, 0.20f),
            new Clip("pumpkin_2_eaten", false, 0.16f, 0.20f),
            new Clip("pumpkin_3_eaten", false, 0.16f, 0.20f),
            new Clip("butterfly", true, 0.12f, 0.08f, 0.08f, 0.08f),
            new Clip("butterfly_blue", true, 0.12f, 0.08f, 0.08f, 0.08f),
            new Clip("farm_splinter", true, 0.06f),
            new Clip("tile_tileset_grass_spring_33", true, 0.24f),
            new Clip("tile_trees_0", true, 0.40f),
            new Clip("tile_trees_1", true, 0.40f),
            new Clip("tile_trees_4", true, 0.40f),
            new Clip("tile_trees_5", true, 0.40f),
            new Clip("tile_trees_7", true, 0.40f),
            new Clip("tile_trees_11", true, 0.40f),
            new Clip("tile_trees_14", true, 0.40f),
            new Clip("tile_trees_16", true, 0.40f),
            new Clip("tile_trees_20", true, 0.40f),
            new Clip("tile_trees_24", true, 0.40f),
            new Clip("tile_trees_25", true, 0.40f),
            new Clip("tile_trees_26", true, 0.40f),
            new Clip("tile_trees_28", true, 0.40f),
            new Clip("tile_trees_30", true, 0.40f),
            new Clip("tile_trees_31", true, 0.40f),
            new Clip("tile_trees_34", true, 0.40f),
            new Clip("tile_trees_35", true, 0.40f),
            new Clip("tile_trees_36", true, 0.40f),
            new Clip("tile_trees_38", true, 0.40f),
            new Clip("tile_trees_39", true, 0.40f));
    // LOT C: animation timing.
    private static final List<Clip> LOT_C = List.of(
            new Clip("farmer", true, 0.44f, 0.28f, 0.38f, 0.32f),
            new Clip("farmer_stand_up", false, 0.15f),
            new Clip("farmer_north", true, 0.5f),
            new Clip("farmer_east", true, 0.5f),
            new Clip("farmer_south", true, 0.5f),
            new Clip("farmer_west", true, 0.5f),
            new Clip("farmer_north_attack", false, 0.1f),
            new Clip("farmer_east_attack", false, 0.1f),
            new Clip("farmer_south_attack", false, 0.1f),
            new Clip("farmer_west_attack", false, 0.1f),
            new Clip("farmer_north_hurt", false, 0.15f),
            new Clip("farmer_east_hurt", false, 0.15f),
            new Clip("farmer_south_hurt", false, 0.15f),
            new Clip("farmer_west_hurt", false, 0.15f),
            new Clip("farmer_standing", true, 0.5f),
            new Clip("cat", true, 0.2f),
            new Clip("cat_grooming", false, 0.18f),
            new Clip("cat_fleeing", true, 0.08f),
            new Clip("bat", true, 0.08f),
            new Clip("bat_attack", false, 0.1f),
            new Clip("bat_back", true, 0.06f),
            new Clip("bat_death", false, 0.12f),
            new Clip("witch", true, 0.15f),
            new Clip("witch_attack", false, 0.075f),
            new Clip("witch_back", true, 0.1f),
            new Clip("witch_death", false, 0.15f),
            new Clip("mole", true, 0.15f),
            new Clip("mole_mound", true, 0.12f),
            new Clip("mole_emerge", false, 0.1f),
            new Clip("mole_death", false, 0.15f),
            new Clip("puff", false, 0.08f),
            new Clip("neighbour_east", true, 0.15f),
            new Clip("neighbour_north_east", true, 0.15f),
            new Clip("neighbour_north", true, 0.15f),
            new Clip("neighbour_north_west", true, 0.15f),
            new Clip("neighbour_west", true, 0.15f),
            new Clip("neighbour_south_west", true, 0.15f),
            new Clip("neighbour_south", true, 0.15f),
            new Clip("neighbour_south_east", true, 0.15f),
            new Clip("henchman_1", true, 0.6f),
            new Clip("henchman_2", true, 0.6f),
            new Clip("henchman_1_front", true, 0.6f),
            new Clip("henchman_2_front", true, 0.6f),
            new Clip("chmunks", true, 0.6f),
            new Clip("chmunks_front", true, 0.6f),
            new Clip("ghost", true, 0.3f));
    // LOT D: animation timing.
    private static final List<Clip> LOT_D = defenseClips();

    /** The three materials use the same timing and atlas frame order. */
    private static List<Clip> defenseClips() {
        var clips = new java.util.ArrayList<Clip>();
        for (String level : List.of("", "_reinforced", "_metal")) {
            for (String base : List.of("catapatate_top", "catapatate_bottom")) {
                clips.add(new Clip(base + "_throwing" + level, false, .12f, .10f, .20f, .22f, .26f));
            }
            for (String base : List.of("catapatate_top", "catapatate_bottom", "scarecrow", "bramble")) {
                clips.add(new Clip(base + "_destroyed" + level, false, .08f, .06f, .10f, .12f, .18f, .10f));
            }
            clips.add(new Clip("scarecrow" + level, true, .32f));
            clips.add(new Clip("scarecrow_attack" + level, false, .09f, .07f, .10f, .08f, .09f, .13f));
            clips.add(new Clip("bramble_grow" + level, false, .14f));
            clips.add(new Clip("bramble_strike" + level, false, .065f));
        }
        clips.add(new Clip("potato", true, .075f));
        clips.add(new Clip("potato_splash", false, .065f));
        clips.add(new Clip("upgrade_sparkle", false, .075f));
        clips.add(new Clip("urn_gauge", false, 1f));
        return List.copyOf(clips);
    }
    private static final Map<String, Clip> CLIPS = new HashMap<>();

    static {
        for (var lot : List.of(LOT_A, LOT_B, LOT_C, LOT_D)) {
            for (Clip clip : lot) {
                if (CLIPS.putIfAbsent(clip.key(), clip) != null) {
                    throw new IllegalStateException("Duplicate animation: " + clip.key());
                }
            }
        }
    }

    private Animations() {
    }

    public static float frameDuration(String key, int frame) {
        return CLIPS.getOrDefault(key, DEFAULT).at(frame);
    }

    public static boolean loops(String key) {
        return CLIPS.getOrDefault(key, DEFAULT).loop();
    }

    public static float duration(String key, int frameCount) {
        float total = 0;
        for (int i = 0; i < frameCount; i++) {
            total += frameDuration(key, i);
        }
        return total;
    }

    public static int frameAt(String key, int frameCount, float time) {
        if (frameCount <= 1 || time <= 0) return 0;
        if (loops(key)) time %= duration(key, frameCount);
        float end = 0;
        for (int i = 0; i < frameCount - 1; i++) {
            end += frameDuration(key, i);
            if (time < end) return i;
        }
        return frameCount - 1;
    }
}
