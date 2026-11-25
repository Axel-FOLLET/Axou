package com.cropa.view;

// Map: finds the file of a sprite from its name. entry: one line of the table below.
import static java.util.Map.entry;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

// final with a private constructor: a table of constants, never instantiated.
// A new sprite needs one line here and nothing in the renderers.
/**
 * The file of each sprite. The paths start from {@code assets/} and follow {@code docs/sprites.md}.
 */
public final class SpriteCatalog {

    //-------------------- KEYS --------------------
    // Public: FarmRenderer and DefenseRenderer name the sprites they draw with them, so a typo stops the compilation.
    /** Key of the farm. */
    public static final String FARM = "farm";
    /** Key of the farmer, dozing in his rocking chair. */
    public static final String FARMER = "farmer";
    /** Key of the cat. */
    public static final String CAT = "cat";
    /** Key of the pickup truck parked by the farm. */
    public static final String PICKUP = "pickup";
    /** Key of a cypress, one on each side of the farm. */
    public static final String CYPRESS = "cypress";
    /** Key of a catapatate in a top slot, facing the field. */
    public static final String CATAPATATE_TOP = "catapatate_top";
    /** Key of a catapatate in a bottom slot, facing the field. */
    public static final String CATAPATATE_BOTTOM = "catapatate_bottom";
    // Day 14: the catapatate throwing, for 0.3 s after each shot (Defense.isAttacking), and the farm half destroyed,
    // once it has lost half its health (FarmRenderer).
    /** Key of a catapatate in a top slot, throwing its potato. */
    public static final String CATAPATATE_TOP_THROWING = "catapatate_top_throwing";
    /** Key of a catapatate in a bottom slot, throwing its potato. */
    public static final String CATAPATATE_BOTTOM_THROWING = "catapatate_bottom_throwing";
    /** Key of the farm half destroyed, from half its health down to 1. */
    public static final String FARM_HALF_DESTROYED = "farm_half_destroyed";
    // The end screen (EndScene): the old Garry standing, the ghost of his wife, the urn, the destroyed farm, and
    // M. Chmunks with his two henchmen, walking away to the right.
    /** Key of the old Garry standing, on the end screen. */
    public static final String FARMER_STANDING = "farmer_standing";
    /** Key of the ghost of Garry's wife, on the end screen. */
    public static final String GHOST = "ghost";
    /** Key of the urn, on the end screen. */
    public static final String URN = "urn";
    /** Key of the destroyed farm, on the end screen and on the field at 0 health. */
    public static final String FARM_DESTROYED = "farm_destroyed";
    /** Key of M. Chmunks walking away, on the end screen. */
    public static final String CHMUNKS = "chmunks";
    /** Key of Henchman 1, a henchman of M. Chmunks, walking away, on the end screen. */
    public static final String HENCHMAN_1 = "henchman_1";
    /** Key of Henchman 2, a henchman of M. Chmunks, walking away, on the end screen. */
    public static final String HENCHMAN_2 = "henchman_2";
    // The title screen (TitleScene): the same three, facing the player.
    /** Key of M. Chmunks facing the player, on the title screen. */
    public static final String CHMUNKS_FRONT = "chmunks_front";
    /** Key of Henchman 1 facing the player, on the title screen. */
    public static final String HENCHMAN_1_FRONT = "henchman_1_front";
    /** Key of Henchman 2 facing the player, on the title screen. */
    public static final String HENCHMAN_2_FRONT = "henchman_2_front";

