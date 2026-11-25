package com.cropa.view;

/** A sprite pose in world units. Scale keeps its feet in place, rotation turns about its centre. */
public record SpriteStyle(float alpha, float scaleX, float scaleY, float rotation, boolean flipX,
                          float offsetX, float offsetY, Tint tint) {
    public static final SpriteStyle NORMAL = new SpriteStyle(1, 1, 1, 0, false, 0, 0, Tint.NORMAL);

    public SpriteStyle withAlpha(float alpha) {
        return new SpriteStyle(alpha, scaleX, scaleY, rotation, flipX, offsetX, offsetY, tint);
    }

    public SpriteStyle withScale(float scaleX, float scaleY) {
        return new SpriteStyle(alpha, scaleX, scaleY, rotation, flipX, offsetX, offsetY, tint);
    }

    public SpriteStyle withRotation(float rotation) {
        return new SpriteStyle(alpha, scaleX, scaleY, rotation, flipX, offsetX, offsetY, tint);
    }

    public SpriteStyle withOffset(float offsetX, float offsetY) {
        return new SpriteStyle(alpha, scaleX, scaleY, rotation, flipX, offsetX, offsetY, tint);
    }

    public SpriteStyle withFlipX(boolean flipX) {
        return new SpriteStyle(alpha, scaleX, scaleY, rotation, flipX, offsetX, offsetY, tint);
    }

    public SpriteStyle withTint(Tint tint) {
        return new SpriteStyle(alpha, scaleX, scaleY, rotation, flipX, offsetX, offsetY, tint);
    }
}
