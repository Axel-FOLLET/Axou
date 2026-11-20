package com.cropa.view.gdx;

// libGDX: the camera, Color, the images and the pixmap that builds one, the batch and the font that draw them,
// the measure of a text, the outline renderer, the Tiled map and its renderer. Java: the table of images already
// loaded, and the lines of a note.
// The view: the interface written here, the places (an area, the tip of an arrow), the colors and the files of the
// sprites, their tints, and the styles of the texts.
import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.graphics.OrthographicCamera;
import com.badlogic.gdx.graphics.Pixmap;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.graphics.g2d.BitmapFont;
import com.badlogic.gdx.graphics.g2d.GlyphLayout;
import com.badlogic.gdx.graphics.g2d.SpriteBatch;
import com.badlogic.gdx.graphics.glutils.ShapeRenderer;
import com.badlogic.gdx.maps.tiled.TiledMap;
import com.badlogic.gdx.maps.tiled.renderers.OrthogonalTiledMapRenderer;
import com.cropa.view.Bounds;
import com.cropa.view.Canvas;
import com.cropa.view.OutlineColor;
import com.cropa.view.Point;
import com.cropa.view.SpriteCatalog;
import com.cropa.view.TextStyle;
import com.cropa.view.Tint;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

// implements Canvas: the libGDX version of the drawing. Every libGDX drawing call of the ported view is here.
/**
 * Draws with libGDX. It opens and closes the batch and the outline renderer by itself, one at a time.
 */
public class GdxCanvas implements Canvas {

    //-------------------- CONSTANTS --------------------
    // The black behind every text: 75 % opaque, so what stands behind it stays visible.
    private static final float BUBBLE_OPACITY = 0.75f;
    // Gap between a text and the edges of its bubble, in world pixels.
    private static final float BUBBLE_PADDING = 3f;
    // The labels: the same font at half size (lsans-15, 18 px high per line, about 9 once scaled), with a thinner bubble.
    private static final float LABEL_SCALE = 0.5f;
    private static final float LABEL_PADDING = 1f;
    // The neighbour's dialog: where its first line starts in its box, from the left edge and from the top.
    private static final float DIALOG_LEFT = 8f;
    private static final float DIALOG_TOP = 4f;
    // A hit sprite: red kept whole, green and blue at 30 %. A beige pixel (230, 200, 160) becomes (230, 60, 48).
    private static final Color HURT_COLOR = new Color(1f, 0.3f, 0.3f, 1f);
    // An upgraded sprite: blue kept whole, red at 40 %, green at 60 %. The same beige pixel becomes (92, 120, 160).
    private static final Color UPGRADED_COLOR = new Color(0.4f, 0.6f, 1f, 1f);
    // An alert: a light red, readable on the dark bubble.
    private static final Color ALERT_COLOR = new Color(1f, 0.4f, 0.4f, 1f);
    // The growth of a crop: the seed takes the red of the alert; orange and green are as light, readable on the
    // bubble as on the grass.
    private static final Color GROWING_COLOR = new Color(1f, 0.65f, 0.2f, 1f);
    private static final Color RIPE_COLOR = new Color(0.4f, 1f, 0.4f, 1f);
    // The range of a defense: white at 35 %, the grass and the crops stay visible under it.
    private static final float RANGE_OPACITY = 0.35f;
    // The night: a very dark blue. Its opacity comes from NightRenderer.
    private static final float NIGHT_RED = 0.02f;
    private static final float NIGHT_GREEN = 0.03f;
    private static final float NIGHT_BLUE = 0.15f;
    // The ghost defense of the tutorial: its own colors, 60 % opaque, so it reads as "not really there".
    private static final float GHOST_OPACITY = 0.6f;
    // The mask of the tutorial: black at 50 %, the game stays visible under it, but dim.
    private static final float SHADE_OPACITY = 0.5f;
    // The arrow of the tutorial: 16 px long, one tile. A head 8 px long and 12 px high, then a shaft 8 px long and
    // 4 px high. Yellow: it is seen on the grass, on the trees and on the map behind the shop.
    private static final float ARROW_HEAD_LENGTH = 8f;
    private static final float ARROW_HEAD_HALF_HEIGHT = 6f;
    private static final float ARROW_SHAFT_LENGTH = 8f;
    private static final float ARROW_SHAFT_HEIGHT = 4f;
    // The layer of the Tiled map drawn over the enemies: they seem to come out from behind these trees.
    private static final String FRONT_LAYER = "trees_front";

