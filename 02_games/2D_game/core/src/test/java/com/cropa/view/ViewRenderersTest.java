package com.cropa.view;

// JUnit: the checks the tests use, and the annotation that marks a test. Java: reading the recorded calls.
// The model: a real session and its numbers, to check that the HUD hears it. Random: asked by the session.
// A field and defense slots of the test's own, with the carrots and the catapatate it places itself (free places).
// ArrayList: the empty list of enemies of that catapatate. A bramble: a defense of the field, which gets no growth dot.
// Cat: the farmer's cat, sitting, fleeing or meowing; EnemyView: an enemy of the test's own, which scares it.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cropa.model.defense.Bramble;
import com.cropa.model.defense.Catapatate;
import com.cropa.model.defense.DefenseConfig;
import com.cropa.model.defense.DefenseSlot;
import com.cropa.model.defense.DefenseSlots;
import com.cropa.model.defense.SlotSide;
import com.cropa.model.enemy.Cat;
import com.cropa.model.enemy.EnemyConfig;
import com.cropa.model.enemy.EnemyType;
import com.cropa.model.enemy.EnemyView;
import com.cropa.model.enemy.Farmer;
import com.cropa.model.enemy.Witch;
import com.cropa.model.game.GameConfig;
import com.cropa.model.game.GameSession;
import com.cropa.model.world.Board;
import com.cropa.model.world.Crop;
import com.cropa.model.world.CropConfig;
import com.cropa.model.world.CropType;
import com.cropa.model.world.Farm;
// Language and Texts: the words of the game in French, the language its layout was measured on.
import com.cropa.text.Language;
import com.cropa.text.Texts;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.Test;

// No window and no libGDX: each renderer draws on a RecordingCanvas. This code had no test while it sat in GameScreen.
/**
 * Tests the parts of the view that no longer need a window.
 */
class ViewRenderersTest {

    //-------------------- CONSTANTS --------------------
    // The texts the game shows in French, its first language: the layout was measured on them.
    private static final Texts FRENCH = Texts.of(Language.FRENCH);

    //-------------------- BOUNDS --------------------
    // Without this test, a sprite could be placed by its corner instead of its middle.
    @Test
    void centeredOnPutsTheMiddleOnThePoint() {
        assertEquals(new Bounds(114, 186, 12, 12), Bounds.centeredOn(new Point(120, 192), 12));
    }

    //-------------------- SPRITE CATALOG --------------------
    // Without this test, a wrong path would only show up when the window opens.
    @Test
    void catalogGivesTheFileOfASprite() {
        assertEquals("farm/east-farm.png", SpriteCatalog.pathOf(SpriteCatalog.FARM));
    }

    // Without this test, a typo on a key could become an empty image.
    @Test
    void catalogNamesAnUnknownSprite() {
        Exception error = assertThrows(IllegalArgumentException.class, () -> SpriteCatalog.pathOf("dragon"));
        assertTrue(error.getMessage().contains("dragon"));
    }

    //-------------------- HUD --------------------
    // The starting values come from the caller: other numbers show that nothing is written in the HUD.
    // On the second line, the urn gauge (J10): its words, its green part (150 / 10 000 of the bar) and its outline,
    // then by day the "Lancer la nuit" button (J9), and the sound button (20/11). They are tested in HudTest.
    // The frame of the urn ends at x 372 like the frame of the first line (the user, 25/11).
    @Test
    void hudShowsTheValuesItReceives() {
        RecordingCanvas canvas = new RecordingCanvas();
        new Hud(320, 150, 70, 8, 10000, FRENCH).render(canvas);
        assertEquals(List.of("sprite hud_frame " + new Bounds(0, 296, 372, 20),
                "sprite icon_coin " + new Bounds(4, 302, 10, 10), "text Argent : 150 15.0 312.0",
                "sprite icon_heart " + new Bounds(98, 302, 10, 10), "text PV ferme : 70 109.0 312.0",
                "sprite lifebar_back " + new Bounds(201, 303, 24, 6),
                "sprite lifebar_fill " + new Bounds(202, 304, 22, 4),
                "sprite dial_day " + new Bounds(228, 302, 10, 10), "text Jour : 1 239.0 312.0",
                "text Temps : 0 s 292.0 312.0", "sprite hud_frame " + new Bounds(221, 264, 151, 28),
                "text Urne : 150 / 10 000 225.0 288.0",
                "sprite urn_gauge " + new Bounds(352, 268, 16, 20),
                "sprite button_frame " + new Bounds(5, 272, 93, 19), "text Lancer la nuit 8.0 288.0",
                "sprite button_frame " + new Bounds(478, 8, 63, 19), "text Son : oui 481.0 24.0"), canvas.calls);
    }

