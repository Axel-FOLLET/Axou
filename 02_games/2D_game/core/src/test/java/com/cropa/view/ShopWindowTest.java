package com.cropa.view;

// JUnit: the checks the tests use, and the annotations. Java: the empty list of enemies, the source of randomness,
// and Optional for "no zone". The model: a real session for the day and the night, and how it ends (GameResult),
// a real catapatate with its numbers and its slot, the offers of the shop for the field defenses, and a carrot grown
// by hand.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cropa.model.defense.Catapatate;
import com.cropa.model.defense.DefenseConfig;
import com.cropa.model.defense.DefenseOffer;
import com.cropa.model.defense.DefenseSlot;
import com.cropa.model.defense.DefenseType;
import com.cropa.model.defense.SlotSide;
import com.cropa.model.game.GameConfig;
import com.cropa.model.game.GameResult;
import com.cropa.model.game.GameSession;
import com.cropa.model.world.Cell;
import com.cropa.model.world.Crop;
import com.cropa.model.world.CropConfig;
import com.cropa.model.world.CropType;
// Language and Texts: the words of the game in French, the language its layout was measured on.
// Cue: the sounds the panel asks for, written down by the test instead of being played (20/11).
import com.cropa.text.Language;
import com.cropa.text.Texts;
import com.cropa.view.audio.Cue;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Random;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

// No window: the panel draws on a RecordingCanvas and receives clicks as world points.
// The catapatate is the test's own, on a slot outside the game: with no enemy to shoot, its durability only changes
// when a test says so.
/** Tests for {@link ShopWindow}. */
class ShopWindowTest {

    //-------------------- CONSTANTS --------------------
    // The texts the game shows in French, its first language: the layout was measured on them.
    private static final Texts FRENCH = Texts.of(Language.FRENCH);

    //-------------------- FIELDS --------------------
    // Day 10: the starting money and the urn's price are read in the config, so a rebalance breaks no test here.
    // A test that needs "50 coins" spends the rest: START - 50.
    private static final int START = new GameConfig().getStartingMoney();
    private static final int URN_PRICE = new GameConfig().getUrnPrice();
    private GameSession session;
    private ShopWindow shop;
    private Catapatate catapatate;
    private RecordingCanvas canvas;
    // The sounds asked for, in order: the panel receives cues::add as its CuePlayer.
    private List<Cue> cues;

    //-------------------- HELPERS --------------------
    // The game starts on day 1; 45 s later it is still day 1, with 15 s left.
    @BeforeEach
    void startTheDay() {
        session = new GameSession(new GameConfig(), new Random(0));
        session.update(45f);
        cues = new ArrayList<>();
        shop = new ShopWindow(session, new GameConfig().getUrnPrice(), new CropConfig(), FRENCH, cues::add);
        DefenseSlot slot = new DefenseSlot(SlotSide.TOP, 1);
        catapatate = new Catapatate(slot, new DefenseConfig(), new ArrayList<>());
        slot.place(catapatate);
        canvas = new RecordingCanvas();
    }

    // A click in the middle of the "Améliorer" button.
    private boolean clickTheButton() {
        Bounds button = shop.upgradeButton();
        return shop.handleClick(button.x() + button.width() / 2, button.y() + button.height() / 2);
    }

    // True if one recorded call contains the text.
    private boolean drew(String text) {
        return canvas.calls.stream().anyMatch(call -> call.contains(text));
    }

    // An empty cell of the real board: r2c2, where neither the session nor a test plants anything before.
    private Cell emptyCell() {
        return session.getBoard().getCell(2, 2);
    }

    // A carrot planted by the test itself, without paying: the test no longer counts on the carrots of the POC
    // (r1c1, r3c3), removed on day 10. place refuses a taken cell: while the POC is there, its carrot stays, a carrot
    // too, at the same stage, so the test sees the same cell before and after the removal.
    private Cell carrotOn(int row, int column) {
        Cell cell = session.getBoard().getCell(row, column);
        cell.place(new Crop(CropType.CARROT, new CropConfig()));
        return cell;
    }

    // A click in the middle of a line of the "Planter" list: 0 carrot, 1 turnip, 2 garlic, 3 pumpkin.
    private boolean clickPlantLine(int index) {
        return clickIn(ShopWindow.plantLine(index));
    }

    // A click in the middle of any area: the "Planter" button, "Retirer"...
    private boolean clickIn(Bounds area) {
        return shop.handleClick(area.x() + area.width() / 2, area.y() + area.height() / 2);
    }

    // True if one recorded call draws the text in grey, or in white.
    private boolean drewGreyed(String text) {
        return canvas.calls.stream().anyMatch(call -> call.contains(text) && call.endsWith(" GREYED"));
    }

    private boolean drewWhite(String text) {
        return canvas.calls.stream().anyMatch(call -> call.contains(text) && !call.endsWith(" GREYED"));
    }

    // The offer of a defense, as the shop sells it.
    private DefenseOffer offerOf(DefenseType type) {
        return session.getShop().getDefenseOffers().stream()
                .filter(offer -> offer.getType() == type)
                .findFirst()
                .orElseThrow();
    }

    // A click in the middle of a line of the "Défenses" list: 0 catapatate, 1 scarecrow, 2 bramble.
    private boolean clickDefenseLine(int index) {
        return clickIn(ShopWindow.defenseLine(index));
    }

    // A free slot of the real game: BOTTOM 2, where neither the session nor a test places anything before.
    private DefenseSlot freeSlot() {
        return session.getDefenseSlots().getSlot(SlotSide.BOTTOM, 2);
    }

    //-------------------- TESTS --------------------
    // Closed at the start: only the buttons are drawn ("Planter" and "Défenses" with their outlines, and by day the urn,
    // grey, too expensive, but with its white outline: a button like the others, asked by Axel on day 10), and a click
    // on the place of "Améliorer" goes through to the board.
    @Test
    void closedAtTheStart() {
        shop.render(canvas);

        assertFalse(shop.isOpen());
        assertEquals(6, canvas.calls.size());
        assertTrue(drew("text Planter"));
        assertTrue(drew("text Défenses"));
        assertTrue(drewGreyed("text Acheter l'urne 377.0 24.0"));
        assertTrue(drew("outline WHITE " + ShopWindow.URN_BUTTON));
        assertFalse(clickTheButton());
    }