    //-------------------- STATE --------------------
    // What is open right now. The batch and the outline renderer cannot be open together:
    // a second begin() throws an exception.
    // OUTLINES draws the edges of the shapes, FILLED fills them (the arrow): ShapeRenderer has one kind per begin().
    private enum Mode { NOTHING, SPRITES, OUTLINES, FILLED }

    private Mode mode = Mode.NOTHING;

    //-------------------- FIELDS --------------------
    private final SpriteBatch batch;
    private final OrthographicCamera camera;
    private final TiledMap map;
    private final ShapeRenderer shapes = new ShapeRenderer();
    // new BitmapFont(): no file to load, the font is inside the libGDX jar.
    private final BitmapFont font = new BitmapFont();
    // A second font object: setScale changes the whole font, so the HUD keeps its own at full size.
    private final BitmapFont labelFont = createLabelFont();
    // Measures a text to size its bubble. One object, reused: drawText runs on every frame.
    private final GlyphLayout textSize = new GlyphLayout();
    // One white pixel, stretched to the size of a bubble and tinted black by the batch; also the night veil, tinted blue.
    private final Texture bubblePixel = createWhitePixel();
    // Each image is loaded once, the first time it is drawn, and freed in dispose(): one place for both.
    private final Map<String, Texture> textures = new HashMap<>();
    // Created once, at the first drawMap, then reused on every frame.
    private OrthogonalTiledMapRenderer mapRenderer;
    // The indexes of the map layers, split in two: under the sprites, and over them.
    private final int[] backLayers;
    private final int[] frontLayers;

    //-------------------- CONSTRUCTOR --------------------
    // Called once by GameScreen.show(), once a window exists: a ShapeRenderer cannot be created before.
    /**
     * Creates the canvas.
     *
     * @param batch the batch that draws the sprites, freed by the screen
     * @param camera the camera that decides what part of the world is seen
     * @param map the Tiled map to draw, freed by the screen
     */
    public GdxCanvas(SpriteBatch batch, OrthographicCamera camera, TiledMap map) {
        this.batch = batch;
        this.camera = camera;
        this.map = map;
        int front = map.getLayers().getIndex(FRONT_LAYER);
        backLayers = IntStream.range(0, map.getLayers().getCount()).filter(index -> index != front).toArray();
        frontLayers = new int[] {front};
    }

    //-------------------- CANVAS --------------------
    // Called first on every frame, by WorldRenderer. The map renderer has its own batch: everything must be closed before it draws.
    /**
     * Draws the tile layers of the map.
     */
    @Override
    public void drawMap() {
        switchTo(Mode.NOTHING);
        if (mapRenderer == null) {
            mapRenderer = new OrthogonalTiledMapRenderer(map);
        }
        mapRenderer.setView(camera);
        mapRenderer.render(backLayers);
    }

    // Called by the renderers for each sprite. The width and height given to batch.draw stretch the image to the area.
    // HURT: setColor multiplies each pixel by HURT_COLOR, so red stays and green and blue drop to 30 %.
    // UPGRADED: the same with UPGRADED_COLOR, so the sprite turns blue. GHOST: white keeps the colors, only the alpha
    // drops.
    // It is reset to white right after, or every sprite drawn next would be tinted too.
    /**
     * Draws a sprite, stretched to fill the given area, with a tint.
     *
     * @param spriteKey the name of the sprite in {@link SpriteCatalog}
     * @param area where to draw it
     * @param tint {@link Tint#NORMAL} for the image as it is, {@link Tint#HURT} for red, {@link Tint#UPGRADED} for
     *     blue, {@link Tint#GHOST} for partly transparent
     */
    @Override
    public void drawSprite(String spriteKey, Bounds area, Tint tint) {
        switchTo(Mode.SPRITES);
        if (tint == Tint.HURT) {
            batch.setColor(HURT_COLOR);
        } else if (tint == Tint.UPGRADED) {
            batch.setColor(UPGRADED_COLOR);
        } else if (tint == Tint.GHOST) {
            batch.setColor(1f, 1f, 1f, GHOST_OPACITY);
        }
        batch.draw(textureOf(spriteKey), area.x(), area.y(), area.width(), area.height());
        batch.setColor(Color.WHITE);
    }

