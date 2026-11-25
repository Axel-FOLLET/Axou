package com.cropa.view;

// The model: a defense, the offers of the shop and the kinds of defense, and the slot a catapatate goes on; the session
// that tells whether it is day (canAct) and gives the shop, the field, the defenses of the field and the urn; a cell of
// the field, the crop on it and the kinds of crop the list offers, and what stands on a cell (Occupant), asked whether
// it can be harvested.
// Java: the offers of the shop (List), Optional for "nothing open" and for "no defense picked yet" without null,
// OptionalInt for "no line chosen yet" and for what a harvest brings.
// CropConfig (day 14): the value of each crop once ripe, shown next to its price in the "Planter" list.
// Texts: the words of the shop and the names of the crops and defenses, in the language of the game.
// Cue and CuePlayer (20/11): the sounds of the shop, and what plays them (the Jukebox in the game, a list in the tests).
import com.cropa.model.defense.Bramble;
import com.cropa.model.defense.SlotSide;
import com.cropa.model.defense.Defense;
import com.cropa.model.defense.DefenseOffer;
import com.cropa.model.defense.DefenseSlot;
import com.cropa.model.defense.DefenseType;
import com.cropa.model.game.GameSession;
import com.cropa.model.world.Cell;
import com.cropa.model.world.Crop;
import com.cropa.model.world.CropConfig;
import com.cropa.model.world.CropType;
import com.cropa.model.world.Occupant;
import com.cropa.text.Texts;
import com.cropa.view.audio.Cue;
import com.cropa.view.audio.CuePlayer;
import java.util.List;
import java.util.Optional;
import java.util.OptionalInt;

// The shop on screen, top right: the "Planter" and "Défenses" buttons, always there, and under them one panel at a time:
// the "Planter" list (the four crops), the "Défenses" list (the bramble only there: it is a defense, asked by Axel on
// day 10), the panel of a defense with "Améliorer" and "Retirer" (the bramble since day 10, the scarecrow and the
// catapatate since day 14, all three for nothing), or the panel of a crop with
// "Vendre": nothing is sold without that second click.
// The "Planter" list opens two ways. From the button: the player picks a line (the others turn grey), then clicks a
// free cell. From an empty cell: the player picks a line, and it is planted on that cell at once.
// The "Défenses" list opens two ways too. From the button: an offer picked waits for a click on a slot or a cell.
// From an empty slot (day 14): the player picks the catapatate, and it is bought on that slot at once; the scarecrow
// and the bramble, which go on the field, are grey there.
// Bottom right, by day: the urn, the goal of the game, a button like the others (white outline), left of the sound
// button of the HUD.
// It also decides what a click on a cell or a slot does (handleCellClick, handleSlotClick), so this order is tested
// without a window.
// Every clickable area has a white outline. No libGDX: it draws through Canvas and receives clicks as world points.
// Each click makes its sound (20/11): a list or a panel that opens, a button or a line picked, a seed planted, a defense
// placed or upgraded, a crop sold, and a refusal when the shop says no (not enough money, a taken place, the night).
/**
 * The shop on screen: the "Planter" button and its list (the four seeds, with their price and their value once ripe),
 * the "Défenses" button and its list (the three defenses, with their price), also opened by an empty slot, the urn by
 * day, the panel of a defense (name, level, durability,
 * and by day "Améliorer" and "Retirer"), and the panel of a crop (name, growth in its color, and by
 * day "Vendre" with its price).
 */
public class ShopWindow {

