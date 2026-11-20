package com.cropa.view;

// No import: plain Java, so the width of a text is known without libGDX, in the tests as in the game.
/**
 * The width of a text in the font of the game (lsans-15, the default font of libGDX), in world pixels.
 * The buttons are sized from it, so their outline fits their words in every language.
 */
public final class TextWidth {

    //-------------------- CONSTANTS --------------------
    // The xadvance of each character of lsans-15.fnt (inside the libGDX jar), from character 0 to 255:
    // how far the next letter starts. -1: the font has no such character, and libGDX draws nothing for it.
    // GlyphLayout measures a line as the sum of these advances plus the kerning of each pair of letters: the widths
    // written in the comments of the view ("Planter" 46 px, "Lancer la nuit" 87 px) are this sum.
    private static final int FIRST = 0;
    private static final int[] ADVANCES = {
        11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
        -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
        4, 5, 5, 8, 8, 13, 10, 3, 5, 5, 6, 9, 4, 5, 4, 4,
        8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 4, 4, 9, 9, 9, 8,
        15, 9, 10, 11, 11, 10, 9, 11, 10, 3, 7, 10, 8, 11, 10, 12,
        10, 12, 11, 10, 9, 10, 9, 15, 9, 9, 8, 4, 4, 4, 5, 8,
        5, 8, 8, 8, 8, 8, 4, 8, 8, 3, 3, 7, 3, 13, 8, 8,
        8, 8, 5, 8, 4, 8, 7, 11, 7, 7, 8, 5, 3, 5, 9, -1,
        -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
        -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
        4, 5, 8, 8, 8, 8, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1,
        -1, -1, -1, -1, -1, 8, -1, 5, -1, -1, -1, -1, -1, -1, -1, 9,
        9, 9, 9, 9, 9, 9, 15, 11, 10, 10, 10, 10, 3, 3, 3, 3,
        11, 10, 12, 12, 12, 12, 12, -1, 12, 10, 10, 10, 10, 9, 10, 9,
        8, 8, 8, 8, 8, 8, 13, 8, 8, 8, 8, 8, 3, 3, 3, 3,
        8, 8, 8, 8, 8, 8, 8, -1, 8, 8, 8, 8, 8, 7, 8, 7,
    };
    // The kerning pairs of the font: first character, second character, and the change of the gap between them.
    private static final int[][] KERNINGS = {
        {32, 65, -1}, {49, 49, -1}, {65, 32, -1}, {65, 84, -1}, {65, 86, -1}, {65, 87, -1},
        {65, 89, -1}, {70, 44, -2}, {70, 46, -2}, {70, 65, -1}, {76, 32, -1}, {76, 84, -1},
        {76, 86, -1}, {76, 87, -1}, {76, 89, -1}, {76, 121, -1}, {80, 44, -2}, {80, 46, -2},
        {80, 65, -1}, {84, 44, -2}, {84, 45, -1}, {84, 46, -2}, {84, 58, -2}, {84, 59, -2},
        {84, 65, -1}, {84, 97, -2}, {84, 99, -2}, {84, 101, -2}, {84, 105, -1}, {84, 111, -2},
        {84, 114, -1}, {84, 115, -2}, {84, 117, -1}, {84, 119, -1}, {84, 121, -1}, {86, 44, -1},
        {86, 45, -1}, {86, 46, -1}, {86, 58, -1}, {86, 59, -1}, {86, 65, -1}, {86, 97, -1},
        {86, 101, -1}, {86, 111, -1}, {86, 114, -1}, {86, 117, -1}, {86, 121, -1}, {87, 44, -1},
        {87, 46, -1}, {87, 65, -1}, {87, 97, -1}, {89, 44, -2}, {89, 45, -1}, {89, 46, -2},
        {89, 58, -1}, {89, 59, -1}, {89, 65, -1}, {89, 97, -1}, {89, 101, -1}, {89, 105, -1},
        {89, 111, -1}, {89, 112, -1}, {89, 113, -1}, {89, 117, -1}, {89, 118, -1}, {114, 44, -1},
        {114, 46, -1}, {118, 44, -1}, {118, 46, -1}, {119, 44, -1}, {119, 46, -1}, {121, 44, -1},
        {121, 46, -1},
    };

    //-------------------- CONSTRUCTOR --------------------
    // No object: only the static method below.
    private TextWidth() {
    }

    //-------------------- WIDTH --------------------
    /**
     * Returns the width of a line of text in the font of the game.
     *
     * @param text one line, without line break
     * @return its width, in world pixels
     * @throws IllegalArgumentException if a character is not in the font
     */
    public static int of(String text) {
        int width = 0;
        for (int i = 0; i < text.length(); i++) {
            width += advance(text.charAt(i));
            if (i + 1 < text.length()) {
                width += kerning(text.charAt(i), text.charAt(i + 1));
            }
        }
        return width;
    }

    //-------------------- INTERNALS --------------------
    // A character the font does not have would be drawn as nothing: refused, so a text is never cut silently.
    private static int advance(char letter) {
        int index = letter - FIRST;
        if (index < 0 || index >= ADVANCES.length || ADVANCES[index] < 0) {
            throw new IllegalArgumentException("Not in the font: " + letter);
        }
        return ADVANCES[index];
    }

    private static int kerning(char first, char second) {
        for (int[] pair : KERNINGS) {
            if (pair[0] == first && pair[1] == second) {
                return pair[2];
            }
        }
        return 0;
    }
}