    // Called by the HUD. The bubble is drawn first, so the text sits on it. Every text gets one, without the HUD knowing.
    // setColor only tints the images: the font keeps its own color (white). It is reset, or the next sprites would be black.
    // font.draw: the y is the top of the text. The font draws through the batch, like a sprite.
    // GREYED and ALERT: the font takes their colour (colorOf) for this text only, then back to white, or every next
    // text would keep it.
    /**
     * Draws a line of text on a slightly transparent black bubble, white, grey or red.
     *
     * @param text the text
     * @param x the left edge of the text
     * @param y the top edge of the text
     * @param style {@link TextStyle#NORMAL} for white, {@link TextStyle#GREYED} for grey, {@link TextStyle#ALERT}
     *     for red
     */
    @Override
    public void drawText(String text, float x, float y, TextStyle style) {
        switchTo(Mode.SPRITES);
        textSize.setText(font, text);
        drawBubble(x, y, BUBBLE_PADDING);
        font.setColor(colorOf(style));
        font.draw(batch, text, x, y);
        font.setColor(Color.WHITE);
    }

    // Called by DefenseRenderer for each defense. The text is measured first, to start it half its width to the left.
    /**
     * Draws a small line of white text on a slightly transparent black bubble, centred on the given x.
     *
     * @param text the text
     * @param centerX the middle of the text
     * @param y the top edge of the text
     */
    @Override
    public void drawLabel(String text, float centerX, float y) {
        switchTo(Mode.SPRITES);
        textSize.setText(labelFont, text);
        float x = centerX - textSize.width / 2;
        drawBubble(x, y, LABEL_PADDING);
        labelFont.draw(batch, text, x, y);
    }

    // Called by EndScene. The text is measured with the HUD font, then drawn like any text, half its width to the left.
    /**
     * Draws a line of white text on a slightly transparent black bubble, centred on the given x.
     *
     * @param text the text
     * @param centerX the middle of the text
     * @param y the top edge of the text
     */
    @Override
    public void drawCenteredText(String text, float centerX, float y) {
        textSize.setText(font, text);
        drawText(text, centerX - textSize.width / 2, y, TextStyle.NORMAL);
    }

    // Called by the HUD the day before the last night. Each line is measured with the small font of the labels:
    // the bubble is as wide as the longest one, and as tall as one line (capHeight) plus one line height per next
    // line. setScale(0.5) also scales lineHeight and capHeight (BitmapFontData.setScale): 9 px per line, not 18.
    // Then the lines, one line height apart, in the colour of the style, and back to white like drawText.
    /**
     * Draws lines of small text, one under the other, on a single slightly transparent black bubble.
     *
     * @param lines the lines, from the top one
     * @param x the left edge of the text
     * @param y the top edge of the first line
     * @param style {@link TextStyle#NORMAL} for white, {@link TextStyle#GREYED} for grey, {@link TextStyle#ALERT}
     *     for red
     */
    @Override
    public void drawNote(List<String> lines, float x, float y, TextStyle style) {
        switchTo(Mode.SPRITES);
        float width = 0;
        for (String line : lines) {
            textSize.setText(labelFont, line);
            width = Math.max(width, textSize.width);
        }
        float lineHeight = labelFont.getLineHeight();
        float height = labelFont.getCapHeight() + (lines.size() - 1) * lineHeight;
        drawBubble(x, y, width, height, LABEL_PADDING);
        labelFont.setColor(colorOf(style));
        for (int line = 0; line < lines.size(); line++) {
            labelFont.draw(batch, lines.get(line), x, y - line * lineHeight);
        }
        labelFont.setColor(Color.WHITE);
    }

    // Called by NeighbourRenderer while she talks. The dark box first, the same black as the bubbles, from its top left
    // corner (drawBubble draws downwards from its y) with no padding: the box is the area. Then the lines with the HUD
    // font, at full size: 8 px from the left edge, the first one 4 px under the top, one line height (18 px) apart.
    /**
     * Fills an area with the dark color of the bubbles, then writes lines of white text in it, at the size of the
     * HUD, from its top left corner.
     *
     * @param lines the lines, from the top one
     * @param area the dark box
     */
    @Override
    public void drawDialog(List<String> lines, Bounds area) {
        switchTo(Mode.SPRITES);
        float top = area.y() + area.height();
        drawBubble(area.x(), top, area.width(), area.height(), 0);
        float lineHeight = font.getLineHeight();
        for (int line = 0; line < lines.size(); line++) {
            font.draw(batch, lines.get(line), area.x() + DIALOG_LEFT, top - DIALOG_TOP - line * lineHeight);
        }
    }