    //-------------------- CONSTANTS --------------------
    // Top right of the world (560 x 320), on the same line as the HUD on the left. Row 0 holds the two buttons;
    // each next row is ROW_SPACING lower. The y are the tops of the texts.
    private static final float PANEL_X = 400f;
    private static final float FIRST_ROW_TOP = 312f;
    private static final float ROW_SPACING = 24f;
    // The width of the panel: its longest title, "Épouvantail N1 100%", is 138 px wide, plus 3 px on each side. The
    // English texts are shorter (TextsTest checks it).
    private static final float PANEL_WIDTH = 144f;
    // Row 0: the outline of each button is 3 px wider than its words on each side ("Planter" is 46 px wide in the
    // default font, "Défenses" 63 px), and 12 px of gap between the two outlines.
    private static final float BUTTON_GAP = 12f;
    // The urn, at the bottom right of the world: far from the lists, which never reach it. Since 20/11 the sound button
    // of the HUD takes the corner (from x 473 at most), and the urn stands left of it: its outline ends at x 469, 4 px
    // before. "Acheter l'urne" is 89 px wide ("Buy the urn" 74): the outline holds the French words, so it starts at
    // x 374, 26 px right of the dialog frame of the tutorial and of the neighbour (it ends at x 348, on the same line).
    // The price is no longer on the button: the gauge of the HUD shows it.
    private static final float URN_TOP = 24f;
    private static final float URN_RIGHT = 469f;
    private static final float URN_WIDTH = 95f;
    // The lines of the "Planter" list: the four crops, in the order of CropType. Rows 1 to 4.
    private static final int PLANT_LINES = CropType.values().length;
    // The lines of the "Défenses" list: one per kind of defense (GameSession creates one offer per DefenseType). Rows 1 to 3.
    private static final int DEFENSE_LINES = DefenseType.values().length;
    // The rows of the panel of a defense: its title, then "Améliorer", then "Retirer".
    private static final int TITLE_ROW = 1;
    private static final int UPGRADE_ROW = 2;
    private static final int REMOVE_ROW = 3;
    // The rows of the panel of a crop: the same title row, then "Vendre".
    private static final int SELL_ROW = 2;
    // Where a click acts. Public: the tests click in their middle instead of copying numbers. The buttons whose
    // outline fits their words ("Planter", "Défenses", "Améliorer") are fields, sized from the words of the language.
    /** The "Retirer" line of the panel of a defense: removes it for nothing and frees its cell or its slot. */
    public static final Bounds REMOVE_BUTTON = rowBounds(REMOVE_ROW, PANEL_WIDTH);
    /** The "Vendre" line of the panel of a crop: sells it, by day only. */
    public static final Bounds SELL_BUTTON = rowBounds(SELL_ROW, PANEL_WIDTH);
    /** The urn of the shop: buys it, by day only. */
    public static final Bounds URN_BUTTON = new Bounds(URN_RIGHT - URN_WIDTH, URN_TOP - 16, URN_WIDTH, 19);
    // The whole lists, and the whole panel of a defense, under the buttons. A click inside never goes through to the board.
    private static final Bounds LIST_AREA = rowsBounds(1, PLANT_LINES);
    private static final Bounds DEFENSE_LIST_AREA = rowsBounds(1, DEFENSE_LINES);
    private static final Bounds PANEL = rowsBounds(TITLE_ROW, REMOVE_ROW);
    private static final Bounds CROP_PANEL = rowsBounds(TITLE_ROW, SELL_ROW);
    // The price written in the upgrade button when its width is measured: the upgrades cost 100 or 200 (DefenseConfig),
    // three digits, so "Améliorer (100)" is as wide as "Améliorer (200)", 100 px.
    private static final int UPGRADE_PRICE_SAMPLE = 100;

    //-------------------- FIELDS --------------------
    // The words of the shop and the names of the crops and the defenses, in the language of the game.
    private static final int DETAIL_WIDTH = 172, LINE_HEIGHT = 18;
    private static final int STARS = 3, STAR_SIZE = 8, WEAR_WIDTH = 60;
    private final Texts texts;
    // The two buttons of row 0 and the upgrade line, sized once by the constructor from their words.
    private final Bounds plantButton;
    private final Bounds defenseButton;
    private final Bounds upgradeButton;
    // Asked whether it is day, for its shop, for the defenses of the field and for the urn. It never changes: final.
    private final GameSession session;
    // The price of the urn: its button stays grey below it. Given by GameScreen, read in GameConfig: no number of the
    // rules here.
    private final int urnPrice;
    // Plays the sounds of the shop. Given by GameScreen: the shop does not know whether the sound is cut.
    private final CuePlayer cues;
    // The values of the crops, the same object the session plants with (GameConfig.getCropConfig): read only, for the
    // value of a ripe crop in the "Planter" list.
    private final CropConfig crops;
    // What is open. close() empties them all, and each way of opening starts with close(): one panel at a time.
    // The defense opened from its slot (the catapatate).
    private Optional<Defense> selected = Optional.empty();
    // The slot it was opened from (day 14): "Retirer" empties this slot. Empty when the panel was opened by
    // openFor(Defense) alone, without its slot: no "Retirer" then.
    private Optional<DefenseSlot> selectedSlot = Optional.empty();
    // The cell of the field the player clicked: empty, it shows the list; with a scarecrow or a bramble, its panel.
    private Optional<Cell> clickedCell = Optional.empty();
    // true when the list was opened by the "Planter" button.
    private boolean listFromButton;
    // The line picked in the list opened by the button, waiting for a click on a cell. Empty: no line picked yet.
    private OptionalInt chosenLine = OptionalInt.empty();
    // true when the list of the defenses was opened by the "Défenses" button.
    private boolean defenseListShown;
    // The defense picked in that list, waiting for a click on a slot or a cell. Empty: no defense picked yet.
    private Optional<DefenseOffer> pendingOffer = Optional.empty();
    // The empty slot the player clicked (day 14): the "Défenses" list is shown for it, and a catapatate picked there is
    // bought on it at once. Empty: the list, if shown, was opened by the button.
    private Optional<DefenseSlot> clickedSlot = Optional.empty();

    //-------------------- CONSTRUCTOR --------------------
    // Called once by GameScreen.show().
    /**
     * Creates the shop of a game, with every panel closed.
     *
     * @param session the game, asked whether actions are allowed (day) or not (night)
     * @param urnPrice the price of the urn: its button stays grey below it
     * @param crops the values of the crops, for the value of a ripe crop shown in the "Planter" list
     * @param texts the words of the shop, in the language of the game
     * @param cues plays the sounds of the shop
     */
    public ShopWindow(GameSession session, int urnPrice, CropConfig crops, Texts texts, CuePlayer cues) {
        this.session = session;
        this.cues = cues;
        this.urnPrice = urnPrice;
        this.crops = crops;
        this.texts = texts;
        plantButton = rowBounds(0, buttonWidth(texts.plant()));
        float defenseX = PANEL_X + plantButton.width() + BUTTON_GAP;
        defenseButton = rowBounds(defenseX, 0, buttonWidth(texts.defenses()));
        upgradeButton = rowBounds(UPGRADE_ROW, buttonWidth(texts.upgrade(UPGRADE_PRICE_SAMPLE)));
    }

