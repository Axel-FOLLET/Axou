package com.cropa.view;

// JUnit: the checks the tests use, and the annotation that marks a test.
// The model: real slots, a real catapatate and a real bramble, so the test reads what the game will really give;
// a real witch and her farm, for a catapatate that really shoots (day 14).
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cropa.model.defense.Bramble;
import com.cropa.model.defense.Catapatate;
import com.cropa.model.defense.DefenseConfig;
import com.cropa.model.defense.DefenseSlot;
import com.cropa.model.defense.DefenseSlots;
import com.cropa.model.defense.SlotSide;
import com.cropa.model.enemy.EnemyConfig;
import com.cropa.model.enemy.Witch;
import com.cropa.model.world.Cell;
import com.cropa.model.world.Farm;
// Language and Texts: the words of the game in French, the language its layout was measured on.
import com.cropa.text.Language;
import com.cropa.text.Texts;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

// No window and no libGDX: the renderer draws on a RecordingCanvas, with the places of TestLayouts.
// Column 3 starts at x = 160 + 2 * 16 = 192; the top slots sit at y = 192, the bottom ones at y = 128.
// The middle of the top slot of column 3 is (200, 200), the one of the bottom slot (200, 136).
// The cell r2c3 goes from (192, 160) to (208, 176).
/** Tests for {@link DefenseRenderer}. */
class DefenseRendererTest {

    //-------------------- FIELDS --------------------
    private static final float FRAME = 0.016f;
    private final DefenseSlots slots = new DefenseSlots();
    private final RecordingCanvas canvas = new RecordingCanvas();
    // In French, the language the labels were drawn for: "N1".
    private final DefenseRenderer renderer =
        new DefenseRenderer(TestLayouts.layout(), Texts.of(Language.FRENCH));

    //-------------------- HELPERS --------------------
    // Places a catapatate the way the shop will: created for its slot, then placed on it.
    private Catapatate placeOn(SlotSide side, int column) {
        DefenseSlot slot = slots.getSlot(side, column);
        Catapatate catapatate = new Catapatate(slot, new DefenseConfig(), new ArrayList<>());
        slot.place(catapatate);
        return catapatate;
    }

    // Places a bramble on the cell r2c3, the way DefenseOffer will.
    private Bramble brambleOnR2C3() {
        Cell cell = new Cell(2, 3);
        Bramble bramble = new Bramble(cell, new DefenseConfig());
        slots.placeOnField(cell, bramble);
        return bramble;
    }

    // Draws one frame, after forgetting what the previous frames drew.
    private List<String> frame(float delta) {
        canvas.calls.clear();
        renderer.render(canvas, slots, delta);
        return canvas.calls;
    }

    //-------------------- THE SLOTS --------------------
    // No defense: nothing is drawn, not even an empty label.
    @Test
    void drawsNothingWithoutDefense() {
        renderer.render(canvas, slots, 0f);

        assertTrue(canvas.calls.isEmpty());
    }

    // A top slot faces the field below it: the image seen from the front, 24 px centred on (200, 200).
    @Test
    void drawsATopCatapatateOnItsSlot() {
        placeOn(SlotSide.TOP, 3);

        renderer.render(canvas, slots, 0f);

        assertEquals("sprite catapatate_top " + new Bounds(188, 188, 24, 24), canvas.calls.get(0));
    }

    // A bottom slot faces the field above it: the image seen from the back, 24 px centred on (200, 136).
    @Test
    void drawsABottomCatapatateOnItsSlot() {
        placeOn(SlotSide.BOTTOM, 3);

        renderer.render(canvas, slots, 0f);

        assertEquals("sprite catapatate_bottom " + new Bounds(188, 124, 24, 24), canvas.calls.get(0));
    }

    // Asked by Axel on day 14: the level always shown, "N1" read above "92%", centred on the slot, on the side away
    // from the field. Top slot: above the sprite, the durability at 188 + 24 + 2 + 6 = 220, the level one label
    // higher, at 220 + 9 = 229.
    @Test
    void writesLevelAndDurabilityAboveATopSlot() {
        placeOn(SlotSide.TOP, 3).wear(8);

        renderer.render(canvas, slots, 0f);

        assertEquals("label N1 200.0 229.0", canvas.calls.get(1));
        assertEquals("label 92% 200.0 220.0", canvas.calls.get(2));
    }