    //-------------------- TABLE --------------------
    // Map.ofEntries gives a table nobody can change. A crop, an enemy, a scarecrow or a bramble key is what its
    // spriteKey() returns; a catapatate key is chosen by the renderer from the side of its slot (top or bottom).
    private static final Map<String, String> BASE = Map.ofEntries(
            entry(FARM, "farm/east-farm.png"),
            entry(FARMER, "farmer/east-farmer-rocking-chair.png"),
            // Day 14: at night, old Garry stands and faces the enemy he hits (Farmer.getFacing, FarmRenderer): north
            // (row 1), east (the field), south (row 3), west (behind him, towards the farm); "_attack" during the 0.3 s
            // after a hit.
            entry("farmer_north", "farmer/north-farmer.png"),
            entry("farmer_north_attack", "farmer/north-farmer-attack.png"),
            entry("farmer_east", "farmer/east-farmer.png"),
            entry("farmer_east_attack", "farmer/east-farmer-attack.png"),
            entry("farmer_south", "farmer/south-farmer.png"),
            entry("farmer_south_attack", "farmer/south-farmer-attack.png"),
            entry("farmer_west", "farmer/west-farmer.png"),
            entry("farmer_west_attack", "farmer/west-farmer-attack.png"),
            entry(CAT, "npc/cat/south-cat.png"),
            entry(PICKUP, "objects/pickup/west-pickup.png"),
            entry(CYPRESS, "trees/cypress-south.png"),
            entry("carrot_0", "vegetables/carrots/south-carrots-seeds.png"),
            entry("carrot_1", "vegetables/carrots/south-carrots-final.png"),
            // One line per stage, from 0 to the last one (CropConfig): 3 for the turnip and the garlic, 4 for the pumpkin.
            entry("turnip_0", "vegetables/turnip/south-turnip-seeds.png"),
            entry("turnip_1", "vegetables/turnip/south-turnip-stage1.png"),
            entry("turnip_2", "vegetables/turnip/south-turnip-final.png"),
            entry("garlic_0", "vegetables/garlic/south-garlic-seeds.png"),
            entry("garlic_1", "vegetables/garlic/south-garlic-stage1.png"),
            entry("garlic_2", "vegetables/garlic/south-garlic-final.png"),
            entry("pumpkin_0", "vegetables/pumpkin/south-pumpkin-seeds.png"),
            entry("pumpkin_1", "vegetables/pumpkin/south-pumpkin-stage1.png"),
            entry("pumpkin_2", "vegetables/pumpkin/south-pumpkin-stage2.png"),
            entry("pumpkin_3", "vegetables/pumpkin/south-pumpkin-final.png"),
            entry("bat", "hostiles/bat/west-bat.png"),
            entry("bat_attack", "hostiles/bat/west-bat-attack.png"),
            // Day 14: an enemy that goes back along a flee row is seen from behind, turned east (LaneEnemy.spriteKey).
            entry("bat_back", "hostiles/bat/east-bat.png"),
            entry("witch", "hostiles/witch/west-witch.png"),
            entry("witch_attack", "hostiles/witch/west-witch-attack.png"),
            entry("witch_back", "hostiles/witch/east-witch.png"),
            entry("mole", "hostiles/mole/south-mole-attack.png"),
            entry("scarecrow", "defenses/scarecrow/south-scarecrow.png"),
            // The arm up, raised to punch: the files named "scarecrow-attack" are the same pixels as the still image.
            entry("scarecrow_attack", "defenses/scarecrow/south-scarecrow-arm-up.png"),
            entry("bramble_0", "vegetables/brambles/south-brambles-seeds.png"),
            entry("bramble_1", "vegetables/brambles/south-brambles-final.png"),
            entry(CATAPATATE_TOP, "defenses/shooting_potatoes/south-shooting-potatoes.png"),
            entry(CATAPATATE_BOTTOM, "defenses/shooting_potatoes/north-shooting-potatoes.png"),
            entry(CATAPATATE_TOP_THROWING, "defenses/shooting_potatoes/south-throws-potatoes.png"),
            entry(CATAPATATE_BOTTOM_THROWING, "defenses/shooting_potatoes/north-throws-potatoes.png"),
            entry(FARM_HALF_DESTROYED, "farm/east-farm-half-destroyed.png"),
            entry(FARMER_STANDING, "farmer/south-farmer.png"),
            entry(GHOST, "npc/wife/south-ghost.png"),
            entry(URN, "objects/urn/south-urn.png"),
            entry(FARM_DESTROYED, "farm/east-farm-destroyed.png"),
            entry(CHMUNKS, "npc/ms-chmunks/east-chmunks.png"),
            entry(HENCHMAN_1, "npc/henchman-1/east-henchman-1.png"),
            entry(HENCHMAN_2, "npc/henchman-2/east-henchman-2.png"),
            entry(CHMUNKS_FRONT, "npc/ms-chmunks/south-chmunks.png"),
            entry(HENCHMAN_1_FRONT, "npc/henchman-1/south-henchman-1.png"),
            entry(HENCHMAN_2_FRONT, "npc/henchman-2/south-henchman-2.png"),
            // The cinematics (Cinematic): one image per scene, 688 x 384, stretched over the 560 x 320 world
            // (the images come out about 2% narrower).
            entry("intro_1", "cinematics/intro/1.png"),
            entry("intro_2", "cinematics/intro/2.png"),
            entry("intro_3", "cinematics/intro/3.png"),
            entry("intro_4", "cinematics/intro/4.png"),
            entry("intro_5", "cinematics/intro/5.png"),
            entry("victory_1", "cinematics/victory/1.png"),
            entry("victory_2", "cinematics/victory/2.png"),
            entry("victory_3", "cinematics/victory/3.png"),
            // The neighbour and the cat (day 12), as plain names like the cinematics: no constant, Yohan writes the Javadoc
            // of the constants above today. The neighbour walks: one image per direction, "neighbour_" + the direction chosen by
            // NeighbourRenderer. The cat sits seen from the front and flees west, to the farm. The two bubbles face the
            // player, their tail pointing down.
            entry("neighbour_east", "neighbour/east-neighbour.png"),
            entry("neighbour_north_east", "neighbour/north-east-neighbour.png"),
            entry("neighbour_north", "neighbour/north-neighbour.png"),
            entry("neighbour_north_west", "neighbour/north-west-neighbour.png"),
            entry("neighbour_west", "neighbour/west-neighbour.png"),
            entry("neighbour_south_west", "neighbour/south-west-neighbour.png"),
            entry("neighbour_south", "neighbour/south-neighbour.png"),
            entry("neighbour_south_east", "neighbour/south-east-neighbour.png"),
            entry("neighbour_bubble", "talk/Speech-bubble-characters/south-speech-bubble.png"),
            entry("cat_fleeing", "npc/cat/west-cat.png"),
            entry("cat_meow", "talk/Speech-bubble-cat/south-bubble-speech-meow.png"));