    //-------------------- BUTTONS --------------------
    // Read by the tests, which click in their middle, and by the tutorial.
    /**
     * Returns the "Planter" button: it opens or closes the list of the crops.
     *
     * @return its area, in world pixels
     */
    public Bounds plantButton() {
        return plantButton;
    }

    /**
     * Returns the "Défenses" button: it opens or closes the list of the defenses.
     *
     * @return its area, in world pixels
     */
    public Bounds defenseButton() {
        return defenseButton;
    }

    /**
     * Returns the "Améliorer" line of the panel of a defense: it upgrades it.
     *
     * @return its area, in world pixels
     */
    public Bounds upgradeButton() {
        return upgradeButton;
    }

    //-------------------- OPENING --------------------
    // Called by openSlotPanel when a click finds a defense on a slot. It replaces whatever was open.
    /**
     * Opens the panel of a defense.
     *
     * @param defense the defense to show
     */
    public void openFor(Defense defense) {
        close();
        selected = Optional.of(defense);
    }

    // Called by handleCellClick. Overload: a Cell picks this method, a Defense the one above.
    // Empty, the cell shows the list; with a scarecrow or a bramble, the panel of that defense; with a crop, its panel.
    /**
     * Opens what belongs to a cell of the field: the "Planter" list if it is empty, otherwise the panel of the defense
     * or of the crop that stands on it.
     *
     * @param cell the cell of the field the player clicked
     */
    public void openFor(Cell cell) {
        close();
        clickedCell = Optional.of(cell);
    }

    // Called by the tutorial at each bubble that speaks of a crop, and by the "Planter" button. Unlike the button, it
    // never rolls the list up: called twice, the list stays shown. The same list as from the button: a line picked
    // waits for a cell.
    /**
     * Unrolls the "Planter" list, with no line picked, and closes whatever was open.
     */
    public void showPlantList() {
        close();
        listFromButton = true;
    }

    // Called by the tutorial at the bubble of the catapatate, and by the "Défenses" button. Shown twice, it stays.
    /**
     * Unrolls the "Défenses" list, with no defense picked, and closes whatever was open.
     */
    public void showDefenseList() {
        close();
        defenseListShown = true;
    }

    // Called by GameScreen when a click lands on nothing (no panel, no slot, no cell), and by every way of opening.
    /**
     * Closes the lists and the panel, and forgets the line, the defense or the empty slot picked.
     */
    public void close() {
        selected = Optional.empty();
        selectedSlot = Optional.empty();
        clickedCell = Optional.empty();
        listFromButton = false;
        chosenLine = OptionalInt.empty();
        defenseListShown = false;
        pendingOffer = Optional.empty();
        clickedSlot = Optional.empty();
    }

    /**
     * Tells whether a list or a panel is shown. The buttons themselves are always shown.
     *
     * @return {@code true} if a list is unrolled, or if a defense (not destroyed) or a crop is shown
     */
    public boolean isOpen() {
        return listShown() || defenseListShown || current().isPresent() || currentCrop().isPresent();
    }

    // Read by handleCellClick: with a line picked, a click on a cell plants it instead of opening the cell.
    /**
     * Tells whether a line of the list opened by the button waits for a cell.
     *
     * @return {@code true} if a line is picked
     */
    public boolean hasPendingChoice() {
        return chosenLine.isPresent();
    }

    // Read by the tests, and by highlightedZone: the offer picked in the "Défenses" list, until it is placed.
    /**
     * Returns the defense picked in the "Défenses" list, waiting for a slot or a cell.
     *
     * @return the offer picked, or an empty {@code Optional} if none is picked
     */
    public Optional<DefenseOffer> getPendingOffer() {
        return pendingOffer;
    }

    // Read by GameScreen on every frame: the cells this defense reaches are veiled in white
    // (OutlineRenderer.renderRange). The same defense as the panel: by day and by night, since the panel can be read
    // at night too.
    /**
     * Returns the defense whose panel is open.
     *
     * @return the defense shown, or an empty {@code Optional} if no defense panel is open
     */
    public Optional<Defense> shownDefense() {
        return current();
    }

    // Public and static: the test clicks in the middle of a line, the same way it does on upgradeButton().
    // Line 0 (the carrot) is on row 1, right under the "Planter" button.
    /**
     * Returns the clickable area of a line of the "Planter" list.
     *
     * @param line the line: 0 carrot, 1 turnip, 2 garlic, 3 pumpkin
     * @return its area, in world pixels
     */
    public static Bounds plantLine(int line) {
        return rowBounds(line + 1, PANEL_WIDTH);
    }

    // The same rows as the "Planter" list: the two lists are never shown together.
    /**
     * Returns the clickable area of a line of the "Défenses" list.
     *
     * @param line the line: 0 catapatate, 1 scarecrow, 2 bramble (the order of DefenseType)
     * @return its area, in world pixels
     */
    public static Bounds defenseLine(int line) {
        return rowBounds(line + 1, PANEL_WIDTH);
    }