    // Expected by the sheet of the day: a click on the catapatate, by day, opens the panel.
    // Its first line names the defense, its level and its durability.
    @Test
    void openForShowsTheDefense() {
        catapatate.wear(8);
        shop.openFor(catapatate);
        shop.render(canvas);

        assertTrue(shop.isOpen());
        assertTrue(drew("Catapatate N1 92%"));
    }

    // By day, below level 3: the button, with the price of level 2 (100 coins).
    @Test
    void showsTheUpgradeButtonByDay() {
        shop.openFor(catapatate);
        shop.render(canvas);

        assertTrue(drew("Améliorer (100)"));
    }

    // Expected by the sheet of the day: "Améliorer" gives level 2 and durability 100 %, and now costs 100 coins (J9).
    @Test
    void theButtonUpgradesTheDefense() {
        catapatate.wear(8);
        shop.openFor(catapatate);

        assertTrue(clickTheButton());
        assertEquals(2, catapatate.getLevel());
        assertEquals(100, catapatate.getDurability());
        assertEquals(START - 100, session.getWallet().getBalance());
    }

    // Expected by the sheet of the day (J9, Task 4): without enough money, level and balance are unchanged.
    @Test
    void noUpgradeWithoutEnoughMoney() {
        session.getWallet().spend(START - 50);
        shop.openFor(catapatate);

        clickTheButton();

        assertEquals(1, catapatate.getLevel());
        assertEquals(50, session.getWallet().getBalance());
    }

    // Expected by the sheet of the day: at level 3, no button; a click on its place changes nothing.
    // getUpgradePrice would throw at level 3: drawing the panel proves it is never read there.
    @Test
    void noButtonAtLevelThree() {
        catapatate.upgrade();
        catapatate.upgrade();
        shop.openFor(catapatate);
        shop.render(canvas);
        clickTheButton();

        assertFalse(drew("Améliorer ("));
        assertTrue(drew("Niveau max"));
        assertEquals(3, catapatate.getLevel());
    }

    // Expected by the sheet of the day: at night, no button. The panel can still be read.
    @Test
    void noButtonAtNight() {
        session.getCycle().launchNight(session);
        shop.openFor(catapatate);
        shop.render(canvas);
        clickTheButton();

        assertFalse(drew("Améliorer ("));
        assertTrue(drew("Catapatate N1"));
        assertEquals(1, catapatate.getLevel());
    }

    // A defense of the field opens the same panel through its cell (J9: openFor(Cell) replaces openFor(Defense) for
    // the field), with its French name and, by day, the button at the price of its level 2 (60 coins for the bramble).
    @Test
    void openForShowsAFieldDefense() {
        Cell cell = emptyCell();
        session.getShop().buyDefense(offerOf(DefenseType.BRAMBLE), cell);
        shop.openFor(cell);
        shop.render(canvas);

        assertTrue(drew("Ronce N1 100%"));
        assertTrue(drew("Améliorer (60)"));
    }

    // A click outside the panel closes it and goes through: GameScreen then looks for a slot, then a cell.
    @Test
    void aClickOutsideClosesThePanel() {
        shop.openFor(catapatate);

        assertFalse(shop.handleClick(0, 0));
        assertFalse(shop.isOpen());
    }

    // A destroyed defense has left its slot: its panel no longer shows.
    @Test
    void closesWhenTheDefenseIsDestroyed() {
        shop.openFor(catapatate);
        catapatate.wear(100);
        shop.render(canvas);

        assertFalse(shop.isOpen());
        assertFalse(drew("Catapatate"));
    }

    //-------------------- THE "PLANTER" MENU --------------------
    // Expected by the sheet of the day: a click on an empty cell opens the menu, with their price. 5 lines until
    // day 10, 4 since: the bramble moved to the "Défenses" list only (theBrambleIsOnlyInTheDefenseList).
    // Day 14 (asked by Axel): each line also gives the value of the crop once ripe, "Carotte 10 -> 40".
    @Test
    void openForAnEmptyCellShowsTheFourCrops() {
        shop.openFor(emptyCell());
        shop.render(canvas);

        assertTrue(shop.isOpen());
        assertTrue(drew("Planter"));
        assertTrue(drew("Carotte 10 -> 40"));
        assertTrue(drew("Navet 20 -> 90"));
        assertTrue(drew("Ail 20 -> 90"));
        assertTrue(drew("Citrouille 50 -> 1000"));
        assertFalse(drew("Ronce (40)"));
    }

    // A carrot grows on r1c1: no list to plant there, the panel of the carrot instead (just planted: a seed).
    @Test
    void anOccupiedCellShowsNoList() {
        shop.openFor(carrotOn(1, 1));
        shop.render(canvas);

        assertFalse(drew("Carotte 10 -> 40"));
        assertTrue(drew("Carotte, graine"));
    }

    // One panel at a time: opening a defense replaces the menu of the cell.
    @Test
    void openingADefenseClosesTheMenu() {
        shop.openFor(emptyCell());
        shop.openFor(catapatate);
        shop.render(canvas);

        assertTrue(drew("Catapatate N1"));
        assertFalse(drew("Carotte 10 -> 40"));
    }

    // Expected by the sheet of the day: by day, a click on "Carotte" takes 10 coins and the carrot is planted.
    @Test
    void clickOnCarrotPlantsIt() {
        Cell cell = emptyCell();
        shop.openFor(cell);

        assertTrue(clickPlantLine(0));

        assertEquals(START - 10, session.getWallet().getBalance());
        assertEquals("carrot_0", cell.getOccupant().orElseThrow().spriteKey());
    }

