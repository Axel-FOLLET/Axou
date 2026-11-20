package com.cropa.view;

// A record: Java writes the constructor, the getters, equals and toString. Its fields are final, so changing
// the result of BoardLayout.getCellBounds can no longer move a cell. Replaces the Rectangle of libGDX.
/**
 * A rectangle of the world, in world pixels.
 *
 * @param x the left edge
 * @param y the bottom edge
 * @param width the width
 * @param height the height
 */
public record Bounds(float x, float y, float width, float height) {

    //-------------------- FACTORY --------------------
    // Called for every sprite placed on a point: a point has no size, so the middle of the image sits on it.
    // Written once here, so the - size / 2 is not repeated by each renderer.
    /**
     * Gives the square of the given size whose middle is the given point.
     *
     * @param center the middle of the square
     * @param size the side of the square, in world pixels
     * @return the square
     */
    public static Bounds centeredOn(Point center, float size) {
        return new Bounds(center.x() - size / 2, center.y() - size / 2, size, size);
    }

    //-------------------- QUERY --------------------
    // Called by BoardLayout.findSlot for each slot. The left and bottom edges belong to the rectangle, the right and
    // top edges do not (< and not <=): a click on the line between two slots goes to one of them only.
    /**
     * Tells whether a point is inside the rectangle.
     *
     * @param pointX the x of the point, in world pixels
     * @param pointY the y of the point, in world pixels
     * @return {@code true} if the point is inside, the left and bottom edges included
     */
    public boolean contains(float pointX, float pointY) {
        return pointX >= x && pointX < x + width && pointY >= y && pointY < y + height;
    }
}