    // Without this test, an on... method could forget to rebuild the text and the old value would stay on screen.
    @Test
    void hudFollowsTheEvents() {
        RecordingCanvas canvas = new RecordingCanvas();
        Hud hud = new Hud(320, 200, 100, 8, 10000, FRENCH);
        hud.onMoneyChanged(90);
        hud.onFarmHealthChanged(85);
        hud.onDayStarted(2);
        hud.onTimerChanged(30);
        hud.render(canvas);
        for (String part : List.of("Argent : 90", "PV ferme : 85", "Jour : 2", "Temps : 30 s")) {
            assertTrue(canvas.calls.stream().anyMatch(c -> c.startsWith("text " + part + " ")));
        }
    }

    // Day 3 and night 3 share the number 3: without this test, a night could be shown as "Jour : 3".
    @Test
    void hudShowsTheNightThatStarts() {
        RecordingCanvas canvas = new RecordingCanvas();
        Hud hud = new Hud(320, 200, 100, 8, 10000, FRENCH);
        hud.onNightStarted(3);
        hud.render(canvas);
        assertTrue(canvas.calls.stream().anyMatch(c -> c.startsWith("text Nuit : 3 ")));
    }

    // The reference point of the sheet: the first frame sends everything. The HUD starts with 0 health on purpose:
    // the farm's health (150 since day 10) can only come from the session. The game starts on day 1, which lasts 60 s.
    @Test
    void hudHearsTheSessionFromTheFirstFrame() {
        RecordingCanvas canvas = new RecordingCanvas();
        GameSession session = new GameSession(new GameConfig(), new Random(0));
        Hud hud = new Hud(320, 200, 0, 8, 10000, FRENCH);
        session.addListener(hud);
        session.update(0f);
        hud.render(canvas);
        for (String part : List.of("PV ferme : " + session.getFarmHealth(), "Jour : 1", "Temps : 60 s")) {
            assertTrue(canvas.calls.stream().anyMatch(c -> c.startsWith("text " + part + " ")));
        }
    }

    //-------------------- FARM --------------------
    // Cat: centred on its spot (120, 192). Farmer: x of its spot, y = middle of row 2 (168), 32 px wide.
    // The farm comes first: the farmer and the cat are drawn over it.
    // Pickup: middle 110 px left of the farm point (80 - 110 = -30, off the screen in this test layout only), wheels
    // 12 px under the base of the farm (row 3 starts at y 144): 48 px square starting 48 * 11 / 64 lower.
    // Then a cypress on each end of the pickup (x -54 and -6), its trunk at 120: 56 px square starting 6 lower.
    @Test
    void farmRendererPlacesTheSixSprites() {
        RecordingCanvas canvas = new RecordingCanvas();
        new FarmRenderer(TestLayouts.layout(), 100).render(canvas, 100, dayFarmer(), false, sittingCat(), 0f);
        assertEquals(8, canvas.calls.size());
        assertTrue(canvas.calls.get(0).startsWith("sprite farm Bounds[x=30.0"));
        assertTrue(canvas.calls.get(1).startsWith("sprite shadow "));
        assertEquals("sprite farmer " + new Bounds(120, 152, 32, 32), canvas.calls.get(2));
        assertTrue(canvas.calls.get(3).startsWith("sprite shadow "));
        assertEquals("sprite cat " + new Bounds(114, 186, 12, 12), canvas.calls.get(4));
        assertEquals("sprite pickup " + new Bounds(-54, 132 - 48f * 11 / 64, 48, 48), canvas.calls.get(5));
        assertEquals("sprite cypress " + new Bounds(-82, 114, 56, 56), canvas.calls.get(6));
        assertEquals("sprite cypress " + new Bounds(-34, 114, 56, 56), canvas.calls.get(7));
    }

