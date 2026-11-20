package com.cropa.view.gdx;

// JUnit: the checks the tests use, and the annotation that marks a test.
// libGDX: the map and its layers, built by hand so that no image is loaded.
// The view: the layout read from the map and the expected values.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.badlogic.gdx.maps.MapLayer;
import com.badlogic.gdx.maps.MapObject;
import com.badlogic.gdx.maps.MapObjects;
import com.badlogic.gdx.maps.objects.PointMapObject;
import com.badlogic.gdx.maps.objects.RectangleMapObject;
import com.badlogic.gdx.maps.tiled.TiledMap;
import com.cropa.view.BoardLayout;
import com.cropa.view.Bounds;
import com.cropa.view.Point;
import org.junit.jupiter.api.Test;

// No extends: JUnit finds the tests through @Test. No image is loaded, so no window is needed.
/**
 * Tests TiledLayoutReader on a small map built by hand.
 */
class TiledLayoutReaderTest {

    //-------------------- CONSTANTS --------------------
    // The size of one tile of the map, in pixels.
    private static final float TILE_SIZE = 16;

    //-------------------- MAP BUILDING --------------------
    // Called for each cell and slot of the test map, with the name written in Tiled.
    private static MapObject rectangle(String name, float x, float y) {
        RectangleMapObject shape = new RectangleMapObject(x, y, TILE_SIZE, TILE_SIZE);
        shape.setName(name);
        return shape;
    }

    // Same thing for a spot: a point has a place, but no size.
    private static MapObject point(String name, float x, float y) {
        PointMapObject spot = new PointMapObject(x, y);
        spot.setName(name);
        return spot;
    }

    // Called once per layer. It gives the layer back, so that the caller can fill its objects.
    private static MapLayer addLayer(TiledMap map, String name) {
        MapLayer created = new MapLayer();
        created.setName(name);
        map.getLayers().add(created);
        return created;
    }

    // Called by each test. The values are those of map_v1.tmx once libGDX has read it, y going up.
    private static TiledMap fullMap() {
        TiledMap map = new TiledMap();
        MapObjects cells = addLayer(map, "cells").getObjects();
        MapObjects slots = addLayer(map, "slots").getObjects();
        MapObjects spots = addLayer(map, "spots").getObjects();
        for (int column = 1; column <= 5; column++) {
            float x = 160 + (column - 1) * TILE_SIZE;
            for (int row = 1; row <= 3; row++) {
                cells.add(rectangle("r" + row + "c" + column, x, 192 - row * TILE_SIZE));
            }
            slots.add(rectangle("top" + column, x, 192));
            slots.add(rectangle("bottom" + column, x, 128));
        }
        spots.add(point("farm", 80, 160));
        spots.add(point("farmer", 136, 160));
        spots.add(point("cat", 120, 192));
        return map;
    }

    //-------------------- READING --------------------
    // Without this test, nothing would check that the values of the map reach the layout.
    @Test
    void readsCellsAndSpots() {
        BoardLayout layout = TiledLayoutReader.read(fullMap());
        assertEquals(new Bounds(176, 160, TILE_SIZE, TILE_SIZE), layout.getCellBounds(2, 2));
        assertEquals(new Point(136, 160), layout.getSpot("farmer"));
    }

    // Without the check on the message, an exception naming another object would pass too.
    @Test
    void missingCellNameFails() {
        TiledMap map = fullMap();
        MapObjects cells = map.getLayers().get("cells").getObjects();
        cells.remove(cells.get("r2c3"));
        Exception error = assertThrows(IllegalArgumentException.class, () -> TiledLayoutReader.read(map));
        assertTrue(error.getMessage().contains("r2c3"));
    }

    // A point where a rectangle is expected: it is skipped, so the name is reported as missing.
    @Test
    void objectOfTheWrongTypeFails() {
        TiledMap map = fullMap();
        MapObjects cells = map.getLayers().get("cells").getObjects();
        cells.remove(cells.get("r1c1"));
        cells.add(point("r1c1", 160, 176));
        Exception error = assertThrows(IllegalArgumentException.class, () -> TiledLayoutReader.read(map));
        assertTrue(error.getMessage().contains("r1c1"));
    }

    // Without this test, a renamed layer in Tiled would end in a NullPointerException that names nothing.
    @Test
    void missingLayerFails() {
        TiledMap map = fullMap();
        map.getLayers().remove(map.getLayers().getIndex("slots"));
        Exception error = assertThrows(IllegalArgumentException.class, () -> TiledLayoutReader.read(map));
        assertTrue(error.getMessage().contains("slots"));
    }
}