    //-------------------- FREE PLACES --------------------
    // Read by GameScreen on every frame: the zone whose free places it draws in white, so the player sees where to click.
    // The field while the "Planter" list is unrolled, or a defense or a crop of the field is shown; the slots while a
    // catapatate is shown. The "Défenses" list: the slots when an empty slot opened it (like the field for the "Planter"
    // list of an empty cell); from the button, where the picked offer goes, nothing before a pick.
    // Nothing at night: nothing can be bought nor upgraded then.
    /**
     * Tells which zone the player is working on, if any.
     *
     * @return {@link Zone#FIELD} or {@link Zone#SLOTS}, or an empty {@code Optional} when nothing is open or at night
     */
    public Optional<Zone> highlightedZone() {
        if (!session.getCycle().canAct()) {
            return Optional.empty();
        }
        if (defenseListShown && clickedSlot.isPresent()) {
            return Optional.of(Zone.SLOTS);
        }
        if (defenseListShown) {
            return pendingOffer.map(offer -> offer.isPlacedOnField() ? Zone.FIELD : Zone.SLOTS);
        }
        if (listShown() || fieldDefense().isPresent() || currentCrop().isPresent()) {
            return Optional.of(Zone.FIELD);
        }
        if (slotDefense().isPresent()) {
            return Optional.of(Zone.SLOTS);
        }
        return Optional.empty();
    }

    //-------------------- CLICKS --------------------
    // Called by GameScreen before any search on the board. true: the click is used here, the board ignores it.
    // The buttons first: each one rolls its list up or down. Then the urn, by day: the session pays it and wins.
    // Then the list shown, if any. Then the panel of a crop: "Vendre", sold by the shop. Then the panel of a defense:
    // "Améliorer", paid by the shop; "Retirer", for 0 coins (remove). Elsewhere in a panel, nothing, but the click is
    // kept.
    // Outside: everything closes, and false lets GameScreen look at the board under the click.
    /**
     * Handles a click, in world pixels.
     *
     * @param x the x of the click
     * @param y the y of the click
     * @return {@code true} if the click landed on a button, the urn, a list or a panel
     */
    public boolean handleClick(float x, float y) {
        if (plantButton.contains(x, y)) {
            toggleList();
            return true;
        }
        if (defenseButton.contains(x, y)) {
            toggleDefenseList();
            return true;
        }
        if (session.getCycle().canAct() && URN_BUTTON.contains(x, y)) {
            if (!session.buyUrn()) {
                cues.play(Cue.UI_REFUSED);
            }
            return true;
        }
        if (listShown()) {
            return handleListClick(x, y);
        }
        if (defenseListShown) {
            return handleDefenseListClick(x, y);
        }
        if (currentCrop().isPresent()) {
            return handleCropClick(x, y);
        }
        Optional<Defense> defense = current();
        if (defense.isEmpty()) {
            close();
            return false;
        }
        if (showsUpgrade(defense.get()) && upgradeButton.contains(x, y)) {
            confirm(session.getShop().upgrade(defense.get()), Cue.DEFENSE_UPGRADE);
            return true;
        }
        if (showsRemove() && REMOVE_BUTTON.contains(x, y)) {
            remove();
            close();
            cues.play(Cue.UI_CLICK);
            return true;
        }
        if (PANEL.contains(x, y)) {
            return true;
        }
        close();
        return false;
    }

    // Called by GameScreen when a click lands on a slot, once the panel gave nothing.
    // A defense picked first: the shop places it on this slot; a placement refused (scarecrow, bramble, taken slot,
    // not enough money) costs nothing and keeps the defense picked (asked by Axel on day 9). Otherwise the slot opens
    // the panel of its defense, and an empty slot the "Défenses" list, for this slot (asked by Axel on day 14, the
    // same way an empty cell opens the "Planter" list).
    /**
     * Handles a click on a slot around the field.
     *
     * @param slot the slot under the click
     */
    public void handleSlotClick(DefenseSlot slot) {
        if (pendingOffer.isPresent()) {
            if (confirm(session.getCycle().canAct() && session.getShop().buyDefense(pendingOffer.get(), slot),
                    Cue.DEFENSE_PLACE)) {
                close();
            }
            return;
        }
        slot.getDefense().ifPresentOrElse(defense -> openSlotPanel(slot, defense), () -> openDefenseListFor(slot));
        cues.play(Cue.UI_SHOP_OPEN);
    }

    // The panel of the defense, then the slot it stands on is remembered, for "Retirer" (day 14). openFor first: it
    // closes everything, the slot too, so the slot is kept after it.
    private void openSlotPanel(DefenseSlot slot, Defense defense) {
        openFor(defense);
        selectedSlot = Optional.of(slot);
    }

    // close() first, like every way of opening: one panel at a time. Then the list, remembering the slot.
    private void openDefenseListFor(DefenseSlot slot) {
        close();
        clickedSlot = Optional.of(slot);
        defenseListShown = true;
    }