    // 100 then 95 PV: the farm turns red, the farmer and the cat do not.
    // Without this test, the red could land on the wrong sprite.
    @Test
    void farmTurnsRedWhenHit() {
        FarmRenderer renderer = new FarmRenderer(TestLayouts.layout(), 100);
        renderer.render(new RecordingCanvas(), 100, dayFarmer(), false, sittingCat(), 0.016f);
        RecordingCanvas canvas = new RecordingCanvas();
        renderer.render(canvas, 95, dayFarmer(), false, sittingCat(), 0.016f);
        assertTrue(canvas.calls.get(0).endsWith(" HURT"));
        assertTrue(canvas.calls.get(2).startsWith("sprite farmer") && !canvas.calls.get(2).endsWith(" HURT"));
    }

    // Both sides of every fifth, including the last surviving hit point.
    @Test
    void farmImageFollowsItsHealth() {
        FarmRenderer renderer = new FarmRenderer(TestLayouts.layout(), 100);
        checkBands(renderer, new int[] {0, 1, 20, 21, 40, 41, 60, 61, 80, 81});
    }

    // Fractional boundaries stay between adjacent integer health values.
    @Test
    void farmHalfThresholdWithAnOddFullHealth() {
        FarmRenderer renderer = new FarmRenderer(TestLayouts.layout(), 151);
        checkBands(renderer, new int[] {0, 1, 30, 31, 60, 61, 90, 91, 120, 121});
    }

    private void checkBands(FarmRenderer renderer, int[] health) {
        String[] keys = {"farm_destroyed", "farm_flames", "farm_flames", "farm_smoke", "farm_smoke",
                "farm_half_destroyed", "farm_half_destroyed", "farm_broken_windows", "farm_broken_windows", "farm"};
        for (int i = 0; i < keys.length; i++) {
            assertTrue(firstCallAt(renderer, health[i]).startsWith("sprite " + keys[i] + " Bounds[x=30.0"));
        }
    }

    @Test
    void windowsFollowNightAndSurvivingWalls() {
        FarmRenderer renderer = new FarmRenderer(TestLayouts.layout(), 100);
        RecordingCanvas canvas = new RecordingCanvas();
        renderer.render(canvas, 100, dayFarmer(), true, sittingCat(), 1f);
        renderer.renderWindows(canvas, 100, false, 5f);
        renderer.renderWindows(canvas, 0, true, 5f);
        assertTrue(canvas.extras.isEmpty());
        renderer.renderWindows(canvas, 81, true, 5f);
        renderer.renderWindows(canvas, 80, true, .5f);
        assertTrue(canvas.extras.get(0).startsWith("light farm_light "));
        assertTrue(canvas.extras.get(1).startsWith("light farm_light_broken "));
        assertTrue(canvas.extras.get(1).endsWith(" 0.5"));
    }

