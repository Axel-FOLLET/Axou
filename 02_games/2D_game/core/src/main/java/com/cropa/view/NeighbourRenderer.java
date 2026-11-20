package com.cropa.view;

// The neighbour: her visit in the model, read at each frame (phase, walk progress, words) and told of a click (nextBubble).
// Texts: the words of her button, in the language of the game.
// ArrayList and List: her paths, and the lines of her bubble cut from her text.
import com.cropa.model.game.Neighbour;
import com.cropa.text.Texts;
import java.util.ArrayList;
import java.util.List;

// The neighbour on screen (day 12). No event: the view reads the model at each frame, like the enemies, so she appears on
// her day and goes at the night without anyone telling the view. The model gives her phase and how far she is in a
// walk (0 to 1); this class turns that into a place on the map, along paths drawn here. No libGDX: the places, the
// dialog and the button are tested on a RecordingCanvas.
/**
 * Draws the neighbour's visit: her walk in the forest, her way to Garry around the farm, her dialog with its "Passer à la
 * suite" button while she talks, and her way out by the dirt road.
 */
public class NeighbourRenderer {

    //-------------------- CONSTANTS --------------------
    // Her sprite: 24 px from a 32 px image (scale 0.75), about the farmer's scale (32 px from 48). A point of her
    // paths is the middle of the bottom edge of her square (her feet stand 1.5 px above: 2 empty rows in the image).
    private static final float NEIGHBOUR_SIZE = 24f;
    // Her 8 images, one per direction, in the order of the angles: east is 0°, then every 45° counterclockwise (y goes
    // up in the world). Each name is the end of a key of SpriteCatalog ("neighbour_north_east").
    private static final String[] DIRECTIONS =
        {"east", "north_east", "north", "north_west", "west", "south_west", "south", "south_east"};
    // The map has no point for her: her paths are placed from the farm point (x 160, y 160 on map_v1) and from the
    // farmer's point (x 216). In the forest: under the dirt road, among the pines on the left (x 20 to 75, y 88 to
    // 108). To Garry: up to the road, through the gate of the fence (x 85 to 107, the road at y 150), then under the
    // farm and its flower pots (y 122), never through it, and in front of Garry, under his chair (y 128): she faces
    // him, so the player sees her back. Out: the same way back to the gate, then west along the road, off the screen.
    private static final float[][] FOREST = {{-140, -56}, {-100, -64}, {-120, -72}, {-85, -52}};
    private static final float[][] TO_THE_GATE = {{-90, -18}, {-50, -10}, {-32, -36}, {40, -38}};
    private static final float[][] AWAY_BY_THE_ROAD = {{-50, -10}, {-180, -10}};
    private static final float BELOW_GARRY = 32f;
    // The small speech bubble while she talks: 24 px from a 48 px image (scale 0.5), on her left at the height of her
    // head (the drawing fills the rows 14 to 33 of the image). Over her head, it would cover Garry's legs.
    private static final float BUBBLE_SIZE = 24f;
    private static final float BUBBLE_LEFT = 24f;
    private static final float BUBBLE_UP = 6f;
    // Her dialog, in the frame Axel drew under the farm, over the forest (x 104 to 348, y 10 to 88). The HUD font:
    // 18 px per line, 34 letters at most per line (her longest line: 224 px, measured on lsans-15), 3 lines at most.
    // The button at the bottom right: its outline 3 px around its words, 16 px under the top of the text and 3 px above
    // it, like the "Lancer la nuit" button of the HUD, ending at x 343. "Passer à la suite" is 109 px wide (measured):
    // its outline from x 228.
    private static final Bounds DIALOG_AREA = new Bounds(104, 10, 244, 78);
    private static final int LINE_LENGTH = 34;
    private static final int MAX_LINES = 3;
    private static final float NEXT_RIGHT = 343f;
    private static final float NEXT_TOP = 27f;

    //-------------------- FIELDS --------------------
    // Computed once: her paths never change during a game. The forest walk, the way from its last point to Garry,
    // the way out from Garry, and her place in front of him.
    private final List<Point> forest = new ArrayList<>();
    private final List<Point> toGarry = new ArrayList<>();
    private final List<Point> away = new ArrayList<>();
    private final Point talkPlace;
    // The words of her button, in the language of the game, and its outline, sized from them.
    private final String nextLabel;
    private final Bounds nextButton;