    // Called by GameScreen when a click lands on a cell of the field, once the panel and the slots gave nothing.
    // The order: a defense picked first, placed on this cell (refused for the catapatate); then a line picked from the
    // button, planted on this cell; otherwise the cell opens what belongs to it: the list if it is empty, the panel of
    // its defense or of its crop. A crop is never sold by this click: its panel asks for a second click on "Vendre"
    // (asked by Axel on day 9).
    // A refused placement or planting (occupied cell, not enough money) keeps the choice: the player can click elsewhere.
    /**
     * Handles a click on a cell of the field.
     *
     * @param cell the cell under the click
     */
    public void handleCellClick(Cell cell) {
        if (pendingOffer.isPresent()) {
            if (confirm(session.getCycle().canAct() && session.getShop().buyDefense(pendingOffer.get(), cell),
                    Cue.DEFENSE_PLACE)) {
                close();
            }
            return;
        }
        if (hasPendingChoice()) {
            if (confirm(session.getCycle().canAct() && buy(chosenLine.getAsInt(), cell), Cue.PLANT)) {
                close();
            }
            return;
        }
        openFor(cell);
        cues.play(Cue.UI_SHOP_OPEN);
    }

    // The panel of a crop: "Vendre", by day only, sells it through the shop and closes the panel. Elsewhere in the
    // panel, kept; outside, the panel closes and false lets GameScreen look at the board (a click elsewhere cancels).
    private boolean handleCropClick(float x, float y) {
        if (session.getCycle().canAct() && SELL_BUTTON.contains(x, y)) {
            clickedCell.ifPresent(cell -> confirm(session.getShop().sell(cell), Cue.HARVEST));
            close();
            return true;
        }
        if (CROP_PANEL.contains(x, y)) {
            return true;
        }
        close();
        return false;
    }

    // The button: a shown list rolls up; otherwise the list unrolls, with no line picked, and whatever was open closes.
    // The sound here, not in showPlantList: the tutorial also unrolls the list, without a click of the player.
    private void toggleList() {
        if (listShown()) {
            close();
            cues.play(Cue.UI_CLICK);
        } else {
            showPlantList();
            cues.play(Cue.UI_SHOP_OPEN);
        }
    }

    // The same for the "Défenses" button: showDefenseList also rolls the "Planter" list up and forgets its line.
    private void toggleDefenseList() {
        if (defenseListShown) {
            close();
            cues.play(Cue.UI_CLICK);
        } else {
            showDefenseList();
            cues.play(Cue.UI_SHOP_OPEN);
        }
    }

    // Outside the list: with a line picked, nothing changes and false lets the click reach a cell (to plant there);
    // without one, the list rolls up. Inside: kept (true), even between two lines. At night, nothing is picked,
    // and a line the player cannot pay is not picked either (it is grey).
    private boolean handleListClick(float x, float y) {
        if (!LIST_AREA.contains(x, y)) {
            if (!hasPendingChoice()) {
                close();
            }
            return false;
        }
        if (!session.getCycle().canAct()) {
            return true;
        }
        for (int line = 0; line < PLANT_LINES; line++) {
            if (plantLine(line).contains(x, y)) {
                if (canAfford(plantPrice(line))) {
                    pickLine(line);
                } else {
                    cues.play(Cue.UI_REFUSED);
                }
            }
        }
        return true;
    }

    // The same rules for the "Défenses" list: outside, a defense picked lets the click reach a slot or a cell; without
    // one, the list rolls up (and false lets the click reach another empty slot, which opens the list for it).
    // Inside, by day, a click on a line the player can buy picks its offer, or changes the one picked; when an empty
    // slot opened the list, it is bought on that slot at once instead (pickOffer).
    private boolean handleDefenseListClick(float x, float y) {
        if (!DEFENSE_LIST_AREA.contains(x, y)) {
            if (pendingOffer.isEmpty()) {
                close();
            }
            return false;
        }
        if (!session.getCycle().canAct()) {
            return true;
        }
        List<DefenseOffer> offers = session.getShop().getDefenseOffers();
        for (int line = 0; line < offers.size(); line++) {
            if (defenseLine(line).contains(x, y)) {
                if (canBuyHere(offers.get(line))) {
                    pickOffer(offers.get(line));
                } else {
                    cues.play(Cue.UI_REFUSED);
                }
            }
        }
        return true;
    }

    // From the button: the offer is only picked, the slot or the cell comes next. From an empty slot: it is bought on
    // that slot at once, and the list rolls up once it is placed; a refusal (not enough money) costs nothing.
    private void pickOffer(DefenseOffer offer) {
        if (clickedSlot.isEmpty()) {
            pendingOffer = Optional.of(offer);
            cues.play(Cue.UI_CLICK);
            return;
        }
        if (confirm(session.getShop().buyDefense(offer, clickedSlot.get()), Cue.DEFENSE_PLACE)) {
            close();
        }
    }

    // A line can be bought when the player has its price, and, when an empty slot opened the list, when it goes on a
    // slot: the scarecrow and the bramble go on the field (isPlacedOnField), so they are grey there.
    private boolean canBuyHere(DefenseOffer offer) {
        boolean fitsTheSlot = clickedSlot.isEmpty() || !offer.isPlacedOnField();
        return fitsTheSlot && canAfford(offer.getPrice());
    }

    // From the button: the line is only picked, the cell comes next. From an empty cell: it is bought on that cell at once,
    // and the list rolls up once it is planted.
    private void pickLine(int line) {
        if (listFromButton) {
            chosenLine = OptionalInt.of(line);
            cues.play(Cue.UI_CLICK);
            return;
        }
        Optional<Cell> cell = plantCell();
        if (cell.isPresent() && confirm(buy(line, cell.get()), Cue.PLANT)) {
            close();
        }
    }