    @Test
    void onlyAHealthDropStartsDebrisAndShake() {
        var effects = new com.cropa.view.fx.Effects(new java.util.Random(1));
        FarmRenderer renderer = new FarmRenderer(TestLayouts.layout(), 100, effects);
        RecordingCanvas canvas = new RecordingCanvas();
        int previous = 80;
        for (int hp : new int[] {80, 80, 90, 70, 70}) {
            canvas.extras.clear();
            renderer.render(canvas, hp, dayFarmer(), false, sittingCat(), 1f);
            // The text pass delivers the pending shake to the canvas and consumes it.
            effects.renderTexts(canvas);
            String smallShake = "shake " + com.cropa.view.fx.Effects.SMALL_SHAKE;
            assertEquals(hp < previous ? List.of(smallShake) : List.of(),
                    canvas.extras.stream().filter(call -> call.startsWith("shake ")).toList());
            assertEquals(hp < previous ? 5 : 0,
                    canvas.extras.stream().filter(call -> call.startsWith("particle farm_splinter ")).count());
            previous = hp;
        }
    }

    @Test
    void damageTextShowsOnlyTheHealthLost() {
        var effects = new com.cropa.view.fx.Effects(new java.util.Random(1));
        FarmRenderer renderer = new FarmRenderer(TestLayouts.layout(), 100, effects);
        RecordingCanvas canvas = new RecordingCanvas();
        int previous = 100;
        for (int health : new int[] {100, 90, 90, 100}) {
            effects.update(1f);
            canvas.extras.clear();
            renderer.render(canvas, health, dayFarmer(), false, sittingCat(), 1f);
            effects.renderTexts(canvas);
            var texts = canvas.extras.stream().filter(call -> call.startsWith("float ")).toList();
            assertEquals(health < previous ? 1 : 0, texts.size());
            if (health < previous) {
                assertTrue(texts.get(0).startsWith("float 10 "));
                assertTrue(texts.get(0).endsWith(" ALERT"));
            }
            previous = health;
        }
    }

    // One frame drawn with the given health, after 1 s without change: the red of a hit is over, only the image is left.
    private static String firstCallAt(FarmRenderer renderer, int health) {
        renderer.render(new RecordingCanvas(), health, dayFarmer(), false, sittingCat(), 0f);
        RecordingCanvas canvas = new RecordingCanvas();
        renderer.render(canvas, health, dayFarmer(), false, sittingCat(), 1f);
        return canvas.calls.get(0);
    }

    // The cat, read at each frame (day 12): three drawings. Sitting: "cat" (south-cat.png), the third sprite, and no
    // bubble (6 sprites, the test above). Fleeing: "cat_fleeing" (west-cat.png) at the same place.
    // Without this test, the cat could keep sitting while a bat stands on it.
    @Test
    void fleeingCatIsDrawnTurnedTowardsTheFarm() {
        Cat cat = sittingCat();
        cat.update(0.1f, List.of(enemyOnTheCat()));
        RecordingCanvas canvas = new RecordingCanvas();

        new FarmRenderer(TestLayouts.layout(), 100).render(canvas, 100, dayFarmer(), false, cat, 0f);

        assertEquals(8, canvas.calls.size());
        assertEquals("sprite cat_fleeing " + new Bounds(114, 186, 12, 12), canvas.calls.get(4));
    }

    // Meowing: the sitting cat, then its MEOW bubble right after it, 30 px wide, centred on the cat's x (120), its
    // square from 5 px under the cat's middle (192 - 5 = 187). 7 sprites: the pickup and the cypresses come after.
    // A Random whose draw always wins: after 1 s, the cat meows for 2 s.
    // Without this test, the bubble could stay on screen after the meow, or land far from the cat.
    @Test
    void meowingCatGetsItsBubbleOverItsHead() {
        Cat cat = new Cat(new Random() {
            @Override
            public int nextInt(int bound) {
                return 0;
            }
        });
        cat.update(1f, List.of());
        RecordingCanvas canvas = new RecordingCanvas();

        new FarmRenderer(TestLayouts.layout(), 100).render(canvas, 100, dayFarmer(), false, cat, 0f);

        assertEquals(9, canvas.calls.size());
        assertEquals("sprite cat " + new Bounds(114, 186, 12, 12), canvas.calls.get(4));
        assertEquals("sprite cat_meow " + new Bounds(105, 187, 30, 30), canvas.calls.get(5));
    }

