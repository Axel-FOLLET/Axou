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

    // One line per extended call: the operation, then its arguments in declaration order.
    public final List<String> extras = new ArrayList<>();

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

    // The neighbour's dialog: its lines joined by " / ", then its box.
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
    @Override
    public void drawAnimation(String spriteKey, Bounds area, float time, Tint tint) {
        extras.add("animation " + spriteKey + " " + area + " " + time + " " + tint);
        Canvas.super.drawAnimation(spriteKey, area, time, tint);
    }

    @Override
    public void drawSprite(String spriteKey, Bounds area, float time, SpriteStyle style) {
        extras.add("styled " + spriteKey + " " + area + " " + time + " " + style);
        Canvas.super.drawSprite(spriteKey, area, time, style);
    }

    @Override
    public void drawFrame(String spriteKey, Bounds area, Tint tint) {
        extras.add("frame " + spriteKey + " " + area + " " + tint);
        Canvas.super.drawFrame(spriteKey, area, tint);
    }

    @Override
    public void drawPlainText(String text, float x, float y, TextStyle style) {
        extras.add("plain " + text + " " + x + " " + y + " " + style);
        Canvas.super.drawPlainText(text, x, y, style);
    }

    @Override
    public void drawPlainCenteredText(String text, float centerX, float y, TextStyle style) {
        extras.add("plainCentered " + text + " " + centerX + " " + y + " " + style);
        Canvas.super.drawPlainCenteredText(text, centerX, y, style);
    }

    @Override
    public void drawLight(String spriteKey, Bounds area, float alpha, float red, float green, float blue) {
        String line = "light " + spriteKey + " " + area + " " + alpha;
        extras.add(red == 1f && green == 1f && blue == 1f ? line : line + " " + red + " " + green + " " + blue);
    }

    @Override
    public void drawColorLayer(Bounds area, float red, float green, float blue, float alpha) {
        extras.add("color " + area + " " + red + " " + green + " " + blue + " " + alpha);
        Canvas.super.drawColorLayer(area, red, green, blue, alpha);
    }

    @Override
    public void drawMultiplyLayer(Bounds area, float red, float green, float blue) {
        extras.add("multiply " + area + " " + red + " " + green + " " + blue);
        Canvas.super.drawMultiplyLayer(area, red, green, blue);
    }

    @Override
    public void shake(float strength) {
        extras.add("shake " + strength);
        Canvas.super.shake(strength);
    }

    @Override
    public void drawParticle(String spriteKey, float centerX, float centerY, float size, float rotation, float alpha) {
        extras.add("particle " + spriteKey + " " + centerX + " " + centerY + " " + size + " " + rotation + " " + alpha);
        Canvas.super.drawParticle(spriteKey, centerX, centerY, size, rotation, alpha);
    }

    @Override
    public void drawFloatingText(String text, float centerX, float y, float alpha, TextStyle style) {
        extras.add("float " + text + " " + centerX + " " + y + " " + alpha + " " + style);
        Canvas.super.drawFloatingText(text, centerX, y, alpha, style);
    }
}
