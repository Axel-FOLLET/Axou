package com.cropa.view.gdx;

// libGDX: the Tiled map, its layers, and the two kinds of object it holds. Java: the tables given to BoardLayout.
// The view: BoardLayout and the two types that replace Rectangle and Vector2.
import com.badlogic.gdx.maps.MapLayer;
import com.badlogic.gdx.maps.MapObject;
import com.badlogic.gdx.maps.objects.PointMapObject;
import com.badlogic.gdx.maps.objects.RectangleMapObject;
import com.badlogic.gdx.maps.tiled.TiledMap;
import com.badlogic.gdx.math.Rectangle;
import com.badlogic.gdx.math.Vector2;
import com.cropa.view.BoardLayout;
import com.cropa.view.Bounds;
import com.cropa.view.Point;
import java.util.HashMap;
import java.util.Map;

// final with a private constructor: one function, no state. Tiled stays here: BoardLayout only sees plain tables.
/**
 * Reads the object layers of the Tiled map and builds the {@link BoardLayout}.
 */
public final class TiledLayoutReader {

    //-------------------- CONSTANTS --------------------
    // Names written in the .tmx file: a typo here would make read fail.
    private static final String CELLS_LAYER = "cells";
    private static final String SLOTS_LAYER = "slots";
    private static final String SPOTS_LAYER = "spots";

    private TiledLayoutReader() {
    }

    //-------------------- READING --------------------
    // Called once by GameScreen.show(), right after the map is loaded.
    /**
     * Reads the cells, slots and spots of the map.
     *
     * @param map the loaded Tiled map
     * @return the layout of the board
     * @throws IllegalArgumentException if a layer or an object name is missing from the map
     */
    public static BoardLayout read(TiledMap map) {
        return new BoardLayout(readAreas(map, CELLS_LAYER), readAreas(map, SLOTS_LAYER), readPoints(map, SPOTS_LAYER));
    }

    // A copy into a Bounds, so nothing outside this class can reach the Rectangle held by the map.
    // An object of another type is skipped: BoardLayout then reports its name as missing.
    private static Map<String, Bounds> readAreas(TiledMap map, String layerName) {
        Map<String, Bounds> areas = new HashMap<>();
        for (MapObject object : findLayer(map, layerName).getObjects()) {
            if (object instanceof RectangleMapObject rectangleObject) {
                Rectangle rectangle = rectangleObject.getRectangle();
                areas.put(object.getName(), new Bounds(rectangle.x, rectangle.y, rectangle.width, rectangle.height));
            }
        }
        return areas;
    }

    // A Tiled point is a PointMapObject (checked with javap on libGDX 1.14.2).
    private static Map<String, Point> readPoints(TiledMap map, String layerName) {
        Map<String, Point> points = new HashMap<>();
        for (MapObject object : findLayer(map, layerName).getObjects()) {
            if (object instanceof PointMapObject pointObject) {
                Vector2 point = pointObject.getPoint();
                points.put(object.getName(), new Point(point.x, point.y));
            }
        }
        return points;
    }

    // MapLayers.get gives null for an unknown layer: the exception names it instead.
    private static MapLayer findLayer(TiledMap map, String layerName) {
        MapLayer layer = map.getLayers().get(layerName);
        if (layer == null) {
            throw new IllegalArgumentException("Layer missing from the map: " + layerName);
        }
        return layer;
    }
}
