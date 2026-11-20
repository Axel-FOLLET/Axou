package com.cropa.view;

// Java: List, the lines of a note.
import java.util.List;

// The only door between the view and the graphics library: the renderers say what to draw, never how.
// Changing library means writing one new class that implements Canvas. A test gives a fake Canvas
// that records the calls, so a renderer is checked without a window.
/**
 * What the view can draw. All the places are in world pixels.
 */
public interface Canvas {

    // No begin or end on this interface: the implementation opens and closes what it needs,
    // so a renderer can no longer be called at the wrong moment.
    /**
     * Draws the tile layers of the map, under everything drawn after it.
     */
    void drawMap();

    /**
     * Draws a sprite, stretched to fill the given area, with a tint.
     *
     * @param spriteKey the name of the sprite in {@link SpriteCatalog}
     * @param area where to draw it
     * @param tint {@link Tint#NORMAL} for the image as it is, {@link Tint#HURT} for red
     */
    void drawSprite(String spriteKey, Bounds area, Tint tint);

    // default: a method written in the interface itself. The classes that implement Canvas get it without writing it,
    // so the renderers that never tint keep calling drawSprite(key, area).
    /**
     * Draws a sprite, stretched to fill the given area, without tint.
     *
     * @param spriteKey the name of the sprite in {@link SpriteCatalog}
     * @param area where to draw it
     */
    default void drawSprite(String spriteKey, Bounds area) {
        drawSprite(spriteKey, area, Tint.NORMAL);
    }

    // The "Planter" list greys the lines that are not the current choice, and every line at night.
    /**
     * Draws a line of text, in the given style.
     *
     * @param text the text
     * @param x the left edge of the text
     * @param y the top edge of the text
     * @param style {@link TextStyle#NORMAL} for white, {@link TextStyle#GREYED} for grey, {@link TextStyle#ALERT}
     *     for red
     */
    void drawText(String text, float x, float y, TextStyle style);

    // default, like drawSprite(key, area): the HUD and the panels that never grey a text keep calling drawText(text, x, y).
    /**
     * Draws a line of white text.
     *
     * @param text the text
     * @param x the left edge of the text
     * @param y the top edge of the text
     */
    default void drawText(String text, float x, float y) {
        drawText(text, x, y, TextStyle.NORMAL);
    }

    // For the numbers shown next to a sprite, like the durability of a defense: the HUD text is too big there.
    // Centred on x, because the renderer cannot measure a text: only the implementation knows the font.
    /**
     * Draws a small line of text, centred on the given x.
     *
     * @param text the text
     * @param centerX the middle of the text
     * @param y the top edge of the text
     */
    void drawLabel(String text, float centerX, float y);

    // For the end screen: its titles, sentences and buttons are centred, at the size of the HUD text.
    // Centred on x for the same reason as drawLabel: only the implementation can measure a text.
    /**
     * Draws a line of white text, centred on the given x.
     *
     * @param text the text
     * @param centerX the middle of the text
     * @param y the top edge of the text
     */
    void drawCenteredText(String text, float centerX, float y);

    // For the HUD: a few lines that go together (the warning of the last day to sell), at the small size of the
    // labels, one under the other on a single bubble. Only the implementation knows the height of a line.
    /**
     * Draws lines of small text, one under the other, on a single bubble.
     *
     * @param lines the lines, from the top one
     * @param x the left edge of the text
     * @param y the top edge of the first line
     * @param style {@link TextStyle#NORMAL} for white, {@link TextStyle#GREYED} for grey, {@link TextStyle#ALERT}
     *     for red
     */
    void drawNote(List<String> lines, float x, float y, TextStyle style);

    // For Melda's dialog (day 12): a dark box of a given size, and lines at the size of the HUD on it, without the
    // bubble of each line (drawText gives one to every text). The full-size font keeps the letters regular: the
    // small one of drawNote, at half size, drew them uneven at Melda's length (Axel's test).
    /**
     * Fills an area with the dark color of the bubbles, then writes lines of white text in it, at the size of the
     * HUD, from its top left corner.
     *
     * @param lines the lines, from the top one
     * @param area the dark box
     */
    void drawDialog(List<String> lines, Bounds area);

    /**
     * Draws the edges of a rectangle, without filling it.
     *
     * @param area the rectangle
     * @param color the color of the edges
     */
    void drawOutline(Bounds area, OutlineColor color);

    // For the night: a dark blue layer over everything drawn before it. The opacity lets the renderer fade it in and out.
    /**
     * Covers the given area with a dark blue, partly transparent layer.
     *
     * @param area the area to cover
     * @param opacity from 0 (invisible) to 1 (opaque)
     */
    void drawNightVeil(Bounds area, float opacity);

    // For the field: the small dot of a crop's growth (GrowthRenderer). The same colors as the texts, so the dot and
    // the shop panel say the same thing.
    /**
     * Fills a small rectangle with the color of a text style.
     *
     * @param area the rectangle
     * @param color {@link TextStyle#SEED} for red, {@link TextStyle#GROWING} for orange, {@link TextStyle#RIPE} for
     *     green
     */
    void drawDot(Bounds area, TextStyle color);

    // For the range of a defense (OutlineRenderer.renderRange): a light white layer, the cell stays visible under it.
    /**
     * Covers a cell with a white, partly transparent layer.
     *
     * @param area the cell to cover
     */
    void drawRangeVeil(Bounds area);

    // For the tutorial (day 14): a small arrow next to what a bubble speaks of, a cell, a slot or a line of the shop.
    // Always to the right: every target has free room on its left (the grass, or the map left of the shop panel).
    /**
     * Draws a small filled arrow pointing to the right, its tip on the given point.
     *
     * @param tip where the arrow points, in world pixels
     */
    void drawArrow(Point tip);

    // For the tutorial (day 14): the grey of a modal window over the game. The tutorial covers the world with it, but
    // the target of its bubble, which stays bright.
    /**
     * Covers the given area with a black, partly transparent layer.
     *
     * @param area the area to darken
     */
    void drawShade(Bounds area);
}