    // Asked by Axel on day 10: the bramble is a defense, so it is only in the "Défenses" list. The "Planter" list of
    // an empty cell has the four crops, and nothing on the row where the bramble was.
    @Test
    void theBrambleIsOnlyInTheDefenseList() {
        shop.openFor(emptyCell());
        shop.render(canvas);

        assertTrue(drew("Citrouille 50 -> 1000"));
        assertFalse(drew("Ronce"));
        assertFalse(drew("outline WHITE " + ShopWindow.plantLine(4)));

        canvas.calls.clear();
        clickIn(shop.defenseButton());
        shop.render(canvas);

        assertTrue(drew("Ronce (40)"));
    }

    // The bramble is still bought through its offer (40 coins), from the "Défenses" list, then a click on a cell.
    @Test
    void theDefenseListPlacesTheBramble() {
        Cell cell = emptyCell();
        clickIn(shop.defenseButton());
        clickDefenseLine(2);

        shop.handleCellClick(cell);

        assertEquals(START - 40, session.getWallet().getBalance());
        assertTrue(session.getDefenseSlots().getDefenseOn(cell).isPresent());
    }

    // Once planted, the cell is no longer empty: the menu closes by itself.
    @Test
    void theMenuClosesOnceTheCellIsPlanted() {
        shop.openFor(emptyCell());

        clickPlantLine(0);

        assertFalse(shop.isOpen());
    }

    // Expected by the sheet of the day: at night the menu shows, but a click on a line buys nothing.
    @Test
    void noPurchaseAtNight() {
        session.getCycle().launchNight(session);
        Cell cell = emptyCell();
        shop.openFor(cell);
        shop.render(canvas);

        assertTrue(clickPlantLine(0));

        assertTrue(drew("Carotte 10 -> 40"));
        assertEquals(START, session.getWallet().getBalance());
        assertTrue(cell.isEmpty());
    }

    //-------------------- THE "PLANTER" BUTTON --------------------
    // The button unrolls the list, every line in white: nothing is picked yet.
    @Test
    void theButtonUnrollsTheList() {
        assertTrue(clickIn(shop.plantButton()));
        shop.render(canvas);

        assertTrue(shop.isOpen());
        assertTrue(drewWhite("Carotte 10 -> 40"));
        assertTrue(drewWhite("Citrouille 50 -> 1000"));
    }

    // A click on the button again rolls the list up.
    @Test
    void theButtonAgainRollsTheListUp() {
        clickIn(shop.plantButton());
        clickIn(shop.plantButton());

        assertFalse(shop.isOpen());
    }

    // Asked by Axel: once a line is picked, the others turn grey. Nothing is bought yet: the cell comes next.
    @Test
    void pickingALineGreysTheOthers() {
        clickIn(shop.plantButton());
        clickPlantLine(0);
        shop.render(canvas);

        assertTrue(shop.hasPendingChoice());
        assertTrue(drewWhite("Carotte 10 -> 40"));
        assertTrue(drewGreyed("Navet 20 -> 90"));
        assertTrue(drewGreyed("Citrouille 50 -> 1000"));
        assertEquals(START, session.getWallet().getBalance());
    }

    // Asked by Axel: a click on a grey line changes the choice; the first one turns grey.
    @Test
    void pickingAnotherLineChangesTheChoice() {
        clickIn(shop.plantButton());
        clickPlantLine(0);
        clickPlantLine(1);
        shop.render(canvas);

        assertTrue(drewWhite("Navet 20 -> 90"));
        assertTrue(drewGreyed("Carotte 10 -> 40"));
    }

    // With a line picked, a click outside the list is not kept (false): GameScreen gives it to the cell under it.
    @Test
    void aPickedLineWaitsForACell() {
        clickIn(shop.plantButton());
        clickPlantLine(0);

        assertFalse(shop.handleClick(0, 0));
        assertTrue(shop.hasPendingChoice());
    }

    // Without a line picked, a click outside the list rolls it up, and false lets GameScreen look at the board.
    @Test
    void aClickOutsideTheListWithoutALineRollsItUp() {
        clickIn(shop.plantButton());

        assertFalse(shop.handleClick(0, 0));
        assertFalse(shop.isOpen());
    }

    // Asked by Axel: a click on a free cell plants the picked line, and the list rolls up.
    @Test
    void aClickOnAFreeCellPlantsThePickedLine() {
        Cell cell = emptyCell();
        clickIn(shop.plantButton());
        clickPlantLine(1);

        shop.handleCellClick(cell);

        assertEquals(START - 20, session.getWallet().getBalance());
        assertEquals("turnip_0", cell.getOccupant().orElseThrow().spriteKey());
        assertFalse(shop.isOpen());
        assertFalse(shop.hasPendingChoice());
    }

    // A taken cell refuses: nothing is paid, and the line stays picked for another cell.
    @Test
    void aTakenCellKeepsThePickedLine() {
        Cell taken = carrotOn(1, 1);
        clickIn(shop.plantButton());
        clickPlantLine(0);

        shop.handleCellClick(taken);

        assertEquals(START, session.getWallet().getBalance());
        assertTrue(shop.hasPendingChoice());
    }

    // A line picked at the end of the day, then the night falls: a click on a free cell plants nothing, and the line
    // stays picked.
    @Test
    void aLinePickedByDayIsNotPlantedAtNight() {
        Cell cell = emptyCell();
        clickIn(shop.plantButton());
        clickPlantLine(0);
        session.getCycle().launchNight(session);

        shop.handleCellClick(cell);

        assertEquals(START, session.getWallet().getBalance());
        assertTrue(cell.isEmpty());
        assertTrue(shop.hasPendingChoice());
    }

    // At night the list unrolls, every line grey, and no line can be picked.
    @Test
    void atNightEveryLineIsGreyAndNothingIsPicked() {
        session.getCycle().launchNight(session);
        clickIn(shop.plantButton());
        clickPlantLine(0);
        shop.render(canvas);

        assertFalse(shop.hasPendingChoice());
        assertTrue(drewGreyed("Carotte 10 -> 40"));
        assertTrue(drewGreyed("Citrouille 50 -> 1000"));
    }

