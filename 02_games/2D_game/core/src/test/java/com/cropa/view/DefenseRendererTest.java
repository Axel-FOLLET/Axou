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
import com.cropa.view.fx.Effects;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
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
    private final Effects effects = new Effects(new Random(0));
    private final DefenseRenderer renderer = new DefenseRenderer(TestLayouts.layout(), effects);

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
    // No defense: nothing is drawn, not even an empty bar.
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

    // The user, 25/11: no more "N1", "N2", "N3" on the defenses, they hid the view; the sprite shows the level (wood,
    // reinforced, metal). An upgraded bottom catapatate: its reinforced sprite, and no text at all.
    @Test
    void writesNoLevelOnADefense() {
        Catapatate catapatate = placeOn(SlotSide.BOTTOM, 3);
        catapatate.upgrade();
        placeOn(SlotSide.TOP, 3).wear(8);

        renderer.render(canvas, slots, 0f);

        assertTrue(canvas.calls.stream().noneMatch(call -> call.startsWith("label ")), canvas.calls.toString());
        assertTrue(canvas.calls.contains("sprite catapatate_bottom_reinforced " + new Bounds(188, 124, 24, 24)));
    }

    // Two defenses: one sprite each, top side first.
    @Test
    void drawsEveryPlacedDefense() {
        placeOn(SlotSide.TOP, 1);
        placeOn(SlotSide.BOTTOM, 5);

        renderer.render(canvas, slots, 0f);

        assertEquals(2, canvas.calls.size());
        assertTrue(canvas.calls.get(0).startsWith("sprite catapatate_top"));
        assertTrue(canvas.calls.get(1).startsWith("sprite catapatate_bottom"));
    }

    // The user, 25/11: the health as a bar with no number, bigger and contrasted, then 35 % thinner. Top slot: 14 x 4 centred on x 200,
    // 1 px over the sprite (188 + 24 = 212): (193, 213). At 92 %: a black edge, the grey empty part, then 92 % of the
    // 12 px inside in green.
    @Test
    void drawsTheHealthBarAboveATopSlot() {
        placeOn(SlotSide.TOP, 3).wear(8);

        renderer.render(canvas, slots, 0f);

        assertEquals(List.of(
                "color " + new Bounds(193, 213, 14, 4) + " 0.0 0.0 0.0 1.0",
                "color " + new Bounds(194, 214, 12, 2) + " 0.22 0.22 0.22 1.0",
                "color " + new Bounds(194, 214, 12 * 92 / 100f, 2) + " 0.3 0.95 0.3 1.0"), colors());
    }

    // Bottom slot: the bar 1 px under the sprite (124), at 124 - 1 - 4 = 119; nearly broken, it turns red.
    // Field: the bar on the top of the cell r2c3, at 176.
    @Test
    void drawsTheHealthBarUnderABottomSlotAndOnAFieldDefense() {
        placeOn(SlotSide.BOTTOM, 3).wear(80);
        brambleOnR2C3();

        renderer.render(canvas, slots, 0f);

        assertTrue(colors().contains("color " + new Bounds(193, 119, 14, 4) + " 0.0 0.0 0.0 1.0"));
        assertTrue(colors().contains("color " + new Bounds(194, 120, 12 * 20 / 100f, 2) + " 1.0 0.18 0.18 1.0"));
        assertTrue(colors().contains("color " + new Bounds(193, 176, 14, 4) + " 0.0 0.0 0.0 1.0"));
    }

    // In the game, the bars wait for renderHealthBars, drawn after the night lighting; once drawn, they are
    // forgotten, so a second call draws nothing.
    @Test
    void deferredHealthBarsWaitForRenderHealthBars() {
        renderer.deferHealthBars();
        placeOn(SlotSide.TOP, 3);

        renderer.render(canvas, slots, 0f);
        assertEquals(List.of("sprite catapatate_top " + new Bounds(188, 188, 24, 24)), canvas.calls);
        assertTrue(colors().isEmpty());

        canvas.calls.clear();
        renderer.renderHealthBars(canvas);
        assertTrue(canvas.calls.isEmpty());
        assertEquals(3, colors().size());

        canvas.extras.clear();
        renderer.renderHealthBars(canvas);
        assertTrue(colors().isEmpty());
    }

    private List<String> colors() {
        return canvas.extras.stream().filter(call -> call.startsWith("color ")).toList();
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
    // A bramble on the field: its sprite on the cell r2c3, and no text.
    @Test
    void drawsAFieldDefenseWithoutText() {
        brambleOnR2C3();

        assertEquals(List.of("sprite bramble_0 " + new Bounds(192, 160, 16, 16)), frame(0f));
    }

    // Expected by the sheet of the day: crossed between two frames (100 then 80), its sprite is drawn once more,
    // in red, on its cell; 0.2 s later, drawn normally again.
    @Test
    void redrawsACrossedFieldDefenseInRed() {
        Bramble bramble = brambleOnR2C3();
        frame(FRAME);
        bramble.wear(20);

        assertEquals(List.of("sprite bramble_strike " + new Bounds(192, 160, 16, 16) + " HURT"), frame(FRAME));
        assertEquals(List.of("sprite bramble_strike " + new Bounds(192, 160, 16, 16)), frame(0.25f));
    }

    //-------------------- THE UPGRADE --------------------
    @Test
    void drawsTheSparkleOverTheUntintedUpgradedCatapatate() {
        Catapatate catapatate = placeOn(SlotSide.TOP, 3);
        frame(FRAME);
        catapatate.upgrade();

        assertEquals("sprite catapatate_top_reinforced " + new Bounds(188, 188, 24, 24), frame(FRAME).get(0));
        assertTrue(canvas.calls.stream().anyMatch(c -> c.startsWith("sprite upgrade_sparkle ")));
        assertEquals("sprite catapatate_top_reinforced " + new Bounds(188, 188, 24, 24), frame(0.25f).get(0));
    }

    @Test
    void drawsTheSparkleOverTheUntintedUpgradedFieldDefense() {
        Bramble bramble = brambleOnR2C3();
        frame(FRAME);
        bramble.upgrade();

        Bounds cell = new Bounds(192, 160, 16, 16);
        assertEquals("sprite bramble_0_reinforced " + cell, frame(FRAME).get(0));
        assertTrue(canvas.calls.contains("sprite upgrade_sparkle " + cell));
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

        assertEquals(1, frame(.175f).stream().filter(c -> c.startsWith("sprite potato ")).count());
        assertTrue(canvas.calls.stream().anyMatch(c -> c.startsWith("sprite potato_shadow ")));
        assertTrue(frame(.18f).contains("sprite potato_splash " + new Bounds(188, 172, 24, 24)));
        catapatate.update(0.3f);
        assertEquals("sprite catapatate_top " + new Bounds(188, 188, 24, 24), frame(.6f).get(0));
    }

    @Test
    void wearChangesOnlyAtTheThreeThresholds() {
        int[] values = {100, 76, 75, 51, 50, 26, 25, 1};
        String[] expected = {"new", "new", "worn", "worn", "very_worn", "very_worn", "almost_broken", "almost_broken"};
        for (int i = 0; i < values.length; i++) assertEquals(expected[i], DefenseRenderer.wear(values[i]));
    }

    @Test
    void growthWearAndDestructionUseTheMaterialOfTheFieldDefense() {
        Bramble plant = brambleOnR2C3();
        plant.upgrade();
        plant.upgrade();
        frame(0);
        plant.grow();
        assertTrue(frame(0).get(0).startsWith("sprite bramble_grow_metal "));
        assertTrue(frame(1).get(0).startsWith("sprite bramble_1_metal "));
        plant.wear(75);
        assertTrue(frame(0).get(1).startsWith("sprite bramble_wear_metal_almost_broken "));
        plant.wear(25);
        assertTrue(frame(0).get(0).startsWith("sprite bramble_destroyed_metal "));
        assertTrue(frame(1).isEmpty());
    }

    private List<String> particleCalls() {
        RecordingCanvas particles = new RecordingCanvas();
        effects.renderParticles(particles);
        return particles.extras;
    }

    @Test
    void destroyingAFieldDefenseReleasesOnePuffAtItsCenter() {
        Bramble bramble = brambleOnR2C3();
        frame(0);
        assertTrue(particleCalls().isEmpty());

        bramble.wear(100);
        frame(FRAME);
        List<String> smoke = particleCalls();
        assertEquals(6, smoke.size());
        assertTrue(smoke.stream().allMatch(call -> call.startsWith("particle fx_smoke 200.0 168.0 ")));

        frame(FRAME);
        assertEquals(smoke, particleCalls());
    }

    @Test
    void removingALiveDefenseLeavesNoDebris() {
        placeOn(SlotSide.TOP, 1);
        frame(0);
        slots.getSlot(SlotSide.TOP, 1).remove();
        assertTrue(frame(0).isEmpty());
        assertTrue(particleCalls().isEmpty());
    }

    @Test
    void aScarecrowFinishesOnePunchEvenWhileThePoseFlagIsStillSet() {
        EnemyConfig config = new EnemyConfig();
        Witch target = new Witch(2, new Farm(100), config);
        target.update((config.getSpawnCellsToFarm() - 5.5f) / config.getSpeed(target.getType()));
        Cell cell = new Cell(2, 3);
        var boxer = new com.cropa.model.defense.Scarecrow(cell, new DefenseConfig(), List.of(target));
        slots.placeOnField(cell, boxer);
        frame(0);
        boxer.update(FRAME);
        assertTrue(frame(FRAME).get(0).startsWith("sprite scarecrow_attack "));
        assertTrue(frame(.6f).get(0).startsWith("sprite scarecrow "));
    }
}
