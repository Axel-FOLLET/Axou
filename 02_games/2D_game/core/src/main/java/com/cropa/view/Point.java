package com.cropa.view;

// A record: Java writes the constructor, x(), y(), equals and toString. Its fields are final, so nobody can
// change a point after it is created. Replaces the Vector2 of libGDX, which any caller could modify.
/**
 * A point of the world, in world pixels.
 *
 * @param x the horizontal place
 * @param y the vertical place, going up
 */
public record Point(float x, float y) {
}