    //-------------------- FREE PLACES --------------------
    // Asked by Axel, case 2: the list of the button is open, the free cells of the field are shown.
    @Test
    void theListShowsTheField() {
        clickIn(shop.plantButton());

        assertEquals(Optional.of(Zone.FIELD), shop.highlightedZone());
    }

    // Asked by Axel, case 1: a click on the field (an empty cell) shows the field.
    @Test
    void anEmptyCellShowsTheField() {
        shop.handleCellClick(emptyCell());

        assertEquals(Optional.of(Zone.FIELD), shop.highlightedZone());
    }

    // The panel of a defense of the field shows the field: the player works on the cells.
    @Test
    void aFieldDefenseShowsTheField() {
        Cell cell = emptyCell();
        session.getShop().buyDefense(offerOf(DefenseType.BRAMBLE), cell);

        shop.handleCellClick(cell);

        assertEquals(Optional.of(Zone.FIELD), shop.highlightedZone());
    }

    // The same for the panel of a crop.
    @Test
    void aCropShowsTheField() {
        shop.handleCellClick(ripeCarrot());

        assertEquals(Optional.of(Zone.FIELD), shop.highlightedZone());
    }

    // Asked by Axel, case 1: a click on a defense of a slot shows the slots.
    @Test
    void aSlotDefenseShowsTheSlots() {
        shop.openFor(catapatate);

        assertEquals(Optional.of(Zone.SLOTS), shop.highlightedZone());
    }

    // Nothing open, or the night: nothing in white.
    @Test
    void nothingIsShownWhenClosedOrAtNight() {
        assertEquals(Optional.empty(), shop.highlightedZone());

        session.getCycle().launchNight(session);
        clickIn(shop.plantButton());

        assertEquals(Optional.empty(), shop.highlightedZone());
    }

    //-------------------- THE HARVEST (J9, Task 3) --------------------
    // A ripe carrot on r2c2, the way the game makes one: planted, then grown one stage.
    private Cell ripeCarrot() {
        Cell cell = emptyCell();
        Crop carrot = new Crop(CropType.CARROT, new CropConfig());
        cell.place(carrot);
        carrot.grow();
        return cell;
    }

    // Asked by Axel: a click on a crop no longer sells it. It opens its panel, with "Vendre" and its price.
    @Test
    void aClickOnACropOpensItsPanelWithoutSelling() {
        Cell cell = ripeCarrot();

        shop.handleCellClick(cell);
        shop.render(canvas);

        assertEquals(START, session.getWallet().getBalance());
        assertFalse(cell.isEmpty());
        assertTrue(drew("Carotte, mûre"));
        assertTrue(drew("Vendre (40)"));
    }

    // The panel of a crop counts as open, like the panel of a defense: GameScreen asks isOpen to know whether a click
    // is used by the shop.
    @Test
    void aCropPanelCountsAsOpen() {
        shop.handleCellClick(ripeCarrot());

        assertTrue(shop.isOpen());
    }

    // A carrot grows elsewhere on the field: a click on the bramble opens the bramble, not that carrot. currentCrop
    // keeps the very object standing on the clicked cell (==), not the first crop of the field.
    @Test
    void aDefenseCellIsNotTakenForACrop() {
        carrotOn(1, 1);
        Cell cell = emptyCell();
        session.getShop().buyDefense(offerOf(DefenseType.BRAMBLE), cell);

        shop.handleCellClick(cell);
        shop.render(canvas);

        assertTrue(drew("Ronce N1"));
        assertFalse(drew("Carotte"));
    }

    // Expected by the sheet of the day, through the panel: "Vendre" on a ripe carrot, +40 coins, the cell is empty.
    @Test
    void sellingARipeCarrot() {
        Cell cell = ripeCarrot();
        shop.handleCellClick(cell);

        assertTrue(clickIn(ShopWindow.SELL_BUTTON));

        assertEquals(START + 40, session.getWallet().getBalance());
        assertTrue(cell.isEmpty());
        assertFalse(shop.isOpen());
    }

    // A click elsewhere cancels: the panel closes, the carrot stays, nothing is paid.
    @Test
    void aClickElsewhereCancelsTheSale() {
        Cell cell = ripeCarrot();
        shop.handleCellClick(cell);

        assertFalse(shop.handleClick(0, 0));

        assertFalse(shop.isOpen());
        assertEquals(START, session.getWallet().getBalance());
        assertFalse(cell.isEmpty());
    }

    // The sale is an action: at night, the panel shows without "Vendre", and a click on its place sells nothing.
    @Test
    void noSaleAtNight() {
        Cell cell = carrotOn(1, 1);
        session.getCycle().launchNight(session);
        shop.handleCellClick(cell);
        shop.render(canvas);

        clickIn(ShopWindow.SELL_BUTTON);

        assertTrue(drew("Carotte, graine"));
        assertFalse(drew("Vendre ("));
        assertEquals(START, session.getWallet().getBalance());
        assertFalse(cell.isEmpty());
    }

    // Expected by the sheet of day 9, renamed on day 10 (asked by Axel: a bramble is removed, not harvested):
    // "Retirer" on a bramble, balance unchanged, the cell is empty.
    @Test
    void removingABrambleFreesTheCellForNothing() {
        Cell cell = emptyCell();
        session.getShop().buyDefense(offerOf(DefenseType.BRAMBLE), cell);
        shop.handleCellClick(cell);
        shop.render(canvas);

        assertTrue(drew("text Retirer"));
        assertFalse(drew("Récolter"));
        assertTrue(clickIn(ShopWindow.REMOVE_BUTTON));

        assertEquals(START - 40, session.getWallet().getBalance());
        assertTrue(cell.isEmpty());
        assertFalse(shop.isOpen());
    }