    // The seed of the line, bought by the shop, which checks the money and the cell: a refusal costs nothing.
    private boolean buy(int line, Cell cell) {
        return session.getShop().buySeed(CropType.values()[line], cell);
    }

    // The sound of an answer of the shop: the sound of what was done, or the refusal. Returns the answer, so the caller
    // still decides what closes.
    private boolean confirm(boolean done, Cue sound) {
        cues.play(done ? sound : Cue.UI_REFUSED);
        return done;
    }

    //-------------------- DRAWING --------------------
    // Called on every frame by GameScreen, after the HUD. The two buttons always, with their white outline: they work
    // by day and by night. The urn by day only: it cannot be bought at night. Its white outline is always there, like
    // the other buttons (asked by Axel on day 10: without it, nothing said it was a button); its text stays grey until
    // the player has its price, and a click before buys nothing (GameSession.buyUrn refuses it).
    // Then the list, or the panel of a crop or of a defense, if one is open (one at a time: each opening closes the
    // others).
    /**
     * Draws the "Planter" and "Défenses" buttons, the urn by day, and the list or the panel open, if any.
     *
     * @param canvas where to draw
     */
    public void render(Canvas canvas) {
        render(canvas, Pointer.AWAY);
    }

    /** Draws the stall first so the awning never obscures the menu buttons. */
    public void render(Canvas canvas, Pointer pointer) {
        if (isOpen()) {
            Bounds area = PANEL;
            if (listShown()) area = LIST_AREA;
            else if (defenseListShown) area = DEFENSE_LIST_AREA;
            else if (currentCrop().isPresent()) area = CROP_PANEL;
            Bounds stall = DialogFrame.around(area);
            if (area == CROP_PANEL) {
                // Keep the awning and side borders in place, with the base flush with the sell row.
                stall = new Bounds(stall.x(), area.y(), stall.width(), stall.height() - DialogFrame.BORDER);
            }
            canvas.drawFrame(SpriteCatalog.STALL_FRAME, stall, Tint.NORMAL);
            canvas.drawSprite("stall_awning", new Bounds(stall.x(), area.y() + area.height(), stall.width(), 16));
            if (area == PANEL || area == CROP_PANEL) canvas.drawFrame(SpriteCatalog.PANEL_FRAME, area, Tint.NORMAL);
        }
        pointer.button(canvas, plantButton, texts.plant(), TextStyle.NORMAL);
        pointer.button(canvas, defenseButton, texts.defenses(), TextStyle.NORMAL);
        if (session.getCycle().canAct()) {
            TextStyle style = canAfford(urnPrice) ? TextStyle.NORMAL : TextStyle.GREYED;
            pointer.button(canvas, URN_BUTTON, texts.urnOffer(), style);
        }
        if (listShown()) {
            drawList(canvas, pointer);
        }
        if (defenseListShown) {
            drawDefenseList(canvas, pointer);
        }
        currentCrop().ifPresent(crop -> drawCrop(canvas, crop, pointer));
        current().ifPresent(defense -> drawDefense(canvas, defense, pointer));
    }

    // One line per crop, in the order of CropType: the order of the rules (section 5).
    // By day, a white outline marks each line the player can pay as clickable; at night, no outline and every line
    // grey. A line too expensive is grey too, without outline (asked by Axel on day 9).
    private void drawList(Canvas canvas, Pointer pointer) {
        boolean canBuy = session.getCycle().canAct();
        for (int line = 0; line < PLANT_LINES; line++) {
            boolean affordable = canAfford(plantPrice(line));
            CropType type = CropType.values()[line];
            card(canvas, pointer, plantLine(line), plantLabel(line), styleOf(line, canBuy && affordable));
            if (pointer.over(plantLine(line))) {
                detail(canvas, type.name(), texts.name(type), plantPrice(line), texts.effect(type),
                        styleOf(line, canBuy && affordable));
            }
        }
    }

    // One line per offer of the shop, in the order of DefenseType: "Catapatate (150)", the price read in the offer.
    // Grey at night, grey when too expensive or, from an empty slot, when it goes on the field (canBuyHere), and grey
    // for every offer but the picked one: != compares the objects, the shop has one per kind. The outline only on the
    // offers the player can buy now.
    private void drawDefenseList(Canvas canvas, Pointer pointer) {
        List<DefenseOffer> offers = session.getShop().getDefenseOffers();
        for (int line = 0; line < offers.size(); line++) {
            DefenseOffer offer = offers.get(line);
            boolean canBuy = session.getCycle().canAct() && canBuyHere(offer);
            boolean notThePickedOne = pendingOffer.isPresent() && pendingOffer.get() != offer;
            TextStyle style = !canBuy || notThePickedOne ? TextStyle.GREYED : TextStyle.NORMAL;
            String label = texts.name(offer.getType()) + " (" + offer.getPrice() + ")";
            String type = offer.getType().name();
            Bounds area = defenseLine(line);
            card(canvas, pointer, area, label, style);
            if (pointer.over(area)) {
                detail(canvas, type, texts.name(offer.getType()), offer.getPrice(), texts.effect(offer.getType()), style);
            }
        }
    }