    // LOT A: particles and lights.
    private static final List<Map.Entry<String, String>> LOT_A = List.of(
            entry("fx_dirt", "fx/dirt.png"), entry("fx_leaf", "fx/leaf.png"),
            entry("fx_coin", "fx/coin.png"), entry("fx_smoke", "fx/smoke.png"),
            entry("light_window", "light/window_glow.png"), entry("light_soft", "light/soft_glow.png"));
    // LOT B: sprites.
    private static final List<Map.Entry<String, String>> LOT_B = List.of(
            entry("farm_broken_windows", "farm/east-farm-broken-windows.png"),
            entry("farm_smoke", "farm/east-farm-smoke.png"),
            entry("farm_flames", "farm/east-farm-flames.png"),
            entry("farm_light", "farm/east-farm-light.png"),
            entry("farm_light_broken", "farm/east-farm-light-broken.png"),
            entry("field_furrows", "maps/assets/field_furrows.png"),
            entry("gate_open", "maps/assets/gate_open.png"),
            entry("butterfly", "maps/assets/decor/butterfly.png"),
            entry("butterfly_blue", "maps/assets/decor/butterfly_blue.png"),
            entry("firefly", "maps/assets/decor/firefly.png"),
            entry("cloud_shadow", "maps/assets/decor/cloud_shadow.png"),
            entry("farm_splinter", "maps/assets/decor/farm_splinter.png"),
            // The atlas packer reads literal entries to find frame zero of each eaten crop.
            entry("carrot_0_eaten", "vegetables/carrots/south-carrots-seeds-eaten.png"),
            entry("carrot_1_eaten", "vegetables/carrots/south-carrots-final-eaten.png"),
            entry("turnip_0_eaten", "vegetables/turnip/south-turnip-seeds-eaten.png"),
            entry("turnip_1_eaten", "vegetables/turnip/south-turnip-stage1-eaten.png"),
            entry("turnip_2_eaten", "vegetables/turnip/south-turnip-final-eaten.png"),
            entry("garlic_0_eaten", "vegetables/garlic/south-garlic-seeds-eaten.png"),
            entry("garlic_1_eaten", "vegetables/garlic/south-garlic-stage1-eaten.png"),
            entry("garlic_2_eaten", "vegetables/garlic/south-garlic-final-eaten.png"),
            entry("pumpkin_0_eaten", "vegetables/pumpkin/south-pumpkin-seeds-eaten.png"),
            entry("pumpkin_1_eaten", "vegetables/pumpkin/south-pumpkin-stage1-eaten.png"),
            entry("pumpkin_2_eaten", "vegetables/pumpkin/south-pumpkin-stage2-eaten.png"),
            entry("pumpkin_3_eaten", "vegetables/pumpkin/south-pumpkin-final-eaten.png"),
            // The map renderer looks up each animation by tileset filename and local tile ID.
            entry("tile_tileset_grass_spring_33", "maps/assets/tileset_grass_spring_33.png"),
            entry("tile_trees_0", "trees/bonsai-east.png"),
            entry("tile_trees_1", "trees/bonsai-north.png"),
            entry("tile_trees_4", "trees/bonsai-south.png"),
            entry("tile_trees_5", "trees/bonsai-south-west.png"),
            entry("tile_trees_7", "trees/bonsai-west.png"),
            entry("tile_trees_11", "trees/cherry-north.png"),
            entry("tile_trees_14", "trees/cherry-south.png"),
            entry("tile_trees_16", "trees/cypress-east.png"),
            entry("tile_trees_20", "trees/cypress-south.png"),
            entry("tile_trees_24", "trees/pine-east.png"),
            entry("tile_trees_25", "trees/pine-north.png"),
            entry("tile_trees_26", "trees/pine-north-west.png"),
            entry("tile_trees_28", "trees/pine-south.png"),
            entry("tile_trees_30", "trees/pine-south-east.png"),
            entry("tile_trees_31", "trees/pine-west.png"),
            entry("tile_trees_34", "trees/round-north-west.png"),
            entry("tile_trees_35", "trees/round-north-east.png"),
            entry("tile_trees_36", "trees/round-south.png"),
            entry("tile_trees_38", "trees/round-south-east.png"),
            entry("tile_trees_39", "trees/round-west.png"));
    // LOT C: sprites.
    private static final List<Map.Entry<String, String>> LOT_C = List.of(
            entry("farmer_chair", "farmer/east-farmer-chair.png"),
            entry("farmer_stand_up", "farmer/east-farmer-stand-up.png"),
            entry("farmer_north_hurt", "farmer/north-farmer-hurt.png"),
            entry("farmer_east_hurt", "farmer/east-farmer-hurt.png"),
            entry("farmer_south_hurt", "farmer/south-farmer-hurt.png"),
            entry("farmer_west_hurt", "farmer/west-farmer-hurt.png"),
            entry("cat_grooming", "npc/cat/south-cat-grooming.png"),
            entry("bat_death", "hostiles/bat/west-bat-death.png"),
            entry("witch_death", "hostiles/witch/west-witch-death.png"),
            entry("mole_death", "hostiles/mole/south-mole-death.png"),
            entry("mole_mound", "hostiles/mole/south-mole-mound.png"),
            entry("mole_emerge", "hostiles/mole/south-mole-emerge.png"),
            entry("shadow", "hostiles/shadow.png"),
            entry("puff", "hostiles/puff.png"),
            entry("end_victory", "objects/end/end-victory.png"),
            entry("end_defeat", "objects/end/end-defeat.png"));
    // LOT D: sprites.
    public static final String HUD_FRAME = "hud_frame";
    public static final String BUTTON_FRAME = "button_frame";
    public static final String BUTTON_HOVER_FRAME = "button_hover_frame";
    public static final String BUTTON_PRESSED_FRAME = "button_pressed_frame";
    public static final String BUTTON_DISABLED_FRAME = "button_disabled_frame";
    public static final String STALL_FRAME = "stall_frame";
    public static final String CARD_FRAME = "card_frame";
    public static final String CARD_HOVER_FRAME = "card_hover_frame";
    public static final String CARD_PRESSED_FRAME = "card_pressed_frame";
    public static final String CARD_DISABLED_FRAME = "card_disabled_frame";
    public static final String PANEL_FRAME = "panel_frame";
    public static final String TOOLTIP_FRAME = "tooltip_frame";
    public static final String BUBBLE_FRAME = "bubble_frame";
    public static final String PORTRAIT_FRAME = "portrait_frame";
    public static final String CELL_FRAME = "cell_frame";
    public static final String CELL_HOVER = "cell_hover";
    public static final String RANGE_CELL = "range_cell";