    // Old Garry (day 14, feedback of the mid-term jury): by day in his rocking chair ("farmer"); at night, standing,
    // turned to the enemy he hits, in the 4 directions of his images (Farmer.getFacing): "farmer_north", "_east",
    // "_south", "_west"; "_attack" during the 0.3 s after a hit. Always the second sprite, at the same place and size
    // as the chair (32 px): he does not grow when he stands up.
    // Without these tests, Garry could stay in his chair at night, or look the wrong way.
    private static final Bounds GARRY = new Bounds(120, 152, 32, 32);

    @Test
    void byDayGarrySitsInHisRockingChair() {
        RecordingCanvas canvas = new RecordingCanvas();
        Farmer farmer = farmerWhoJustHit(witchAt(2, 0f));

        new FarmRenderer(TestLayouts.layout(), 100).render(canvas, 100, farmer, false, sittingCat(), 0f);

        assertEquals("sprite farmer " + GARRY, canvas.calls.get(2));
    }

    @Test
    void atNightBeforeHisFirstHitGarryStandsFacingTheField() {
        RecordingCanvas canvas = new RecordingCanvas();

        new FarmRenderer(TestLayouts.layout(), 100).render(canvas, 100, dayFarmer(), true, sittingCat(), 0f);

        assertEquals("sprite farmer_chair " + GARRY, canvas.calls.get(2));
        assertEquals("sprite farmer_east " + GARRY, canvas.calls.get(3));
    }

    // In front of the farm, behind him: west. Ahead of him on his row: east. In his column, on row 1 then row 3:
    // north, then south. Each time just after the hit: the attack image.
    @Test
    void atNightGarryTurnsToTheEnemyHeHitsInTheFourDirections() {
        assertEquals("sprite farmer_west_attack " + GARRY, farmerAtNight(farmerWhoJustHit(witchAt(2, 0f))));
        assertEquals("sprite farmer_east_attack " + GARRY, farmerAtNight(farmerWhoJustHit(witchAt(2, 2.8f))));
        assertEquals("sprite farmer_north_attack " + GARRY, farmerAtNight(farmerWhoJustHit(witchAt(1, 1.5f))));
        assertEquals("sprite farmer_south_attack " + GARRY, farmerAtNight(farmerWhoJustHit(witchAt(3, 1.5f))));
    }

    // 0.3 s after his hit, the pose is over: still turned the same way, without the pitchfork forward.
    @Test
    void atNightAfterHisPoseGarryKeepsFacingHisTarget() {
        Witch witch = witchAt(2, 0f);
        Farmer farmer = farmerWhoJustHit(witch);
        farmer.update(0.5f, List.of(witch));

        assertEquals("sprite farmer_west " + GARRY, farmerAtNight(farmer));
    }

    // The second sprite of one night frame: the farmer.
    private static String farmerAtNight(Farmer farmer) {
        RecordingCanvas canvas = new RecordingCanvas();
        new FarmRenderer(TestLayouts.layout(), 100).render(canvas, 100, farmer, true, sittingCat(), 0f);
        return canvas.calls.get(3);
    }

