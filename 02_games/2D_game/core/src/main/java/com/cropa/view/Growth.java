package com.cropa.view;

// Crop: the model, asked for its stage and whether it is ripe. Texts: the word of each state, in the language of the
// game.
import com.cropa.model.world.Crop;
import com.cropa.text.Texts;

// An enum: a crop is in one of three states for the player, whatever its number of stages (2 for the carrot, 4 for
// the pumpkin). Asked by Axel on day 10: red for a seed, orange while it grows, green once ripe, so the player sees
// at a glance what is worth selling. The same state gives the word of the shop panel and the color of the dot on the
// field (GrowthRenderer): both always agree.
/**
 * The growth of a crop as the player sees it: a seed, growing, or ripe.
 */
public enum Growth {
    /** Stage 0: just planted. */
    SEED(TextStyle.SEED),
    /** Between the first stage and the last one. */
    GROWING(TextStyle.GROWING),
    /** The last stage: sold at its full price. */
    RIPE(TextStyle.RIPE);

    //-------------------- FIELDS --------------------
    // The color of the word and of the dot. The word itself comes from Texts (label).
    private final TextStyle style;

    //-------------------- CONSTRUCTOR --------------------
    // Called once per value, when the enum is loaded.
    Growth(TextStyle style) {
        this.style = style;
    }

    //-------------------- QUERIES --------------------
    // Ripe first: a crop with a single stage would be both stage 0 and ripe, and it can be sold at its full price.
    /**
     * Returns the growth of a crop.
     *
     * @param crop the crop to look at
     * @return {@link #RIPE} at its last stage, {@link #SEED} at stage 0, {@link #GROWING} in between
     */
    public static Growth of(Crop crop) {
        if (crop.isMature()) {
            return RIPE;
        }
        return crop.getStage() == 0 ? SEED : GROWING;
    }

    // A switch over the enum, with no default: a fourth state does not compile until its word is chosen here.
    /**
     * Returns the word shown in the shop panel.
     *
     * @param texts the words of the game, in its language
     * @return "graine", "en pousse" or "mûre" in French; "seed", "growing" or "ripe" in English
     */
    public String label(Texts texts) {
        return switch (this) {
            case SEED -> texts.seed();
            case GROWING -> texts.growing();
            case RIPE -> texts.ripe();
        };
    }

    /**
     * Returns the color of the word and of the dot.
     *
     * @return {@link TextStyle#SEED}, {@link TextStyle#GROWING} or {@link TextStyle#RIPE}
     */
    public TextStyle getStyle() {
        return style;
    }
}