    // With the panel of a bramble open, a click outside it closes the panel and removes nothing: only "Retirer" does.
    @Test
    void aClickOutsideTheBramblePanelRemovesNothing() {
        Cell cell = emptyCell();
        session.getShop().buyDefense(offerOf(DefenseType.BRAMBLE), cell);
        shop.handleCellClick(cell);

        assertFalse(shop.handleClick(0, 0));
        assertFalse(cell.isEmpty());
        assertEquals(START - 40, session.getWallet().getBalance());
    }

    //-------------------- REMOVING THE OTHER DEFENSES (J14) --------------------
    // Asked by Axel on day 14: the scarecrow is removed like the bramble, for nothing. Its cell is empty and the field
    // forgets it, so the game no longer updates it.
    @Test
    void removingAScarecrowFreesTheCellForNothing() {
        Cell cell = emptyCell();
        int price = offerOf(DefenseType.SCARECROW).getPrice();
        session.getShop().buyDefense(offerOf(DefenseType.SCARECROW), cell);
        shop.handleCellClick(cell);
        shop.render(canvas);

        assertTrue(drew("Épouvantail N1"));
        assertTrue(drew("text Retirer"));
        assertTrue(clickIn(ShopWindow.REMOVE_BUTTON));

        assertEquals(START - price, session.getWallet().getBalance());
        assertTrue(cell.isEmpty());
        assertTrue(session.getDefenseSlots().getDefenseOn(cell).isEmpty());
        assertFalse(shop.isOpen());
    }

    // The catapatate, opened from its slot: "Retirer" empties the slot, for nothing, and the panel closes.
    @Test
    void removingACatapatateFreesItsSlotForNothing() {
        DefenseSlot slot = freeSlot();
        int price = offerOf(DefenseType.CATAPATATE).getPrice();
        session.getShop().buyDefense(offerOf(DefenseType.CATAPATATE), slot);
        shop.handleSlotClick(slot);
        shop.render(canvas);

        assertTrue(drew("Catapatate N1"));
        assertTrue(drew("text Retirer"));
        assertTrue(clickIn(ShopWindow.REMOVE_BUTTON));

        assertEquals(START - price, session.getWallet().getBalance());
        assertTrue(slot.getDefense().isEmpty());
        assertFalse(shop.isOpen());
    }

    // A removal is an action, like a sale: at night, no "Retirer", and a click on its place keeps the catapatate.
    @Test
    void noRemoveAtNight() {
        DefenseSlot slot = freeSlot();
        session.getShop().buyDefense(offerOf(DefenseType.CATAPATATE), slot);
        session.getCycle().launchNight(session);
        shop.handleSlotClick(slot);
        shop.render(canvas);

        clickIn(ShopWindow.REMOVE_BUTTON);

        assertTrue(drew("Catapatate N1"));
        assertFalse(drew("Retirer"));
        assertTrue(slot.getDefense().isPresent());
    }

    // Opened without its slot (openFor alone), the panel cannot know which slot to empty: no "Retirer".
    @Test
    void aCatapatateOpenedWithoutItsSlotHasNoRemove() {
        shop.openFor(catapatate);
        shop.render(canvas);

        assertTrue(drew("Catapatate N1"));
        assertFalse(drew("Retirer"));
    }

    //-------------------- THE COLORS OF THE GROWTH (J10) --------------------
    // Asked by Axel on day 10: the panel of a crop gives its growth in color. A carrot just planted: red.
    @Test
    void aSeedIsRed() {
        shop.handleCellClick(carrotOn(1, 1));
        shop.render(canvas);

        assertTrue(drew("text Carotte, graine 400.0 288.0 SEED"));
    }

    // A pumpkin has 4 stages: grown once, it is neither a seed nor ripe, so orange.
    @Test
    void aGrowingCropIsOrange() {
        Cell cell = emptyCell();
        Crop pumpkin = new Crop(CropType.PUMPKIN, new CropConfig());
        cell.place(pumpkin);
        pumpkin.grow();
        shop.handleCellClick(cell);
        shop.render(canvas);

        assertTrue(drew("text Citrouille, en pousse 400.0 288.0 GROWING"));
    }

    // A ripe carrot: green.
    @Test
    void aRipeCropIsGreen() {
        shop.handleCellClick(ripeCarrot());
        shop.render(canvas);

        assertTrue(drew("text Carotte, mûre 400.0 288.0 RIPE"));
    }

    //-------------------- THE RANGE (J10) --------------------
    // Read by GameScreen to veil the range: the defense of the open panel, and nothing once it is closed.
    @Test
    void theShownDefenseIsTheOneOfThePanel() {
        assertTrue(shop.shownDefense().isEmpty());

        shop.openFor(catapatate);
        assertEquals(Optional.of(catapatate), shop.shownDefense());

        shop.close();
        assertTrue(shop.shownDefense().isEmpty());
    }

    // The panel can be read at night: the range too.
    @Test
    void theShownDefenseStaysAtNight() {
        session.getCycle().launchNight(session);
        shop.openFor(catapatate);

        assertEquals(Optional.of(catapatate), shop.shownDefense());
    }

    //-------------------- THE "DÉFENSES" BUTTON (J9, Task 6) --------------------
    // Asked by Axel: the "Défenses" button unrolls the three offers with their price, every line in white.
    @Test
    void theDefenseButtonUnrollsTheThreeOffers() {
        assertTrue(clickIn(shop.defenseButton()));
        shop.render(canvas);

        assertTrue(shop.isOpen());
        assertTrue(drewWhite("Catapatate (150)"));
        assertTrue(drewWhite("Épouvantail (120)"));
        assertTrue(drewWhite("Ronce (40)"));
    }

    // Expected by the sheet of the day: a click on an offer, by day, keeps it (getPendingOffer). Asked by Axel: the
    // others turn grey. Nothing is paid yet: the slot or the cell comes next.
    @Test
    void pickingAnOfferKeepsItAndGreysTheOthers() {
        clickIn(shop.defenseButton());
        clickDefenseLine(0);
        shop.render(canvas);

        assertEquals(DefenseType.CATAPATATE, shop.getPendingOffer().orElseThrow().getType());
        assertTrue(drewWhite("Catapatate (150)"));
        assertTrue(drewGreyed("Épouvantail (120)"));
        assertTrue(drewGreyed("Ronce (40)"));
        assertEquals(START, session.getWallet().getBalance());
    }