    // Called by OutlineRenderer for each cell and slot. ShapeType.Line draws the edges only, so the map stays visible inside.
    /**
     * Draws the edges of a rectangle, without filling it.
     *
     * @param area the rectangle
     * @param color the color of the edges
     */
    @Override
    public void drawOutline(Bounds area, OutlineColor color) {
        switchTo(Mode.OUTLINES);
        shapes.setColor(switch (color) {
            case GREEN -> Color.GREEN;
            case YELLOW -> Color.YELLOW;
            case WHITE -> Color.WHITE;
        });
        shapes.rect(area.x(), area.y(), area.width(), area.height());
    }

    // Called by NightRenderer, after the front trees and before the HUD: the HUD stays readable.
    // The same white pixel as the bubbles, stretched to the area and tinted dark blue; the opacity goes in the alpha.
    /**
     * Covers the given area with a dark blue, partly transparent layer.
     *
     * @param area the area to cover
     * @param opacity from 0 (invisible) to 1 (opaque)
     */
    @Override
    public void drawNightVeil(Bounds area, float opacity) {
        switchTo(Mode.SPRITES);
        batch.setColor(NIGHT_RED, NIGHT_GREEN, NIGHT_BLUE, opacity);
        batch.draw(bubblePixel, area.x(), area.y(), area.width(), area.height());
        batch.setColor(Color.WHITE);
    }

    // Called by GrowthRenderer for each crop. The same white pixel, tinted with the color of the style, fully opaque.
    /**
     * Fills a small rectangle with the color of a text style.
     *
     * @param area the rectangle
     * @param color {@link TextStyle#SEED} for red, {@link TextStyle#GROWING} for orange, {@link TextStyle#RIPE} for
     *     green
     */
    @Override
    public void drawDot(Bounds area, TextStyle color) {
        switchTo(Mode.SPRITES);
        batch.setColor(colorOf(color));
        batch.draw(bubblePixel, area.x(), area.y(), area.width(), area.height());
        batch.setColor(Color.WHITE);
    }

    // Called by OutlineRenderer.renderRange for each cell a defense reaches. The white pixel keeps its white, only its
    // alpha drops: the cell lightens without being hidden.
    /**
     * Covers a cell with a white, partly transparent layer.
     *
     * @param area the cell to cover
     */
    @Override
    public void drawRangeVeil(Bounds area) {
        switchTo(Mode.SPRITES);
        batch.setColor(1f, 1f, 1f, RANGE_OPACITY);
        batch.draw(bubblePixel, area.x(), area.y(), area.width(), area.height());
        batch.setColor(Color.WHITE);
    }

    // Called by the tutorial, after its bubble: the arrow is over the shop list it points at. The head is a triangle
    // whose tip is the given point; the shaft a rectangle behind it, on its left, centred on the same height.
    /**
     * Draws a small filled yellow arrow pointing to the right, its tip on the given point.
     *
     * @param tip where the arrow points, in world pixels
     */
    @Override
    public void drawArrow(Point tip) {
        switchTo(Mode.FILLED);
        shapes.setColor(Color.YELLOW);
        float headBase = tip.x() - ARROW_HEAD_LENGTH;
        shapes.triangle(tip.x(), tip.y(),
                headBase, tip.y() + ARROW_HEAD_HALF_HEIGHT,
                headBase, tip.y() - ARROW_HEAD_HALF_HEIGHT);
        shapes.rect(headBase - ARROW_SHAFT_LENGTH, tip.y() - ARROW_SHAFT_HEIGHT / 2,
                ARROW_SHAFT_LENGTH, ARROW_SHAFT_HEIGHT);
    }

