package com.cropa.view;

/** A world-space pointer sample, independent of the input backend. */
public record Pointer(float x, float y, boolean pressed) {
    public static final Pointer AWAY = new Pointer(-1, -1, false);

    public boolean over(Bounds area) {
        return area.contains(x, y);
    }

    /** Disabled takes precedence over pressed and hovered. */
    String frame(String kind, Bounds area, boolean disabled) {
        String state = disabled ? "_disabled" : !over(area) ? "" : pressed ? "_pressed" : "_hover";
        return kind + state + "_frame";
    }

    /** All clickable text uses the original three-unit inset and baseline. */
    void button(Canvas canvas, Bounds area, String label, TextStyle style) {
        canvas.drawFrame(frame("button", area, style == TextStyle.GREYED), area, Tint.NORMAL);
        canvas.drawPlainText(label, area.x() + 3, area.y() + 16, style);
    }
}