    // A click on the "Défenses" button again rolls the list up, like the "Planter" button.
    @Test
    void theDefenseButtonAgainRollsTheListUp() {
        clickIn(shop.defenseButton());
        clickIn(shop.defenseButton());

        assertFalse(shop.isOpen());
    }

    // Without an offer picked, a click outside the list rolls it up, and false lets GameScreen look at the board.
    @Test
    void aClickOutsideTheDefenseListWithoutAnOfferRollsItUp() {
        clickIn(shop.defenseButton());

        assertFalse(shop.handleClick(0, 0));
        assertFalse(shop.isOpen());
    }

    // With an offer picked, a click outside the list is not kept (false): GameScreen gives it to the slot or the cell
    // under it, and the offer waits for it.
    @Test
    void aPickedOfferWaitsForASlotOrACell() {
        clickIn(shop.defenseButton());
        clickDefenseLine(0);

        assertFalse(shop.handleClick(0, 0));
        assertTrue(shop.getPendingOffer().isPresent());
    }

    // Expected by the sheet of the day: the catapatate, then a free slot: -150 coins, it stands there.
    // Asked by Axel: the list rolls up once it is placed.
    @Test
    void theCatapatateGoesOnAFreeSlot() {
        DefenseSlot slot = freeSlot();
        clickIn(shop.defenseButton());
        clickDefenseLine(0);

        shop.handleSlotClick(slot);

        assertEquals(START - 150, session.getWallet().getBalance());
        assertEquals(DefenseType.CATAPATATE, slot.getDefense().orElseThrow().getType());
        assertFalse(shop.isOpen());
        assertTrue(shop.getPendingOffer().isEmpty());
    }

    // Expected by the sheet of the day: the scarecrow, then a slot: nothing is paid.
    // Asked by Axel: the refused placement keeps the scarecrow picked, for a cell.
    @Test
    void theScarecrowOnASlotCostsNothing() {
        DefenseSlot slot = freeSlot();
        clickIn(shop.defenseButton());
        clickDefenseLine(1);

        shop.handleSlotClick(slot);

        assertEquals(START, session.getWallet().getBalance());
        assertTrue(slot.isEmpty());
        assertEquals(DefenseType.SCARECROW, shop.getPendingOffer().orElseThrow().getType());
    }

    // The scarecrow goes on a free cell of the field: -120 coins, kept by the defense slots of the game.
    @Test
    void theScarecrowGoesOnAFreeCell() {
        Cell cell = emptyCell();
        clickIn(shop.defenseButton());
        clickDefenseLine(1);

        shop.handleCellClick(cell);

        assertEquals(START - 120, session.getWallet().getBalance());
        assertTrue(session.getDefenseSlots().getDefenseOn(cell).isPresent());
        assertFalse(shop.isOpen());
    }

    // A catapatate picked at the end of the day, then the night falls: a click on a free slot places nothing, and
    // the offer stays picked for the next day.
    @Test
    void aDefensePickedByDayIsNotPlacedOnASlotAtNight() {
        DefenseSlot slot = freeSlot();
        clickIn(shop.defenseButton());
        clickDefenseLine(0);
        session.getCycle().launchNight(session);

        shop.handleSlotClick(slot);

        assertEquals(START, session.getWallet().getBalance());
        assertTrue(slot.isEmpty());
        assertTrue(shop.getPendingOffer().isPresent());
    }

    // The same on the field: a scarecrow picked by day is not placed on a free cell at night.
    @Test
    void aDefensePickedByDayIsNotPlacedOnACellAtNight() {
        Cell cell = emptyCell();
        clickIn(shop.defenseButton());
        clickDefenseLine(1);
        session.getCycle().launchNight(session);

        shop.handleCellClick(cell);

        assertEquals(START, session.getWallet().getBalance());
        assertTrue(cell.isEmpty());
        assertTrue(shop.getPendingOffer().isPresent());
    }

    // The catapatate only goes on a slot: on a cell of the field it is refused, nothing is paid, and it stays picked
    // for a slot. The mirror of theScarecrowOnASlotCostsNothing.
    @Test
    void theCatapatateOnACellCostsNothing() {
        Cell cell = emptyCell();
        clickIn(shop.defenseButton());
        clickDefenseLine(0);

        shop.handleCellClick(cell);

        assertEquals(START, session.getWallet().getBalance());
        assertTrue(cell.isEmpty());
        assertEquals(DefenseType.CATAPATATE, shop.getPendingOffer().orElseThrow().getType());
    }

    // Asked by Axel: the free places in white follow the offer picked: the slots for the catapatate, the field for the
    // scarecrow. Before a pick, nothing: the list alone does not say where to click.
    @Test
    void theFreePlacesFollowTheOfferPicked() {
        clickIn(shop.defenseButton());
        assertEquals(Optional.empty(), shop.highlightedZone());

        clickDefenseLine(0);
        assertEquals(Optional.of(Zone.SLOTS), shop.highlightedZone());

        clickDefenseLine(1);
        assertEquals(Optional.of(Zone.FIELD), shop.highlightedZone());
    }

    // Without an offer picked, a click on a slot opens the panel of its defense: a catapatate placed by the test on
    // TOP 3. While the POC is there, place refuses and the catapatate of the POC answers: same name, same level.
    @Test
    void aSlotWithoutAnOfferOpensItsDefense() {
        DefenseSlot top3 = session.getDefenseSlots().getSlot(SlotSide.TOP, 3);
        top3.place(new Catapatate(top3, new DefenseConfig(), new ArrayList<>()));
        shop.handleSlotClick(top3);
        shop.render(canvas);

        assertTrue(drew("Catapatate N1"));
    }