    //-------------------- CONSTRUCTOR --------------------
    // Called once by GameScreen.show(). Every point comes from the farm point; her place in front of Garry from the
    // farmer's x. The way to Garry starts where the forest walk ends; the way out starts at Garry and goes back under
    // the farm (the way in, reversed) before it turns west at the gate.
    /**
     * Computes the paths of the neighbour from the places of the map.
     *
     * @param layout the places read from the map
     * @param texts the words of her button, in the language of the game
     */
    public NeighbourRenderer(BoardLayout layout, Texts texts) {
        nextLabel = texts.neighbourNext();
        float width = TextWidth.of(nextLabel) + 6;
        nextButton = new Bounds(NEXT_RIGHT - width, NEXT_TOP - 16, width, 19);
        Point farm = layout.getSpot("farm");
        talkPlace = new Point(layout.getSpot("farmer").x(), farm.y() - BELOW_GARRY);
        for (float[] offset : FOREST) {
            forest.add(from(farm, offset));
        }
        toGarry.add(forest.get(forest.size() - 1));
        for (float[] offset : TO_THE_GATE) {
            toGarry.add(from(farm, offset));
        }
        toGarry.add(talkPlace);
        for (int index = toGarry.size() - 1; index >= 3; index--) {
            away.add(toGarry.get(index));
        }
        for (float[] offset : AWAY_BY_THE_ROAD) {
            away.add(from(farm, offset));
        }
    }

    //-------------------- DRAWING --------------------
    // Called on every frame by GameScreen, with the enemies, before the front trees: in the forest, the trees in
    // front of her hide her, like the enemies.
    // Walking: her place along the path of her phase, turned the way she goes. Talking: in front of Garry, her back
    // to the player, with the small bubble beside her head. Before her day and once she left: nothing.
    /**
     * Draws the neighbour where she is in her visit, turned the way she walks, with a small speech bubble while she talks.
     *
     * @param canvas where to draw
     * @param neighbour the neighbour, read as she is now
     */
    public void renderNeighbour(Canvas canvas, Neighbour neighbour) {
        switch (neighbour.getPhase()) {
            case WANDERING -> drawWalking(canvas, forest, neighbour.getWalkProgress());
            case ARRIVING -> drawWalking(canvas, toGarry, neighbour.getWalkProgress());
            case LEAVING -> drawWalking(canvas, away, neighbour.getWalkProgress());
            case TALKING -> {
                drawAt(canvas, talkPlace, "north");
                canvas.drawSprite("neighbour_bubble", new Bounds(talkPlace.x() - NEIGHBOUR_SIZE / 2 - BUBBLE_LEFT,
                    talkPlace.y() + BUBBLE_UP, BUBBLE_SIZE, BUBBLE_SIZE));
            }
            default -> {
                // ABSENT or GONE: nothing to draw.
            }
        }
    }

    // Called on every frame by GameScreen, after the HUD and the shop panel: her dialog covers them while she talks.
    // The written words in the dark box. The box is drawn even with no whole word yet (the start of each bubble): it
    // stays in place from her first bubble to her last, instead of blinking between two bubbles. Then the button:
    // grey while she writes, white once the bubble is whole (Axel, day 12), with the white outline of the HUD buttons.
    /**
     * Draws her dialog while she talks: the written words of her bubble in a dark box, and the "Passer à la suite"
     * button, greyed until the bubble is fully written.
     *
     * @param canvas where to draw
     * @param neighbour the neighbour, read as she is now
     */
    public void renderDialog(Canvas canvas, Neighbour neighbour) {
        if (!neighbour.isTalking()) {
            return;
        }
        String words = neighbour.getCurrentBubble();
        canvas.drawDialog(words.isEmpty() ? List.of() : linesOf(words), DIALOG_AREA);
        TextStyle style = neighbour.isBubbleWritten() ? TextStyle.NORMAL : TextStyle.GREYED;
        canvas.drawText(nextLabel, nextButton.x() + 3, NEXT_TOP, style);
        canvas.drawOutline(nextButton, OutlineColor.WHITE);
    }