    // Bottom slot: below the sprite, the level 2 px under it, at 124 - 2 = 122, the durability one label lower, at
    // 122 - 9 = 113. An upgrade gives level 2 and back 100 %.
    @Test
    void writesLevelAndDurabilityBelowABottomSlot() {
        Catapatate catapatate = placeOn(SlotSide.BOTTOM, 3);
        catapatate.upgrade();

        renderer.render(canvas, slots, 0f);

        assertEquals("label N2 200.0 122.0", canvas.calls.get(1));
        assertEquals("label 100% 200.0 113.0", canvas.calls.get(2));
    }

    // Two defenses: one sprite and two labels each, top side first.
    @Test
    void drawsEveryPlacedDefense() {
        placeOn(SlotSide.TOP, 1);
        placeOn(SlotSide.BOTTOM, 5);

        renderer.render(canvas, slots, 0f);

        assertEquals(6, canvas.calls.size());
        assertTrue(canvas.calls.get(0).startsWith("sprite catapatate_top"));
        assertTrue(canvas.calls.get(3).startsWith("sprite catapatate_bottom"));
    }

    // A shot wears the catapatate by 2 %: it never turns red, or it would flash at every shot.
    @Test
    void aWornCatapatateStaysNormal() {
        Catapatate catapatate = placeOn(SlotSide.TOP, 3);
        frame(FRAME);
        catapatate.wear(2);

        assertEquals("sprite catapatate_top " + new Bounds(188, 188, 24, 24), frame(FRAME).get(0));
    }

    //-------------------- THE FIELD --------------------
    // Expected by the sheet of the day: a bramble on the field, one label, and no sprite (WorldRenderer draws it).
    // Above the cell r2c3: x = 192 + 8 = 200, the top of the text at 160 + 16 + 2 + 6 = 184. Day 14: the level and
    // the durability on that one line.
    @Test
    void writesOnlyTheLabelOfAFieldDefense() {
        brambleOnR2C3();

        assertEquals(List.of("label N1 100% 200.0 184.0"), frame(0f));
    }

    // Expected by the sheet of the day: crossed between two frames (100 then 80), its sprite is drawn once more,
    // in red, on its cell; 0.2 s later, only the label is left.
    @Test
    void redrawsACrossedFieldDefenseInRed() {
        Bramble bramble = brambleOnR2C3();
        frame(FRAME);
        bramble.wear(20);

        assertEquals(List.of("sprite bramble_0 " + new Bounds(192, 160, 16, 16) + " HURT", "label N1 80% 200.0 184.0"),
                frame(FRAME));
        assertEquals(List.of("label N1 80% 200.0 184.0"), frame(0.25f));
    }

    //-------------------- THE UPGRADE --------------------
    // Expected by the sheet of the day: a catapatate upgraded between two frames is drawn in blue, then normal 0.2 s later.
    @Test
    void drawsAnUpgradedCatapatateInBlue() {
        Catapatate catapatate = placeOn(SlotSide.TOP, 3);
        frame(FRAME);
        catapatate.upgrade();

        assertEquals("sprite catapatate_top " + new Bounds(188, 188, 24, 24) + " UPGRADED", frame(FRAME).get(0));
        assertEquals("sprite catapatate_top " + new Bounds(188, 188, 24, 24), frame(0.25f).get(0));
    }

    // A defense of the field upgraded: its sprite is drawn once more, in blue, on its cell.
    @Test
    void redrawsAnUpgradedFieldDefenseInBlue() {
        Bramble bramble = brambleOnR2C3();
        frame(FRAME);
        bramble.upgrade();

        assertEquals("sprite bramble_0 " + new Bounds(192, 160, 16, 16) + " UPGRADED", frame(FRAME).get(0));
    }

    //-------------------- THE ATTACK (J14) --------------------
    // Asked by Axel on day 14: right after a shot, the catapatate is drawn throwing, then still again 0.3 s later.
    // A witch walked to the middle of column 3, row 1: the top catapatate of column 3 reaches it (CatapatateTest).
    @Test
    void drawsATopCatapatateThrowingRightAfterAShot() {
        EnemyConfig enemyConfig = new EnemyConfig();
        Witch witch = new Witch(1, new Farm(100), enemyConfig);
        witch.update((enemyConfig.getSpawnCellsToFarm() - 5.5f) / enemyConfig.getSpeed(witch.getType()));
        DefenseSlot slot = slots.getSlot(SlotSide.TOP, 3);
        Catapatate catapatate = new Catapatate(slot, new DefenseConfig(), List.of(witch));
        slot.place(catapatate);

        catapatate.update(FRAME);
        assertEquals("sprite catapatate_top_throwing " + new Bounds(188, 188, 24, 24), frame(FRAME).get(0));

        catapatate.update(0.3f);
        assertEquals("sprite catapatate_top " + new Bounds(188, 188, 24, 24), frame(FRAME).get(0));
    }
}
