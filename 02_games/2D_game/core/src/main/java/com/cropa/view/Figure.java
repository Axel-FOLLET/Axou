package com.cropa.view;

// No import: Canvas, Bounds and SpriteCatalog are in this package.
// A record: a figure is only its three values, set once; Java writes the constructor and the accessors. No public:
// only the scenes of this package (EndScene, TitleScene) place figures.
/**
 * A character or an object drawn standing on a line, shared by the end screen and the title screen. The images do not
 * fill their square: without the empty height under the feet, the figures would not stand on the same line.
 *
 * @param key the sprite key, from {@link SpriteCatalog}
 * @param size the side of the square it is drawn in, in world pixels
 * @param feet the empty height under its feet once drawn, in world pixels
 */
record Figure(String key, float size, float feet) {

    //-------------------- FIGURES --------------------
    // The sizes make every character about 40 px tall on screen, whatever the size of its image.
    // The old Garry, standing: 28 px tall in a 48 px image, 11 empty rows under his feet.
    static final Figure GARRY = new Figure(SpriteCatalog.FARMER_STANDING, 68f, 68f * 11 / 48);
    // The ghost of his wife: 29 px tall in a 36 px image, 1 empty row.
    static final Figure GHOST = new Figure(SpriteCatalog.GHOST, 50f, 50f * 1 / 36);
    // The urn: 16 px tall in a 32 px image, 8 empty rows; drawn at 20 px, smaller than the characters.
    static final Figure URN = new Figure(SpriteCatalog.URN, 40f, 40f * 8 / 32);
    // The destroyed farm, at the size of the farm in the game (FarmRenderer): 7 empty rows in a 56 px image.
    static final Figure FARM_DESTROYED = new Figure(SpriteCatalog.FARM_DESTROYED, 100f, 100f * 7 / 56);
    // M. Chmunks: 29 px tall in a 32 px image, 2 empty rows. Henchman 1 and Henchman 2: 53 px tall in a 56 px image, 2 empty rows.
    // Walking away to the right: the end screen.
    static final Figure CHMUNKS = new Figure(SpriteCatalog.CHMUNKS, 44f, 44f * 2 / 32);
    static final Figure HENCHMAN_1 = new Figure(SpriteCatalog.HENCHMAN_1, 42f, 42f * 2 / 56);
    static final Figure HENCHMAN_2 = new Figure(SpriteCatalog.HENCHMAN_2, 42f, 42f * 2 / 56);
    // The same three facing the player: the title screen. Same sizes, but Henchman 2 has 3 empty rows (51 px tall).
    static final Figure CHMUNKS_FRONT = new Figure(SpriteCatalog.CHMUNKS_FRONT, 44f, 44f * 2 / 32);
    static final Figure HENCHMAN_1_FRONT = new Figure(SpriteCatalog.HENCHMAN_1_FRONT, 42f, 42f * 2 / 56);
    static final Figure HENCHMAN_2_FRONT = new Figure(SpriteCatalog.HENCHMAN_2_FRONT, 42f, 42f * 3 / 56);

    //-------------------- DRAWING --------------------
    // Called by the scenes. The square starts feet lower than the ground: its empty rows fall under the line.
    /**
     * Draws the figure centred on x, its feet on the given height.
     *
     * @param canvas where to draw
     * @param x the middle of the figure, in world pixels
     * @param ground the height of its feet, in world pixels
     */
    void stand(Canvas canvas, float x, float ground) {
        float bottom = ground - feet;
        canvas.drawSprite(key, new Bounds(x - size / 2, bottom, size, size));
    }
}
