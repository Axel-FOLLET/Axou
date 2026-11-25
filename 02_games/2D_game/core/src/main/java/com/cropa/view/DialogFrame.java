package com.cropa.view;

/** The four-unit atlas border around a dialog and its speaker. */
final class DialogFrame {
    static final int BORDER = 4;
    private static final int PORTRAIT = 24;
    private static final int TAIL = 8;

    private DialogFrame() {}

    static Bounds around(Bounds area) {
        return new Bounds(area.x() - BORDER, area.y() - BORDER,
                area.width() + 2 * BORDER, area.height() + 2 * BORDER);
    }

    static void draw(Canvas canvas, Bounds area, String speaker) {
        Bounds frame = around(area);
        float top = area.y() + area.height();
        Bounds portrait = new Bounds(frame.x() - TAIL - BORDER - PORTRAIT, top - PORTRAIT, PORTRAIT, PORTRAIT);
        canvas.drawFrame(SpriteCatalog.BUBBLE_FRAME, frame, Tint.NORMAL);
        canvas.drawFrame(SpriteCatalog.PORTRAIT_FRAME, around(portrait), Tint.NORMAL);
        canvas.drawSprite(speaker, portrait);
        canvas.drawSprite("bubble_tail_left", new Bounds(frame.x() - TAIL, top - PORTRAIT / 2, TAIL, TAIL));
    }
}