    // Sample both day transitions, a night hit and both passes of the cat's bath.
    @Test
    void transitionsHurtAndGroomingUseLocalTime() {
        FarmRenderer renderer = new FarmRenderer(TestLayouts.layout(), 100);
        Farmer farmer = dayFarmer();
        Cat cat = sittingCat();
        RecordingCanvas canvas = new RecordingCanvas();
        renderer.render(canvas, 100, farmer, false, cat, 7f);
        assertTrue(canvas.extras.stream().anyMatch(c -> c.contains("cat_grooming") && c.endsWith("0.0 NORMAL")));
        canvas.extras.clear();
        renderer.render(canvas, 100, farmer, true, cat, 0.72f);
        assertTrue(canvas.extras.contains("animation farmer_stand_up " + GARRY + " 0.0 NORMAL"));
        assertTrue(canvas.extras.stream().anyMatch(c -> c.contains("cat_grooming")));
        canvas.extras.clear();
        renderer.render(canvas, 99, farmer, true, cat, 0.73f);
        assertTrue(canvas.extras.contains("animation farmer_east_hurt " + GARRY + " 0.0 NORMAL"));
        assertTrue(canvas.extras.stream().noneMatch(c -> c.contains("cat_grooming")));
        canvas.calls.clear();
        renderer.render(canvas, 99, farmer, true, cat, 0.31f);
        assertEquals("sprite farmer_east " + GARRY, canvas.calls.get(3));
        canvas.extras.clear();
        renderer.render(canvas, 99, farmer, false, cat, 0f);
        assertTrue(canvas.extras.contains("animation farmer_stand_up " + GARRY + " " + Math.nextDown(0.6f) + " NORMAL"));
        canvas.calls.clear();
        renderer.render(canvas, 99, farmer, false, cat, 0.61f);
        assertEquals("sprite farmer " + GARRY, canvas.calls.get(2));
    }

    // A farmer who has hit nobody yet: what the day shows, and the start of a night.
    private static Farmer dayFarmer() {
        return new Farmer(new EnemyConfig());
    }

    // A farmer who has just hit this enemy: his pose is on.
    private static Farmer farmerWhoJustHit(Witch witch) {
        Farmer farmer = dayFarmer();
        farmer.update(0.1f, List.of(witch));
        return farmer;
    }

    // A real witch, walked from the entry (10 cells) to that many cells left to the farm, at her speed: the view
    // tests cannot place an enemy themselves (moveTo is not public).
    private static Witch witchAt(int row, float cellsToFarm) {
        EnemyConfig config = new EnemyConfig();
        Witch witch = new Witch(row, new Farm(config.getFarmHealth()), config);
        witch.update((config.getSpawnCellsToFarm() - cellsToFarm) / config.getSpeed(EnemyType.WITCH));
        return witch;
    }

    // A cat that neither flees nor meows: no enemy, and its first draw comes only after a whole second.
    private static Cat sittingCat() {
        return new Cat(new Random(0));
    }

    // An enemy of the test's own on the cat: still on the board, row 1, half a cell from the farm (Cat flees from 1
    // cell or less). Only what the cat reads matters; the rest is never asked by it.
    private static EnemyView enemyOnTheCat() {
        return new EnemyView() {
            @Override
            public int getRow() {
                return 1;
            }

            @Override
            public float getCellsToFarm() {
                return 0.5f;
            }

            @Override
            public String spriteKey() {
                return "bat";
            }

            @Override
            public boolean isOnBoard() {
                return true;
            }

            @Override
            public int getHealth() {
                return 1;
            }
        };
    }

    //-------------------- OUTLINES --------------------
    // 15 cells in green, then 10 slots in yellow.
    @Test
    void outlineRendererDrawsEveryCellAndSlot() {
        RecordingCanvas canvas = new RecordingCanvas();
        new OutlineRenderer(TestLayouts.layout()).render(canvas);
        assertEquals(25, canvas.calls.size());
        assertEquals(15, canvas.calls.stream().filter(call -> call.contains("GREEN")).count());
        assertEquals(10, canvas.calls.stream().filter(call -> call.contains("YELLOW")).count());
    }

    // Two carrots planted by the test (r1c1, r3c3) on a field of its own: 13 free cells in white, and nothing else.
    // Its own field, not the one of a new session: the count no longer depends on what a game holds at the start.
    @Test
    void renderFreeDrawsTheEmptyCells() {
        RecordingCanvas canvas = new RecordingCanvas();
        Board board = new Board();
        board.getCell(1, 1).place(new Crop(CropType.CARROT, new CropConfig()));
        board.getCell(3, 3).place(new Crop(CropType.CARROT, new CropConfig()));
        new OutlineRenderer(TestLayouts.layout()).renderFree(canvas, Zone.FIELD, board, new DefenseSlots());
        assertEquals(13, canvas.calls.size());
        assertTrue(canvas.calls.stream().allMatch(call -> call.startsWith("sprite cell_frame ")));
    }

