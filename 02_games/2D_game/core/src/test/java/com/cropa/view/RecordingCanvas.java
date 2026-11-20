package com.cropa.view;

// Java: the list of calls received.
import java.util.ArrayList;
import java.util.List;

// implements Canvas: the fake given to the renderers in the tests. It draws nothing and writes down each call,
// so a test checks what a renderer asks for, in which order, without a window. Public: view.world and view.enemy use it too.
/**
 * A {@link Canvas} that records its calls as text.
 */
public class RecordingCanvas implements Canvas {

    //-------------------- FIELDS --------------------
    // One line per call, in the order of the calls.
    public final List<String> calls = new ArrayList<>();

    //-------------------- CANVAS --------------------
    @Override
    public void drawMap() {
        calls.add("map");
    }

    // NORMAL keeps the line it had before the tints, so the older tests stay true; HURT adds the word at the end.
    @Override
    public void drawSprite(String spriteKey, Bounds area, Tint tint) {
        String line = "sprite " + spriteKey + " " + area;
        calls.add(tint == Tint.NORMAL ? line : line + " " + tint);
    }

    // Like the tints: NORMAL keeps the line it had before the styles, so the older tests stay true; GREYED adds the word.
    @Override
    public void drawText(String text, float x, float y, TextStyle style) {
        String line = "text " + text + " " + x + " " + y;
        calls.add(style == TextStyle.NORMAL ? line : line + " " + style);
    }

    @Override
    public void drawLabel(String text, float centerX, float y) {
        calls.add("label " + text + " " + centerX + " " + y);
    }

    @Override
    public void drawCenteredText(String text, float centerX, float y) {
        calls.add("centered " + text + " " + centerX + " " + y);
    }

    // Melda's dialog: its lines joined by " / ", then its box.
    @Override
    public void drawDialog(List<String> lines, Bounds area) {
        calls.add("dialog " + String.join(" / ", lines) + " " + area);
    }

    // The lines of a note joined by " / ", in one call: one block on one bubble.
    @Override
    public void drawNote(List<String> lines, float x, float y, TextStyle style) {
        String line = "note " + String.join(" / ", lines) + " " + x + " " + y;
        calls.add(style == TextStyle.NORMAL ? line : line + " " + style);
    }

    @Override
    public void drawOutline(Bounds area, OutlineColor color) {
        calls.add("outline " + color + " " + area);
    }

    @Override
    public void drawNightVeil(Bounds area, float opacity) {
        calls.add("veil " + area + " " + opacity);
    }

    @Override
    public void drawDot(Bounds area, TextStyle color) {
        calls.add("dot " + area + " " + color);
    }

    @Override
    public void drawRangeVeil(Bounds area) {
        calls.add("range " + area);
    }

    @Override
    public void drawArrow(Point tip) {
        calls.add("arrow " + tip);
    }

    @Override
    public void drawShade(Bounds area) {
        calls.add("shade " + area);
    }
}
