package com.cropa.view;

// No import: a scene only holds two texts.
// record: a class of data in one line. Java writes the constructor, the two accessors imageKey() and line(), equals,
// hashCode and toString. A scene is a piece of data, not code: a cinematic is a list of them, so a new scene is one
// more line in Cinematic, and nothing else changes.
/**
 * One still image of a cinematic and the line of text shown under it.
 *
 * @param imageKey the key of the image in {@link SpriteCatalog}
 * @param line the text shown under the image
 */
public record Scene(String imageKey, String line) {
}