    // One list at a time: "Planter" rolls the defenses up and forgets the offer picked.
    @Test
    void thePlantButtonClosesTheDefenseList() {
        clickIn(shop.defenseButton());
        clickDefenseLine(0);

        clickIn(shop.plantButton());
        shop.render(canvas);

        assertTrue(shop.getPendingOffer().isEmpty());
        assertFalse(drew("Catapatate (150)"));
        assertTrue(drew("Carotte 10 -> 40"));
    }

    // The shop can be read at night (rules, section 11): the three offers, all grey, and none can be picked.
    @Test
    void atNightTheOffersAreGreyAndNothingIsPicked() {
        session.getCycle().launchNight(session);
        clickIn(shop.defenseButton());
        clickDefenseLine(0);
        shop.render(canvas);

        assertTrue(shop.getPendingOffer().isEmpty());
        assertTrue(drewGreyed("Catapatate (150)"));
        assertTrue(drewGreyed("Ronce (40)"));
    }

    //-------------------- TOO EXPENSIVE (asked by Axel after his test of J9) --------------------
    // 30 coins: the carrot (10) and the turnip and the garlic (20) stay white; the pumpkin (50) turns grey, and a
    // click on it picks nothing.
    @Test
    void theSeedsTooExpensiveAreGreyAndCannotBePicked() {
        session.getWallet().spend(START - 30);
        clickIn(shop.plantButton());

        clickPlantLine(3);
        shop.render(canvas);

        assertTrue(drewWhite("Carotte 10 -> 40"));
        assertTrue(drewWhite("Ail 20 -> 90"));
        assertTrue(drewGreyed("Citrouille 50 -> 1000"));
        assertFalse(shop.hasPendingChoice());
    }

    // 130 coins: the catapatate (150) turns grey and cannot be picked; the scarecrow (120) stays white.
    @Test
    void theDefensesTooExpensiveAreGreyAndCannotBePicked() {
        session.getWallet().spend(START - 130);
        clickIn(shop.defenseButton());

        clickDefenseLine(0);
        shop.render(canvas);

        assertTrue(drewGreyed("Catapatate (150)"));
        assertTrue(drewWhite("Épouvantail (120)"));
        assertTrue(shop.getPendingOffer().isEmpty());
    }

    // 50 coins: "Améliorer (100)" is grey and has no outline.
    @Test
    void theUpgradeTooExpensiveIsGrey() {
        session.getWallet().spend(START - 50);
        shop.openFor(catapatate);
        shop.render(canvas);

        assertTrue(drewGreyed("Améliorer (100)"));
        assertFalse(drew("outline WHITE " + shop.upgradeButton()));
    }

    // With the 10 000 coins, the urn turns white, with its outline.
    @Test
    void theUrnTurnsWhiteWithItsPrice() {
        session.getWallet().add(URN_PRICE - START);
        shop.render(canvas);

        assertTrue(drewWhite("Acheter l'urne"));
        assertTrue(drew("outline WHITE " + ShopWindow.URN_BUTTON));
    }

    //-------------------- THE URN (J9, Task 8) --------------------
    // Expected by the sheet of the day: with 10 000 coins, a click on the urn wins the game; the urn takes them all.
    @Test
    void theUrnWinsTheGame() {
        session.getWallet().add(URN_PRICE - START);

        assertTrue(clickIn(ShopWindow.URN_BUTTON));

        assertEquals(Optional.of(GameResult.VICTORY), session.getResult());
        assertEquals(0, session.getWallet().getBalance());
    }

    // Not enough money: nothing is paid, the game goes on.
    @Test
    void noUrnWithoutTheMoney() {
        clickIn(ShopWindow.URN_BUTTON);

        assertFalse(session.isOver());
        assertEquals(START, session.getWallet().getBalance());
    }

    // At night: no urn line, and a click on its place buys nothing, even with the money.
    @Test
    void noUrnAtNight() {
        session.getCycle().launchNight(session);
        session.getWallet().add(URN_PRICE - START);
        shop.render(canvas);

        clickIn(ShopWindow.URN_BUTTON);

        assertFalse(drew("Urne"));
        assertFalse(session.isOver());
    }

    //-------------------- AN EMPTY SLOT (J14) --------------------
    // Asked by Axel on day 14: a click on an empty slot opens the "Défenses" list, the way an empty cell opens the
    // "Planter" list. The catapatate can be bought there; the scarecrow and the bramble go on the field: grey.
    @Test
    void anEmptySlotOpensTheDefenseList() {
        shop.handleSlotClick(freeSlot());
        shop.render(canvas);

        assertTrue(shop.isOpen());
        assertTrue(drewWhite("Catapatate (150)"));
        assertTrue(drewGreyed("Épouvantail"));
        assertTrue(drewGreyed("Ronce"));
    }

    // The catapatate picked in that list is bought on the slot at once: -150 coins, it stands there, the list rolls up.
    @Test
    void theCatapatatePickedFromAnEmptySlotIsBoughtOnIt() {
        DefenseSlot slot = freeSlot();
        shop.handleSlotClick(slot);

        assertTrue(clickDefenseLine(0));

        assertEquals(START - 150, session.getWallet().getBalance());
        assertEquals(DefenseType.CATAPATATE, slot.getDefense().orElseThrow().getType());
        assertFalse(shop.isOpen());
    }

    // The scarecrow cannot go on a slot: a click on its grey line buys nothing and picks nothing; the list stays.
    @Test
    void theScarecrowCannotBePickedFromAnEmptySlot() {
        DefenseSlot slot = freeSlot();
        shop.handleSlotClick(slot);

        clickDefenseLine(1);

        assertEquals(START, session.getWallet().getBalance());
        assertTrue(slot.isEmpty());
        assertTrue(shop.getPendingOffer().isEmpty());
        assertTrue(shop.isOpen());
    }

    // The free slots are shown in white while that list is open, like the free cells for the "Planter" list.
    @Test
    void anEmptySlotShowsTheFreeSlots() {
        shop.handleSlotClick(freeSlot());

        assertEquals(Optional.of(Zone.SLOTS), shop.highlightedZone());
    }