    // A catapatate placed by the test on TOP 3, on slots of its own: 9 free slots in white.
    @Test
    void renderFreeDrawsTheEmptySlots() {
        RecordingCanvas canvas = new RecordingCanvas();
        DefenseSlots slots = new DefenseSlots();
        DefenseSlot top3 = slots.getSlot(SlotSide.TOP, 3);
        top3.place(new Catapatate(top3, new DefenseConfig(), new ArrayList<>()));
        new OutlineRenderer(TestLayouts.layout()).renderFree(canvas, Zone.SLOTS, new Board(), slots);
        assertEquals(9, canvas.calls.size());
        assertTrue(canvas.calls.stream().allMatch(call -> call.startsWith("sprite cell_frame ")));
    }

    //-------------------- THE RANGE (J10) --------------------
    // Asked by Axel on day 10: the cells a defense reaches, under a white veil. A catapatate on TOP 3, range 2:
    // r1c2, r1c3, r1c4 and r2c3, row by row, and nothing else.
    @Test
    void renderRangeVeilsTheDiamondOfACatapatate() {
        RecordingCanvas canvas = new RecordingCanvas();
        BoardLayout layout = TestLayouts.layout();
        DefenseSlot top3 = new DefenseSlots().getSlot(SlotSide.TOP, 3);
        Catapatate catapatate = new Catapatate(top3, new DefenseConfig(), new ArrayList<>());

        new OutlineRenderer(layout).renderRange(canvas, catapatate);

        assertEquals(List.of("sprite range_cell " + layout.getCellBounds(1, 2), "sprite range_cell " + layout.getCellBounds(1, 3),
                "sprite range_cell " + layout.getCellBounds(1, 4), "sprite range_cell " + layout.getCellBounds(2, 3)), canvas.calls);
    }

    //-------------------- THE GROWTH DOTS (J10) --------------------
    // Asked by Axel on day 10: one dot per crop, in the bottom right corner of its cell (3 px, 1 px from the edges),
    // red for a seed and green once ripe. An empty cell gets none.
    @Test
    void growthRendererDrawsOneDotPerCrop() {
        RecordingCanvas canvas = new RecordingCanvas();
        BoardLayout layout = TestLayouts.layout();
        Board board = new Board();
        board.getCell(1, 1).place(new Crop(CropType.CARROT, new CropConfig()));
        Crop ripe = new Crop(CropType.CARROT, new CropConfig());
        ripe.grow();
        board.getCell(3, 3).place(ripe);

        new GrowthRenderer(layout).render(canvas, board);

        Bounds r1c1 = layout.getCellBounds(1, 1);
        Bounds r3c3 = layout.getCellBounds(3, 3);
        assertEquals(List.of(
                "dot " + new Bounds(r1c1.x() + r1c1.width() - 4, r1c1.y() + 1, 3, 3) + " SEED",
                "dot " + new Bounds(r3c3.x() + r3c3.width() - 4, r3c3.y() + 1, 3, 3) + " RIPE"), canvas.calls);
    }

    // A defense of the field is not a crop: a bramble gets no dot.
    @Test
    void growthRendererSkipsTheDefensesOfTheField() {
        RecordingCanvas canvas = new RecordingCanvas();
        Board board = new Board();
        board.getCell(2, 2).place(new Bramble(board.getCell(2, 2), new DefenseConfig()));

        new GrowthRenderer(TestLayouts.layout()).render(canvas, board);

        assertTrue(canvas.calls.isEmpty());
    }
}