    // Called by the tutorial, four times per frame: the four bands around the target of its bubble. The same white pixel
    // as the bubbles, tinted black, half transparent.
    /**
     * Covers the given area with a black, partly transparent layer.
     *
     * @param area the area to darken
     */
    @Override
    public void drawShade(Bounds area) {
        switchTo(Mode.SPRITES);
        batch.setColor(0f, 0f, 0f, SHADE_OPACITY);
        batch.draw(bubblePixel, area.x(), area.y(), area.width(), area.height());
        batch.setColor(Color.WHITE);
    }

    //-------------------- FRAME --------------------
    // Called by GameScreen after the enemies, so the trees hide them. drawMap has already set the view in this frame.
    /**
     * Draws the trees that stand in front of the enemies.
     */
    public void drawFront() {
        switchTo(Mode.NOTHING);
        mapRenderer.render(frontLayers);
    }

    // Called by GameScreen at the end of render: what is still open is sent to the screen.
    /**
     * Ends the frame.
     */
    public void endFrame() {
        switchTo(Mode.NOTHING);
    }

    //-------------------- LIFECYCLE --------------------
    // Called by GameScreen.dispose(). Java's garbage collector does not free graphics memory.
    /**
     * Frees the outline renderer, the two fonts, the bubble pixel, the images and the map renderer.
     */
    public void dispose() {
        shapes.dispose();
        font.dispose();
        labelFont.dispose();
        bubblePixel.dispose();
        for (Texture texture : textures.values()) {
            texture.dispose();
        }
        if (mapRenderer != null) {
            mapRenderer.dispose();
        }
    }

    //-------------------- INTERNALS --------------------
    // Closes what is open, then opens what the next drawing needs. setProjectionMatrix: without it,
    // the places would be read as window pixels, not world pixels.
    private void switchTo(Mode next) {
        if (mode == next) {
            return;
        }
        if (mode == Mode.SPRITES) {
            batch.end();
        } else if (mode == Mode.OUTLINES || mode == Mode.FILLED) {
            shapes.end();
        }
        if (next == Mode.SPRITES) {
            batch.setProjectionMatrix(camera.combined);
            batch.begin();
        } else if (next == Mode.OUTLINES) {
            shapes.setProjectionMatrix(camera.combined);
            shapes.begin(ShapeRenderer.ShapeType.Line);
        } else if (next == Mode.FILLED) {
            shapes.setProjectionMatrix(camera.combined);
            shapes.begin(ShapeRenderer.ShapeType.Filled);
        }
        mode = next;
    }

    // The bubble behind a text already measured in textSize. setColor only tints the images: it is reset to white,
    // or the next sprites would be black.
    private void drawBubble(float x, float y, float padding) {
        drawBubble(x, y, textSize.width, textSize.height, padding);
    }

    // The bubble behind a block of text whose top left corner is (x, y), of the given size.
    private void drawBubble(float x, float y, float width, float height, float padding) {
        batch.setColor(0f, 0f, 0f, BUBBLE_OPACITY);
        batch.draw(bubblePixel, x - padding, y - height - padding, width + 2 * padding, height + 2 * padding);
        batch.setColor(Color.WHITE);
    }

    // The colour of a text style. A switch over the enum, with no default: a fourth TextStyle does not compile until
    // its colour is here.
    private static Color colorOf(TextStyle style) {
        return switch (style) {
            case NORMAL -> Color.WHITE;
            case GREYED -> Color.GRAY;
            case ALERT, SEED -> ALERT_COLOR;
            case GROWING -> GROWING_COLOR;
            case RIPE -> RIPE_COLOR;
        };
    }

    // getData().setScale: every glyph of this font object is drawn at that size.
    private static BitmapFont createLabelFont() {
        BitmapFont labelFont = new BitmapFont();
        labelFont.getData().setScale(LABEL_SCALE);
        return labelFont;
    }

    // Pixmap: an image in memory. Texture copies it to the graphics card, so the pixmap is freed right away.
    private static Texture createWhitePixel() {
        Pixmap pixmap = new Pixmap(1, 1, Pixmap.Format.RGBA8888);
        pixmap.setColor(Color.WHITE);
        pixmap.fill();
        Texture texture = new Texture(pixmap);
        pixmap.dispose();
        return texture;
    }

    // computeIfAbsent: loads the image only if the table does not hold it yet.
    private Texture textureOf(String spriteKey) {
        return textures.computeIfAbsent(spriteKey, key -> new Texture(SpriteCatalog.pathOf(key)));
    }
}