    //-------------------- CLICKS --------------------
    // Called by GameScreen on every click while she talks: she has the whole screen (Axel, day 12), no other part of
    // the game receives the click. On the button, nextBubble: it does nothing until the bubble is whole, so a click
    // never writes faster nor skips a bubble. Anywhere else, nothing.
    /**
     * Takes a click while the neighbour talks: on the "Passer à la suite" button, her next bubble once the current one is
     * fully written; anywhere else, nothing.
     *
     * @param neighbour the neighbour
     * @param x the x of the click, in world pixels
     * @param y the y of the click, in world pixels
     * @return {@code true} while she talks: the click is hers, wherever it lands
     */
    public boolean handleClick(Neighbour neighbour, float x, float y) {
        if (!neighbour.isTalking()) {
            return false;
        }
        if (nextButton.contains(x, y)) {
            neighbour.nextBubble();
        }
        return true;
    }

    //-------------------- BUTTONS --------------------
    // Read by the tests, which click in its middle.
    /**
     * Returns the "Passer à la suite" button of her dialog.
     *
     * @return its area, in world pixels
     */
    public Bounds nextButton() {
        return nextButton;
    }

    //-------------------- INTERNALS --------------------
    // A point of a path: the farm point moved by an offset {x, y}.
    private static Point from(Point farm, float[] offset) {
        return new Point(farm.x() + offset[0], farm.y() + offset[1]);
    }

    // Her sprite with its bottom edge centred on the point, turned to the direction given.
    private static void drawAt(Canvas canvas, Point feet, String direction) {
        canvas.drawSprite("neighbour_" + direction,
            new Bounds(feet.x() - NEIGHBOUR_SIZE / 2, feet.y(), NEIGHBOUR_SIZE, NEIGHBOUR_SIZE));
    }

    // Her place along a path, at the same speed all along: progress 0.5 is half the length of the path, whatever
    // the lengths of its parts. The part where that distance falls is found, then the point inside it; she is turned
    // the way of that part.
    private static void drawWalking(Canvas canvas, List<Point> path, float progress) {
        float total = 0;
        for (int index = 0; index < path.size() - 1; index++) {
            total += distance(path.get(index), path.get(index + 1));
        }
        float left = Math.max(0f, Math.min(1f, progress)) * total;
        for (int index = 0; index < path.size() - 1; index++) {
            Point start = path.get(index);
            Point end = path.get(index + 1);
            float length = distance(start, end);
            boolean lastPart = index == path.size() - 2;
            if (left <= length || lastPart) {
                float share = length == 0 ? 0 : Math.min(1f, left / length);
                Point here = new Point(start.x() + (end.x() - start.x()) * share,
                    start.y() + (end.y() - start.y()) * share);
                drawAt(canvas, here, directionOf(start, end));
                return;
            }
            left -= length;
        }
    }

    private static float distance(Point start, Point end) {
        return (float) Math.hypot(end.x() - start.x(), end.y() - start.y());
    }

    // The closest of her 8 directions to a move: atan2 gives the angle of the move (0° east, 90° north, as y goes up),
    // divided into 45° slices; Math.floorMod keeps the slice between 0 and 7 for the negative angles (south is -90°).
    static String directionOf(Point start, Point end) {
        double degrees = Math.toDegrees(Math.atan2(end.y() - start.y(), end.x() - start.x()));
        int slice = Math.floorMod((int) Math.round(degrees / 45), DIRECTIONS.length);
        return DIRECTIONS[slice];
    }

    // Cuts a text into lines of 34 letters at most, between two words: each word goes on the current line if it
    // still fits (with its space), otherwise it starts a new line. The words come one by one on screen: a word
    // that just appeared never moves the words before it, since the cut of a line only depends on the words before.
    // More than 3 lines (a text longer than hers): only the last 3 are kept, so the newest words stay on screen.
    // Package-private: the tests check the cut of her real texts.
    static List<String> linesOf(String text) {
        List<String> lines = new ArrayList<>();
        String line = "";
        for (String word : text.split(" ")) {
            if (line.isEmpty()) {
                line = word;
            } else if (line.length() + 1 + word.length() <= LINE_LENGTH) {
                line = line + " " + word;
            } else {
                lines.add(line);
                line = word;
            }
        }
        lines.add(line);
        return lines.subList(Math.max(0, lines.size() - MAX_LINES), lines.size());
    }
}