    // A click outside the list closes it and goes through to the board (false): another empty slot can open it again.
    @Test
    void aClickOutsideClosesTheListOfASlot() {
        shop.handleSlotClick(freeSlot());

        assertFalse(shop.handleClick(0, 0));
        assertFalse(shop.isOpen());
    }

    // At night, the list of an empty slot can be read but buys nothing.
    @Test
    void nothingIsBoughtFromAnEmptySlotAtNight() {
        DefenseSlot slot = freeSlot();
        session.getCycle().launchNight(session);
        shop.handleSlotClick(slot);

        clickDefenseLine(0);

        assertEquals(START, session.getWallet().getBalance());
        assertTrue(slot.isEmpty());
    }

    //-------------------- OPENED BY THE TUTORIAL --------------------
    // The tutorial unrolls the "Planter" list as the button does: every line in white, nothing picked yet, and what
    // was open before closes.
    @Test
    void showPlantListUnrollsTheListLikeTheButton() {
        clickIn(shop.defenseButton());
        shop.showPlantList();
        shop.render(canvas);

        assertTrue(shop.isOpen());
        assertTrue(drewWhite("Carotte 10 -> 40"));
        assertFalse(drew("Catapatate (150)"));
        assertFalse(shop.hasPendingChoice());
    }

    // Unlike the button, showing it twice keeps it shown: the tutorial asks again at each bubble.
    @Test
    void showPlantListTwiceKeepsTheListShown() {
        shop.showPlantList();
        shop.showPlantList();

        assertTrue(shop.isOpen());
    }

    // The same for the "Défenses" list: the three offers, the "Planter" list rolled up.
    @Test
    void showDefenseListUnrollsTheDefenseListLikeTheButton() {
        clickIn(shop.plantButton());
        shop.showDefenseList();
        shop.render(canvas);

        assertTrue(shop.isOpen());
        assertTrue(drewWhite("Catapatate (150)"));
        assertFalse(drew("Carotte 10 -> 40"));
        assertTrue(shop.getPendingOffer().isEmpty());
    }

    @Test
    void showDefenseListTwiceKeepsTheListShown() {
        shop.showDefenseList();
        shop.showDefenseList();

        assertTrue(shop.isOpen());
    }

    //-------------------- SOUNDS --------------------
    // 20/11: each click asks for its sound. The panel only names it; the Jukebox plays it, or not if the sound is cut.

    // The button opens its list with the sound of the shop, and rolls it up with a plain click.
    @Test
    void theButtonOpensWithTheShopSoundAndClosesWithAClick() {
        clickIn(shop.plantButton());
        clickIn(shop.plantButton());

        assertEquals(List.of(Cue.UI_SHOP_OPEN, Cue.UI_CLICK), cues);
    }

    // The tutorial unrolls the list itself: no sound, the player did not click.
    @Test
    void theTutorialOpensTheListsWithoutASound() {
        shop.showPlantList();
        shop.showDefenseList();

        assertTrue(cues.isEmpty());
    }

    // From an empty cell: the list opens, then the carrot is planted on that cell.
    @Test
    void aSeedPlantedSoundsLikeAPlanting() {
        shop.handleCellClick(emptyCell());
        clickPlantLine(0);

        assertEquals(List.of(Cue.UI_SHOP_OPEN, Cue.PLANT), cues);
        assertFalse(emptyCell().isEmpty());
    }

    // From the button: the line picked clicks, the planting comes with the click on the cell.
    @Test
    void aLinePickedClicksThenTheCellPlants() {
        clickIn(shop.plantButton());
        clickPlantLine(0);
        shop.handleCellClick(emptyCell());

        assertEquals(List.of(Cue.UI_SHOP_OPEN, Cue.UI_CLICK, Cue.PLANT), cues);
    }

    // A line the player cannot pay is grey: a click on it is refused, and sounds so.
    @Test
    void aGreyLineIsRefused() {
        session.getWallet().spend(START);
        clickIn(shop.plantButton());
        clickPlantLine(0);

        assertEquals(List.of(Cue.UI_SHOP_OPEN, Cue.UI_REFUSED), cues);
    }

    // A line picked, then a taken cell: the shop refuses the planting.
    @Test
    void aTakenCellIsRefused() {
        Cell carrot = carrotOn(1, 1);
        clickIn(shop.plantButton());
        clickPlantLine(0);
        shop.handleCellClick(carrot);

        assertEquals(Cue.UI_REFUSED, cues.get(cues.size() - 1));
    }

    @Test
    void anUpgradeSoundsLikeAnUpgrade() {
        shop.openFor(catapatate);
        clickTheButton();

        assertEquals(List.of(Cue.DEFENSE_UPGRADE), cues);
    }

    @Test
    void anUpgradeWithoutEnoughMoneyIsRefused() {
        session.getWallet().spend(START - 50);
        shop.openFor(catapatate);
        clickTheButton();

        assertEquals(List.of(Cue.UI_REFUSED), cues);
    }

    // The panel of the carrot opens, then "Vendre" sells it.
    @Test
    void aSaleSoundsLikeAHarvest() {
        shop.handleCellClick(ripeCarrot());
        clickIn(ShopWindow.SELL_BUTTON);

        assertEquals(List.of(Cue.UI_SHOP_OPEN, Cue.HARVEST), cues);
    }

    // A defense picked from the button, then placed on a free cell of the field.
    @Test
    void aDefensePlacedSoundsLikeAPlacement() {
        clickIn(shop.defenseButton());
        clickDefenseLine(2);
        shop.handleCellClick(emptyCell());

        assertEquals(List.of(Cue.UI_SHOP_OPEN, Cue.UI_CLICK, Cue.DEFENSE_PLACE), cues);
    }

    // The urn costs 10 000 coins: with the 250 of the start, the shop refuses it.
    @Test
    void theUrnTooExpensiveIsRefused() {
        clickIn(ShopWindow.URN_BUTTON);

        assertEquals(List.of(Cue.UI_REFUSED), cues);
    }
}