    private static void card(Canvas canvas, Pointer pointer, Bounds area, String label, TextStyle style) {
        canvas.drawFrame(pointer.frame("card", area, style == TextStyle.GREYED), area, Tint.NORMAL);
        canvas.drawPlainText(label, area.x() + 3, area.y() + 16, style);
    }

    private static String icon(String type) {
        return "icon_" + type.toLowerCase(java.util.Locale.ROOT);
    }

    /** Keep the detail panel clear of the stall. */
    private static void detail(Canvas canvas, String type, String name, int price, List<String> effect, TextStyle style) {
        float top = rowTop(UPGRADE_ROW);
        float height = 32 + LINE_HEIGHT * effect.size();
        float x = LIST_AREA.x() - 16 - DETAIL_WIDTH;
        canvas.drawFrame(SpriteCatalog.PANEL_FRAME, new Bounds(x, top - height, DETAIL_WIDTH, height), Tint.NORMAL);
        canvas.drawSprite(icon(type), new Bounds(x + 6, top - 25, 20, 20));
        canvas.drawPlainText(name + " (" + price + ")", x + 30, top - 7, style);
        for (int i = 0; i < effect.size(); i++) {
            canvas.drawPlainText(effect.get(i), x + 6, top - 28 - LINE_HEIGHT * i, style);
        }
    }

    // "Carotte, graine" in red, "Carotte, en pousse" in orange, "Carotte, mûre" in green (Growth, asked by Axel on
    // day 10: the same colors as the dot on the field). The whole line takes the color: the view cannot measure where
    // the word starts, only GdxCanvas knows the font.
    // Then by day "Vendre (40)": the price is what the shop will pay, the value of its current stage. At night, no
    // button: the panel can still be read.
    private void drawCrop(Canvas canvas, Crop crop, Pointer pointer) {
        Growth growth = Growth.of(crop);
        String title = texts.name(crop.getType()) + ", " + growth.label(texts);
        canvas.drawPlainText(title, PANEL_X, rowTop(TITLE_ROW), growth.getStyle());
        if (session.getCycle().canAct()) {
            pointer.button(canvas, SELL_BUTTON, texts.sell(crop.getValue()), TextStyle.NORMAL);
        }
    }

    // Grey when it cannot be bought now (night, or too expensive), and grey for every line but the picked one once a
    // line is picked: the player sees his choice, and that another click on a grey line changes it.
    private TextStyle styleOf(int line, boolean canBuy) {
        boolean notThePickedOne = chosenLine.isPresent() && chosenLine.getAsInt() != line;
        return !canBuy || notThePickedOne ? TextStyle.GREYED : TextStyle.NORMAL;
    }

    // "Carotte 10 -> 40" (asked by Axel on day 14): the price of the seed read in the shop, then the value of the crop
    // once ripe, its last stage, read in CropConfig; never written here. "->" and not an arrow: the default font of
    // libGDX has no arrow character, it would draw nothing. "Citrouille 50 -> 1000", the longest line, is 130 px wide:
    // the width of the panel holds it.
    private String plantLabel(int line) {
        CropType type = CropType.values()[line];
        int ripeValue = crops.getValue(type, crops.getStageCount(type) - 1);
        return texts.name(type) + " " + plantPrice(line) + " -> " + ripeValue;
    }

    // The price of a line of the "Planter" list: the seed of its crop.
    private int plantPrice(int line) {
        return session.getShop().getSeedPrice(CropType.values()[line]);
    }

    // The title, then the second row: "Niveau max" at level 3, the button by day, nothing at night.
    // canUpgrade is checked before getUpgradePrice: at level 3, there is no price and DefenseConfig would throw.
    // Too expensive: the button is grey, without outline; a click on it is refused by the shop, which charges nothing.
    // Third row, "Retirer", by day (showsRemove): the bramble (asked by Axel on day 10: it is not harvested, it is
    // removed, for nothing), the scarecrow and the catapatate opened from its slot (day 14, for nothing too).
    // The white outlines mark the clickable areas.
    private void drawDefense(Canvas canvas, Defense defense, Pointer pointer) {
        int level = defense.getLevel();
        String title = texts.name(defense.getType()) + " " + texts.level(level);
        float top = rowTop(TITLE_ROW);
        canvas.drawPlainText(title, PANEL_X, top, TextStyle.NORMAL);
        for (int i = 0; i < STARS; i++) {
            float x = PANEL.x() + PANEL.width() - 3 - (STARS - i) * STAR_SIZE;
            canvas.drawSprite(i < level ? "star_full" : "star_empty", new Bounds(x, top - STAR_SIZE, STAR_SIZE, STAR_SIZE));
        }
        float y = top - 19;
        int wear = defense.getDurability();
        canvas.drawSprite("wearbar_back", new Bounds(PANEL_X, y, WEAR_WIDTH, 5));
        if (wear > 0) canvas.drawSprite("wearbar_fill_" + DefenseRenderer.wear(wear),
                new Bounds(PANEL_X, y + 1, WEAR_WIDTH * wear / 100f, 3));
        if (!defense.canUpgrade()) {
            canvas.drawPlainText(texts.maxLevel(), PANEL_X, rowTop(UPGRADE_ROW), TextStyle.NORMAL);
        } else if (showsUpgrade(defense)) {
            boolean affordable = canAfford(defense.getUpgradePrice());
            TextStyle style = affordable ? TextStyle.NORMAL : TextStyle.GREYED;
            pointer.button(canvas, upgradeButton, texts.upgrade(defense.getUpgradePrice()), style);
            String base = switch (defense.getType()) {
                case CATAPATATE -> selectedSlot.map(slot -> slot.getSide() == SlotSide.BOTTOM)
                        .orElse(false) ? SpriteCatalog.CATAPATATE_BOTTOM : SpriteCatalog.CATAPATATE_TOP;
                case SCARECROW -> "scarecrow";
                case BRAMBLE -> ((Bramble) defense).spriteKey();
            };
            float x = PANEL.x() + PANEL.width() - 25;
            float yPreview = rowTop(UPGRADE_ROW) - 12;
            canvas.drawSprite("upgrade_arrow", new Bounds(x, yPreview + 2, 8, 8));
            canvas.drawSprite(base + DefenseRenderer.material(level + 1), new Bounds(x + 9, yPreview, 12, 12));
        }
        if (showsRemove()) {
            pointer.button(canvas, REMOVE_BUTTON, texts.remove(), TextStyle.NORMAL);
        }
    }