    private static final List<Map.Entry<String, String>> LOT_D = List.of(
            entry("hud_frame", "ui/hud-frame.png"),
            entry("button_frame", "ui/button-frame.png"),
            entry("button_hover_frame", "ui/button-hover-frame.png"),
            entry("button_pressed_frame", "ui/button-pressed-frame.png"),
            entry("button_disabled_frame", "ui/button-disabled-frame.png"),
            entry("stall_frame", "ui/stall-frame.png"),
            entry("card_frame", "ui/card-frame.png"),
            entry("card_hover_frame", "ui/card-hover-frame.png"),
            entry("card_pressed_frame", "ui/card-pressed-frame.png"),
            entry("card_disabled_frame", "ui/card-disabled-frame.png"),
            entry("panel_frame", "ui/panel-frame.png"),
            entry("tooltip_frame", "ui/tooltip-frame.png"),
            entry("bubble_frame", "ui/bubble-frame.png"),
            entry("portrait_frame", "ui/portrait-frame.png"),
            entry("stall_awning", "ui/stall-awning.png"),
            entry("bubble_tail_up", "ui/bubble-tail-up.png"),
            entry("bubble_tail_down", "ui/bubble-tail-down.png"),
            entry("bubble_tail_left", "ui/bubble-tail-left.png"),
            entry("bubble_tail_right", "ui/bubble-tail-right.png"),
            entry("portrait_garry", "ui/portrait-garry.png"),
            entry("portrait_neighbour", "ui/portrait-neighbour.png"),
            entry("portrait_cat", "ui/portrait-cat.png"),
            entry("icon_coin", "ui/coin.png"),
            entry("icon_coin_small", "ui/coin-small.png"),
            entry("icon_heart", "ui/heart.png"),
            entry("icon_heart_small", "ui/heart-small.png"),
            entry("dial_day", "ui/dial-day.png"),
            entry("dial_day_small", "ui/dial-day-small.png"),
            entry("dial_night", "ui/dial-night.png"),
            entry("dial_night_small", "ui/dial-night-small.png"),
            entry("lifebar_back", "ui/lifebar-back.png"),
            entry("lifebar_fill", "ui/lifebar-fill.png"),
            entry("urn_gauge", "ui/urn-gauge.png"),
            entry("star_full", "ui/star-full.png"),
            entry("star_empty", "ui/star-empty.png"),
            entry("wearbar_back", "ui/wearbar-back.png"),
            entry("wearbar_fill_new", "ui/wearbar-fill-new.png"),
            entry("wearbar_fill_worn", "ui/wearbar-fill-worn.png"),
            entry("wearbar_fill_very_worn", "ui/wearbar-fill-very-worn.png"),
            entry("wearbar_fill_almost_broken", "ui/wearbar-fill-almost-broken.png"),
            entry("upgrade_arrow", "ui/upgrade-arrow.png"),
            entry("icon_carrot", "ui/icon-carrot.png"),
            entry("icon_turnip", "ui/icon-turnip.png"),
            entry("icon_garlic", "ui/icon-garlic.png"),
            entry("icon_pumpkin", "ui/icon-pumpkin.png"),
            entry("icon_catapatate", "ui/icon-catapatate.png"),
            entry("icon_scarecrow", "ui/icon-scarecrow.png"),
            entry("icon_bramble", "ui/icon-bramble.png"),
            entry("tutorial_arrow", "ui/tutorial-arrow.png"),
            entry("cell_frame", "ui/cell-frame.png"),
            entry("cell_hover", "ui/cell-hover.png"),
            entry("range_cell", "ui/range-cell.png"),
            entry("catapatate_top_wear_worn", "defenses/shooting_potatoes/south-wear-worn.png"),
            entry("catapatate_top_wear_very_worn", "defenses/shooting_potatoes/south-wear-very-worn.png"),
            entry("catapatate_top_wear_almost_broken", "defenses/shooting_potatoes/south-wear-almost-broken.png"),
            entry("catapatate_top_destroyed", "defenses/shooting_potatoes/south-destroyed.png"),
            entry("catapatate_top_reinforced", "defenses/shooting_potatoes/south-shooting-potatoes-reinforced.png"),
            entry("catapatate_top_throwing_reinforced", "defenses/shooting_potatoes/south-throws-potatoes-reinforced.png"),
            entry("catapatate_top_wear_reinforced_worn", "defenses/shooting_potatoes/south-wear-reinforced-worn.png"),
            entry("catapatate_top_wear_reinforced_very_worn", "defenses/shooting_potatoes/south-wear-reinforced-very-worn.png"),
            entry("catapatate_top_wear_reinforced_almost_broken", "defenses/shooting_potatoes/south-wear-reinforced-almost-broken.png"),
            entry("catapatate_top_destroyed_reinforced", "defenses/shooting_potatoes/south-destroyed-reinforced.png"),
            entry("catapatate_top_metal", "defenses/shooting_potatoes/south-shooting-potatoes-metal.png"),
            entry("catapatate_top_throwing_metal", "defenses/shooting_potatoes/south-throws-potatoes-metal.png"),
            entry("catapatate_top_wear_metal_worn", "defenses/shooting_potatoes/south-wear-metal-worn.png"),
            entry("catapatate_top_wear_metal_very_worn", "defenses/shooting_potatoes/south-wear-metal-very-worn.png"),
            entry("catapatate_top_wear_metal_almost_broken", "defenses/shooting_potatoes/south-wear-metal-almost-broken.png"),
            entry("catapatate_top_destroyed_metal", "defenses/shooting_potatoes/south-destroyed-metal.png"),
            entry("catapatate_bottom_wear_worn", "defenses/shooting_potatoes/north-wear-worn.png"),
            entry("catapatate_bottom_wear_very_worn", "defenses/shooting_potatoes/north-wear-very-worn.png"),
            entry("catapatate_bottom_wear_almost_broken", "defenses/shooting_potatoes/north-wear-almost-broken.png"),
            entry("catapatate_bottom_destroyed", "defenses/shooting_potatoes/north-destroyed.png"),
            entry("catapatate_bottom_reinforced", "defenses/shooting_potatoes/north-shooting-potatoes-reinforced.png"),
            entry("catapatate_bottom_throwing_reinforced", "defenses/shooting_potatoes/north-throws-potatoes-reinforced.png"),
            entry("catapatate_bottom_wear_reinforced_worn", "defenses/shooting_potatoes/north-wear-reinforced-worn.png"),
            entry("catapatate_bottom_wear_reinforced_very_worn", "defenses/shooting_potatoes/north-wear-reinforced-very-worn.png"),
            entry("catapatate_bottom_wear_reinforced_almost_broken", "defenses/shooting_potatoes/north-wear-reinforced-almost-broken.png"),
            entry("catapatate_bottom_destroyed_reinforced", "defenses/shooting_potatoes/north-destroyed-reinforced.png"),
            entry("catapatate_bottom_metal", "defenses/shooting_potatoes/north-shooting-potatoes-metal.png"),
            entry("catapatate_bottom_throwing_metal", "defenses/shooting_potatoes/north-throws-potatoes-metal.png"),
            entry("catapatate_bottom_wear_metal_worn", "defenses/shooting_potatoes/north-wear-metal-worn.png"),
            entry("catapatate_bottom_wear_metal_very_worn", "defenses/shooting_potatoes/north-wear-metal-very-worn.png"),
            entry("catapatate_bottom_wear_metal_almost_broken", "defenses/shooting_potatoes/north-wear-metal-almost-broken.png"),
            entry("catapatate_bottom_destroyed_metal", "defenses/shooting_potatoes/north-destroyed-metal.png"),
            entry("scarecrow_wear_worn", "defenses/scarecrow/south-wear-worn.png"),
            entry("scarecrow_wear_very_worn", "defenses/scarecrow/south-wear-very-worn.png"),
            entry("scarecrow_wear_almost_broken", "defenses/scarecrow/south-wear-almost-broken.png"),
            entry("scarecrow_destroyed", "defenses/scarecrow/south-destroyed.png"),
            entry("scarecrow_reinforced", "defenses/scarecrow/south-scarecrow-reinforced.png"),
            entry("scarecrow_attack_reinforced", "defenses/scarecrow/south-scarecrow-arm-up-reinforced.png"),
            entry("scarecrow_wear_reinforced_worn", "defenses/scarecrow/south-wear-reinforced-worn.png"),
            entry("scarecrow_wear_reinforced_very_worn", "defenses/scarecrow/south-wear-reinforced-very-worn.png"),
            entry("scarecrow_wear_reinforced_almost_broken", "defenses/scarecrow/south-wear-reinforced-almost-broken.png"),
            entry("scarecrow_destroyed_reinforced", "defenses/scarecrow/south-destroyed-reinforced.png"),
            entry("scarecrow_metal", "defenses/scarecrow/south-scarecrow-metal.png"),
            entry("scarecrow_attack_metal", "defenses/scarecrow/south-scarecrow-arm-up-metal.png"),
            entry("scarecrow_wear_metal_worn", "defenses/scarecrow/south-wear-metal-worn.png"),
            entry("scarecrow_wear_metal_very_worn", "defenses/scarecrow/south-wear-metal-very-worn.png"),
            entry("scarecrow_wear_metal_almost_broken", "defenses/scarecrow/south-wear-metal-almost-broken.png"),
            entry("scarecrow_destroyed_metal", "defenses/scarecrow/south-destroyed-metal.png"),
            entry("bramble_grow", "vegetables/brambles/south-brambles-grow.png"),
            entry("bramble_strike", "vegetables/brambles/south-brambles-strike.png"),
            entry("bramble_wear_worn", "vegetables/brambles/south-wear-worn.png"),
            entry("bramble_wear_very_worn", "vegetables/brambles/south-wear-very-worn.png"),
            entry("bramble_wear_almost_broken", "vegetables/brambles/south-wear-almost-broken.png"),
            entry("bramble_destroyed", "vegetables/brambles/south-destroyed.png"),
            entry("bramble_0_reinforced", "vegetables/brambles/south-brambles-seeds-reinforced.png"),
            entry("bramble_1_reinforced", "vegetables/brambles/south-brambles-final-reinforced.png"),
            entry("bramble_grow_reinforced", "vegetables/brambles/south-brambles-grow-reinforced.png"),
            entry("bramble_strike_reinforced", "vegetables/brambles/south-brambles-strike-reinforced.png"),
            entry("bramble_wear_reinforced_worn", "vegetables/brambles/south-wear-reinforced-worn.png"),
            entry("bramble_wear_reinforced_very_worn", "vegetables/brambles/south-wear-reinforced-very-worn.png"),
            entry("bramble_wear_reinforced_almost_broken", "vegetables/brambles/south-wear-reinforced-almost-broken.png"),
            entry("bramble_destroyed_reinforced", "vegetables/brambles/south-destroyed-reinforced.png"),
            entry("bramble_0_metal", "vegetables/brambles/south-brambles-seeds-metal.png"),
            entry("bramble_1_metal", "vegetables/brambles/south-brambles-final-metal.png"),
            entry("bramble_grow_metal", "vegetables/brambles/south-brambles-grow-metal.png"),
            entry("bramble_strike_metal", "vegetables/brambles/south-brambles-strike-metal.png"),
            entry("bramble_wear_metal_worn", "vegetables/brambles/south-wear-metal-worn.png"),
            entry("bramble_wear_metal_very_worn", "vegetables/brambles/south-wear-metal-very-worn.png"),
            entry("bramble_wear_metal_almost_broken", "vegetables/brambles/south-wear-metal-almost-broken.png"),
            entry("bramble_destroyed_metal", "vegetables/brambles/south-destroyed-metal.png"),
            entry("potato", "defenses/shooting_potatoes/potato.png"),
            entry("potato_shadow", "defenses/shooting_potatoes/potato-shadow.png"),
            entry("potato_splash", "defenses/shooting_potatoes/potato-splash.png"),
            entry("upgrade_sparkle", "defenses/fx/upgrade-sparkle.png"));

    private static final Map<String, String> PATHS = new HashMap<>(BASE);
    static {
        for (var lot : List.of(LOT_A, LOT_B, LOT_C, LOT_D)) {
            for (var item : lot) {
                if (PATHS.putIfAbsent(item.getKey(), item.getValue()) != null) {
                    throw new IllegalStateException("Duplicate sprite: " + item.getKey());
                }
            }
        }
    }

    public static boolean contains(String key) {
        return PATHS.containsKey(key);
    }

    public static Set<String> keys() {
        return Collections.unmodifiableSet(PATHS.keySet());
    }

    private SpriteCatalog() {
    }

    //-------------------- QUERIES --------------------
    // Called by the canvas the first time it draws a sprite. Map.get gives null for an unknown name:
    // the exception names it instead, so a typo does not become an empty image.
    /**
     * Gives the file of a sprite.
     *
     * @param spriteKey the name of the sprite
     * @return its path, from {@code assets/}
     * @throws IllegalArgumentException if the name is unknown
     */
    public static String pathOf(String spriteKey) {
        String path = PATHS.get(spriteKey);
        if (path == null) {
            throw new IllegalArgumentException("Unknown sprite: " + spriteKey);
        }
        return path;
    }
}
