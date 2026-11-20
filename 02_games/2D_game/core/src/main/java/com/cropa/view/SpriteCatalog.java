package com.cropa.view;

// Map: finds the file of a sprite from its name. entry: one line of the table below.
import static java.util.Map.entry;

import java.util.Map;

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
    private static final Map<String, String> PATHS = Map.ofEntries(
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