    //-------------------- INTERNALS --------------------
    // The list is shown when the button opened it, or when the clicked cell is still empty.
    private boolean listShown() {
        return listFromButton || plantCell().isPresent();
    }

    // filter: a cell planted since it was clicked is no longer empty, so it no longer shows the list.
    private Optional<Cell> plantCell() {
        return clickedCell.filter(Cell::isEmpty);
    }

    // filter: a destroyed defense has left its slot, so it counts as no panel at all.
    private Optional<Defense> slotDefense() {
        return selected.filter(defense -> !defense.isDestroyed());
    }

    // The scarecrow or the bramble of the clicked cell. getDefenseOn forgets it once the cell is freed.
    private Optional<Defense> fieldDefense() {
        return clickedCell.flatMap(cell -> session.getDefenseSlots().getDefenseOn(cell))
                .filter(defense -> !defense.isDestroyed());
    }

    // The defense whose panel is shown: the one of a slot, or else the one of the clicked cell.
    private Optional<Defense> current() {
        return slotDefense().or(this::fieldDefense);
    }

    // The crop of the clicked cell, without instanceof: Board.getCrops gives the crops of the field, and the one kept
    // is the very object standing on the cell (==, like DefenseSlots.purgeField). A defense or an empty cell gives none.
    private Optional<Crop> currentCrop() {
        return clickedCell.flatMap(Cell::getOccupant)
                .flatMap(occupant -> session.getBoard().getCrops().stream()
                        .filter(crop -> crop == occupant)
                        .findFirst());
    }

    // Asked to the wallet without spending: canAfford only compares the price with the balance.
    private boolean canAfford(int price) {
        return session.getWallet().canAfford(price);
    }

    // The button needs a next level and the day (canAct is false at night).
    private boolean showsUpgrade(Defense defense) {
        return defense.canUpgrade() && session.getCycle().canAct();
    }

    // By day only, like any sale. On a slot: the catapatate, opened from its slot (day 14). On a cell: the same
    // expression as Shop.sell; without orElse, the Optional would be present as soon as the cell is occupied. The
    // bramble and the scarecrow (day 14) answer OptionalInt.of(0), a crop its value: a crop shows its own panel
    // ("Vendre"), never this one.
    private boolean showsRemove() {
        if (!session.getCycle().canAct()) {
            return false;
        }
        if (slotDefense().isPresent()) {
            return selectedSlot.isPresent();
        }
        return clickedCell.flatMap(Cell::getOccupant)
                .map(Occupant::onHarvested)
                .orElse(OptionalInt.empty())
                .isPresent();
    }

    // "Retirer", for nothing (asked by Axel on day 14, like the bramble on day 10). The catapatate leaves its slot:
    // DefenseSlot.remove empties it, no coin comes back. A defense of the field goes through Shop.sell, which adds the
    // 0 of onHarvested and empties the cell.
    private void remove() {
        if (slotDefense().isPresent()) {
            selectedSlot.ifPresent(DefenseSlot::remove);
            return;
        }
        clickedCell.ifPresent(cell -> session.getShop().sell(cell));
    }

    // The top of the text of a row. Static: the constants above use it.
    private static float rowTop(int row) {
        return FIRST_ROW_TOP - ROW_SPACING * row;
    }

    // The outline of a button: its words, plus 3 px on each side.
    private static float buttonWidth(String words) {
        return TextWidth.of(words) + 6;
    }

    // One row, clickable: its bubble goes from 16 px under the top of its text to 3 px above it, and starts 3 px
    // before the text. Overload: without x, the row starts at the left of the panel.
    private static Bounds rowBounds(int row, float width) {
        return rowBounds(PANEL_X, row, width);
    }

    private static Bounds rowBounds(float textX, int row, float width) {
        return new Bounds(textX - 3, rowTop(row) - 16, width, 19);
    }

    // Several rows at once, from the bottom of the last one to the top of the first one.
    private static Bounds rowsBounds(int firstRow, int lastRow) {
        float bottom = rowTop(lastRow) - 16;
        return new Bounds(PANEL_X - 3, bottom, PANEL_WIDTH, rowTop(firstRow) + 3 - bottom);
    }
}
