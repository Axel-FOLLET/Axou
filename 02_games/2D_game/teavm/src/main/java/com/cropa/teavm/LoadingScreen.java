package com.cropa.teavm;

import com.badlogic.gdx.Files.FileType;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.graphics.Pixmap;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.graphics.Texture.TextureFilter;
import com.badlogic.gdx.graphics.g2d.SpriteBatch;
import com.badlogic.gdx.utils.ScreenUtils;
import com.badlogic.gdx.utils.viewport.ScreenViewport;
import com.cropa.view.Animations;
import com.cropa.view.SpriteCatalog;
import com.github.xpenatan.gdx.teavm.backends.web.WebApplication;
import com.github.xpenatan.gdx.teavm.backends.web.WebPreloadApplicationListener;
import com.github.xpenatan.gdx.teavm.backends.web.assetloader.AssetLoaderListener;
import com.github.xpenatan.gdx.teavm.backends.web.assetloader.AssetType;
import com.github.xpenatan.gdx.teavm.backends.web.assetloader.WebBlob;

/** Shows Garry in his rocking chair while the browser loads the game. */
public final class LoadingScreen extends WebPreloadApplicationListener {
    private static final Color NIGHT = new Color(0x0d1f39ff);
    private static final Color BORDER = new Color(0x5f98abff);
    private static final Color FILL = new Color(0xf4bc4dff);
    private static final int EDGE = 2;
    private static final int BAR_HEIGHT = 10;

    private final Texture[] frames = new Texture[4];
    private int remaining = frames.length;
    private ScreenViewport viewport;
    private SpriteBatch batch;
    private Texture pixel;
    private float elapsed;
    private float target;
    private float displayed;
    private boolean animating;

    @Override
    public void create() {
        viewport = new ScreenViewport();
        batch = new SpriteBatch();
        // The parent sets up the web asset loader before calling preloadAssets().
        super.create();
    }

    // The first PNG has no suffix. Its three neighbours share the name compiled from logoPath.
    private String framePath(int index) {
        if (index == 0) return startupLogo;
        return startupLogo.substring(0, startupLogo.length() - ".png".length()) + "-" + index + ".png";
    }

    @Override
    protected void preloadAssets() {
        AssetLoaderListener<WebBlob> listener = new AssetLoaderListener<>() {
            @Override
            public void onSuccess(String url, WebBlob result) {
                frameLoaded();
            }

            @Override
            public void onFailure(String url) {
                throw new IllegalStateException("Could not load rocking chair frame: " + url);
            }
        };
        for (int i = 0; i < frames.length; i++) {
            String path = framePath(i);
            // The loader skips existing files without calling the listener.
            if (Gdx.files.internal(path).exists()) {
                frameLoaded();
            } else {
                assetLoader.loadAsset(path, AssetType.Binary, FileType.Internal, listener);
            }
        }
    }

    private void frameLoaded() {
        if (--remaining == 0) preloadAssetsFile();
    }

    // Upload the four PNGs on the render loop. A single white texel draws the bar in palette colours.
    private void createTextures() {
        for (int i = 0; i < frames.length; i++) {
            frames[i] = createTexture(Gdx.files.internal(framePath(i)));
            frames[i].setFilter(TextureFilter.Nearest, TextureFilter.Nearest);
        }
        Pixmap dot = new Pixmap(1, 1, Pixmap.Format.RGBA8888);
        try {
            dot.setColor(Color.WHITE);
            dot.fill();
            pixel = createTexture(dot);
        } finally {
            dot.dispose();
        }
    }

    @Override
    public void resize(int width, int height) {
        if (width > 0 && height > 0) {
            viewport.update(width, height, true);
            batch.setProjectionMatrix(viewport.getCamera().combined);
        }
    }

    @Override
    public void render() {
        ScreenUtils.clear(NIGHT, true);
        if (assetsCount < 0) return;
        if (pixel == null) createTextures();

        float delta = Gdx.graphics.getDeltaTime();
        drawLoadingScreen();
        elapsed += delta;

        // An empty manifest can finish immediately. Otherwise wait for the last download and the bar.
        if (assetsCount == 0) {
            if (!assetLoader.isDownloading()) finishLoading();
            return;
        }
        float progress = (float)(assetsCount - assetLoader.getQueue()) / assetsCount;
        if (progress == 1f && displayed == 1f && !assetLoader.isDownloading()) {
            finishLoading();
            return;
        }

        // Keep the backend's current target until the bar catches up, then sample the queue again.
        if (!animating) target = progress;
        animating = target > displayed;
        if (animating) displayed = Math.min(target, displayed + animationSpeed * delta);
    }

    private void finishLoading() {
        ScreenUtils.clear(NIGHT, true);
        WebApplication.get().setPreloadReady();
    }

    private void drawLoadingScreen() {
        int width = viewport.getScreenWidth();
        int height = viewport.getScreenHeight();
        Texture frame = frames[Animations.frameAt(SpriteCatalog.FARMER, frames.length, elapsed)];
        int scale = Math.max(1, (int)(height * 0.4f / frame.getHeight()));
        int w = frame.getWidth() * scale;
        int h = frame.getHeight() * scale;
        int bottom = (height - h) / 2;

        batch.begin();
        batch.setColor(Color.WHITE);
        batch.draw(frame, (width - w) / 2, bottom, w, h);

        // All edges land on whole pixels. Leave room on either side in portrait windows.
        int barWidth = Math.min(2 * w, Math.max(0, width - 2 * EDGE));
        int innerWidth = barWidth - 2 * EDGE;
        if (innerWidth > 0) {
            int x = (width - barWidth) / 2;
            int y = Math.max(0, bottom - 8 * scale - BAR_HEIGHT);
            batch.setColor(BORDER);
            batch.draw(pixel, x, y, barWidth, BAR_HEIGHT);
            batch.setColor(NIGHT);
            batch.draw(pixel, x + EDGE, y + EDGE, innerWidth, BAR_HEIGHT - 2 * EDGE);
            // The original ProgressBar displays values in steps of one percent.
            int fillWidth = Math.round(innerWidth * (Math.round(displayed * 100f) / 100f));
            batch.setColor(FILL);
            batch.draw(pixel, x + EDGE, y + EDGE, fillWidth, BAR_HEIGHT - 2 * EDGE);
        }
        batch.end();
    }

    @Override
    public void dispose() {
        for (Texture frame : frames) {
            if (frame != null) frame.dispose();
        }
        if (pixel != null) pixel.dispose();
        if (batch != null) batch.dispose();
    }
}
