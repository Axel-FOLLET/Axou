package com.cropa.view.gdx;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.graphics.g2d.Batch;
import com.badlogic.gdx.graphics.g2d.TextureRegion;
import com.badlogic.gdx.maps.tiled.TiledMap;
import com.badlogic.gdx.maps.tiled.TiledMapTile;
import com.badlogic.gdx.maps.tiled.TiledMapTileLayer;
import com.badlogic.gdx.maps.tiled.TiledMapTileSet;
import com.badlogic.gdx.maps.tiled.renderers.BatchTiledMapRenderer;
import com.badlogic.gdx.utils.XmlReader;
import com.cropa.view.SpriteCatalog;
import java.util.HashMap;
import java.util.Map;

/** Keeps Tiled's cell grid in world units, independently of each tileset's image resolution. */
final class ScaledTileMapRenderer extends BatchTiledMapRenderer {
    private record Art(float density, String animation) {}
    private final Map<Integer, Art> art = new HashMap<>();
    private final GdxCanvas canvas;

    ScaledTileMapRenderer(TiledMap map, Batch batch, GdxCanvas canvas) {
        super(map, 1, batch);
        this.canvas = canvas;
        var root = new XmlReader().parse(Gdx.files.internal("maps/map_v1.tmx"));
        Map<Integer, String> filenames = new HashMap<>();
        for (var set : root.getChildrenByName("tileset")) {
            String source = set.getAttribute("source");
            String name = source.substring(source.lastIndexOf('/') + 1, source.lastIndexOf('.'));
            filenames.put(set.getIntAttribute("firstgid"), name);
        }
        for (TiledMapTileSet set : map.getTileSets()) {
            int first = set.getProperties().get("firstgid", Integer.class);
            float density = set.getProperties().get("pixels_per_unit", 1f, Float.class);
            if (!(density > 0)) throw new IllegalArgumentException("Invalid pixels_per_unit: " + set.getName());
            for (TiledMapTile tile : set) {
                String key = "tile_" + filenames.get(first) + "_" + (tile.getId() - first);
                art.put(tile.getId(), new Art(density, SpriteCatalog.contains(key) ? key : null));
            }
        }
    }

    @Override
    public void renderTileLayer(TiledMapTileLayer layer) {
        float color = getTileLayerColor(layer, batch.getColor());
        float offsetX = layer.getRenderOffsetX() - viewBounds.x * (layer.getParallaxX() - 1);
        float offsetY = -layer.getRenderOffsetY() - viewBounds.y * (layer.getParallaxY() - 1);
        for (int row = layer.getHeight() - 1; row >= 0; row--) {
            for (int col = 0; col < layer.getWidth(); col++) {
                var cell = layer.getCell(col, row);
                if (cell == null || cell.getTile() == null) continue;
                var tile = cell.getTile();
                Art sprite = art.get(tile.getId());
                TextureRegion base = tile.getTextureRegion();
                float x = col * layer.getTileWidth() + offsetX + tile.getOffsetX();
                float y = row * layer.getTileHeight() + offsetY + tile.getOffsetY();
                float w = base.getRegionWidth() / sprite.density();
                float h = base.getRegionHeight() / sprite.density();
                TextureRegion image = sprite.animation() == null ? base
                        : canvas.tileFrame(sprite.animation(), ((col * 7 + row * 13) % 10) * 0.1f);
                // Quad order is bottom left, top left, top right, bottom right. Tiled flips UVs before rotating them.
                for (int corner = 0; corner < 4; corner++) {
                    int uv = (corner + cell.getRotation()) & 3;
                    boolean right = (uv >= 2) ^ cell.getFlipHorizontally();
                    boolean top = (uv == 1 || uv == 2) ^ cell.getFlipVertically();
                    int i = 5 * corner;
                    vertices[i] = corner >= 2 ? x + w : x;
                    vertices[i + 1] = corner == 1 || corner == 2 ? y + h : y;
                    vertices[i + 2] = color;
                    vertices[i + 3] = right ? image.getU2() : image.getU();
                    vertices[i + 4] = top ? image.getV() : image.getV2();
                }
                batch.draw(image.getTexture(), vertices, 0, NUM_VERTICES);
            }
        }
    }
}
