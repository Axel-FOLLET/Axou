package com.cropa.model.economy;

// JUnit: assertion helpers and the @Test marker.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

// The defenses on sale: a defense, the offers, their numbers, and the slots they go on.
import com.cropa.model.defense.Defense;
import com.cropa.model.defense.DefenseConfig;
import com.cropa.model.defense.DefenseOffer;
import com.cropa.model.defense.DefenseSlot;
import com.cropa.model.defense.DefenseSlots;
import com.cropa.model.defense.DefenseType;
import com.cropa.model.defense.SlotSide;
// GameConfig: the third parameter of the shop, the balancing numbers of the game.
import com.cropa.model.game.GameConfig;
// The field: a cell, what can sit on it, and the crops with their numbers.
import com.cropa.model.world.Cell;
import com.cropa.model.world.Crop;
import com.cropa.model.world.CropConfig;
import com.cropa.model.world.CropType;
import com.cropa.model.world.Damageable;
import com.cropa.model.world.Occupant;
// ArrayList: the (empty) enemies of the offers. List: the offers given to the shop.
// Optional: what Cell.getOccupant() returns. OptionalInt: what onHarvested returns.
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.OptionalInt;
import org.junit.jupiter.api.Test;

/**
 * Tests for {@link Shop}: the immediate sale, at the value of the stage reached, the purchase
 * of a seed, a defense or the urn, and the upgrade of a defense. Every test starts with a wallet
 * of 200 coins, unless it says otherwise.
 */
class ShopTest {

  // -------------------- FIELDS --------------------
  // The fields are created in this order: the slots first, because the offers need them.
  // The three offers of the rules, built like GameSession builds them, with no enemy.
  private final DefenseSlots slots = new DefenseSlots();
  private final DefenseOffer catapatate = offerOf(DefenseType.CATAPATATE);
  private final DefenseOffer scarecrow = offerOf(DefenseType.SCARECROW);
  private final DefenseOffer bramble = offerOf(DefenseType.BRAMBLE);

  // A fresh wallet and shop for each test, with 200 coins (the starting money of the rules before day 10).
  private final Wallet wallet = new Wallet(200);
  private final Shop shop = shopWith(wallet);

  // -------------------- HELPERS --------------------
  // An offer of the given defense, which places it among the slots of the test.
  /** Returns a new offer of the given defense, with no enemy. */
  private DefenseOffer offerOf(DefenseType type) {
    return new DefenseOffer(type, new DefenseConfig(), new ArrayList<>(), slots);
  }

  // A shop built like GameSession builds it, around the given wallet, with the three offers.
  /** Returns a new shop that spends from and pays into the given wallet. */
  private Shop shopWith(Wallet wallet) {
    return new Shop(wallet, new CropConfig(), new GameConfig(), List.of(catapatate, scarecrow, bramble));
  }

  // An occupant that does not override onHarvested, like a scarecrow: it cannot be sold.
  /** An occupant that keeps the default onHarvested, which is empty. */
  private static class UnsellableOccupant implements Occupant {
    @Override
    public boolean onCrossedBy(Damageable crosser) {
      return false;
    }

    @Override
    public boolean onBittenByMole() {
      return false;
    }

    @Override
    public String spriteKey() {
      return "unsellable";
    }
  }

  // An occupant harvested for nothing, like the future bramble: it leaves the cell, no money comes in.
  /** An occupant whose harvest brings 0. */
  private static class FreeOccupant extends UnsellableOccupant {
    @Override
    public OptionalInt onHarvested() {
      return OptionalInt.of(0);
    }
  }

  // A catapatate placed for free by its offer, as if bought earlier. Typed Defense: no concrete defense here.
  /** Returns a new catapatate, placed on the slot TOP 1, at level 1 and 100 %. */
  private Defense placedCatapatate() {
    DefenseSlot slot = slots.getSlot(SlotSide.TOP, 1);
    catapatate.placeOn(slot);
    return slot.getDefense().orElseThrow();
  }

  // Puts the occupant on a new cell, as the player would have planted or built it.
  /** Returns a new cell holding the given occupant. */
  private Cell cellWith(Occupant occupant) {
    Cell cell = new Cell(1, 1);
    cell.place(occupant);
    return cell;
  }

  // Grows a crop the given number of nights, as the dawns would.
  /** Returns a crop of the given type, grown the given number of times. */
  private Crop cropGrown(CropType type, int nights) {
    Crop crop = new Crop(type, new CropConfig());
    for (int night = 0; night < nights; night++) {
      crop.grow();
    }
    return crop;
  }

  // -------------------- CROPS --------------------
  // The immediate sale: a carrot sold right after planting is worth the value of stage 0.
  /** A new carrot sells for 5 and leaves its cell. */
  @Test
  void newCarrotSellsForFive() {
    Cell cell = cellWith(cropGrown(CropType.CARROT, 0));

    assertTrue(shop.sell(cell));
    assertEquals(205, wallet.getBalance());
    assertTrue(cell.isEmpty());
  }

  // After one night the carrot is mature: worth 40.
  /** A mature carrot sells for 40. */
  @Test
  void matureCarrotSellsForForty() {
    Cell cell = cellWith(cropGrown(CropType.CARROT, 1));

    assertTrue(shop.sell(cell));
    assertEquals(240, wallet.getBalance());
  }

  // The pumpkin needs three nights to be worth 1 000 (section 10 of the rules; 700 before day 9, 800 before day 10).
  /** A mature pumpkin sells for 1 000. */
  @Test
  void maturePumpkinSellsForOneThousand() {
    Cell cell = cellWith(cropGrown(CropType.PUMPKIN, 3));

    assertTrue(shop.sell(cell));
    assertEquals(1200, wallet.getBalance());
  }

  // -------------------- NOTHING TO SELL --------------------
  // Without this test, selling an empty cell could throw or add money.
  /** An empty cell sells nothing and the balance does not move. */
  @Test
  void emptyCellSellsNothing() {
    Cell cell = new Cell(1, 1);

    assertFalse(shop.sell(cell));
    assertEquals(200, wallet.getBalance());
  }

  // The shop asks the occupant, without instanceof: an empty answer means it cannot be sold and stays.
  /** An occupant that cannot be harvested stays on its cell, and no money comes in. */
  @Test
  void unsellableOccupantStays() {
    Occupant occupant = new UnsellableOccupant();
    Cell cell = cellWith(occupant);

    assertFalse(shop.sell(cell));
    assertEquals(200, wallet.getBalance());
    assertEquals(Optional.of(occupant), cell.getOccupant());
  }

  // OptionalInt.of(0) is not empty: the occupant is harvested and leaves, for no money.
  /** An occupant harvested for 0 leaves its cell, and the balance does not move. */
  @Test
  void freeHarvestEmptiesTheCell() {
    Cell cell = cellWith(new FreeOccupant());

    assertTrue(shop.sell(cell));
    assertEquals(200, wallet.getBalance());
    assertTrue(cell.isEmpty());
  }

  // -------------------- SEEDS --------------------
  // The shop shows the price of each seed: it reads it in CropConfig, it does not keep a copy.
  /** The seed prices come from CropConfig: 10 for a carrot, 50 for a pumpkin. */
  @Test
  void seedPricesComeFromTheCropConfig() {
    assertEquals(10, shop.getSeedPrice(CropType.CARROT));
    assertEquals(50, shop.getSeedPrice(CropType.PUMPKIN));
  }

  // A seed is paid and planted at once (sections 5 and 11 of the rules): no inventory.
  /** A carrot bought on an empty cell costs 10 and is planted right away. */
  @Test
  void carrotSeedIsPaidAndPlanted() {
    Cell cell = new Cell(1, 1);

    assertTrue(shop.buySeed(CropType.CARROT, cell));
    assertEquals(190, wallet.getBalance());
    assertFalse(cell.isEmpty());
  }

  // The planted crop is a new one of the bought type, at stage 0.
  /** The crop planted by buySeed is of the bought type, at stage 0. */
  @Test
  void boughtSeedIsANewCropOfThatType() {
    Cell cell = new Cell(1, 1);

    shop.buySeed(CropType.PUMPKIN, cell);

    Crop crop = (Crop) cell.getOccupant().orElseThrow();
    assertEquals(CropType.PUMPKIN, crop.getType());
    assertEquals(0, crop.getStage());
  }

  // The cell is checked first: a seed that cannot be planted is never paid.
  /** A seed bought on an occupied cell is refused, and nothing is paid. */
  @Test
  void occupiedCellRefusesTheSeed() {
    Occupant occupant = new UnsellableOccupant();
    Cell cell = cellWith(occupant);

    assertFalse(shop.buySeed(CropType.CARROT, cell));
    assertEquals(200, wallet.getBalance());
    assertEquals(Optional.of(occupant), cell.getOccupant());
  }

  // Not enough money: spend refuses, so nothing is planted and the balance does not move.
  /** A pumpkin seed (50) with 40 coins is refused, and the cell stays empty. */
  @Test
  void seedTooExpensiveIsRefused() {
    Wallet poorWallet = new Wallet(40);
    Shop poorShop = shopWith(poorWallet);
    Cell cell = new Cell(1, 1);

    assertFalse(poorShop.buySeed(CropType.PUMPKIN, cell));
    assertEquals(40, poorWallet.getBalance());
    assertTrue(cell.isEmpty());
  }

  // -------------------- DEFENSES --------------------
  // The shop does not build its offers: it receives them (injection) and gives them to the view.
  /** The shop gives back the three offers it received, in the same order. */
  @Test
  void shopGivesItsThreeOffers() {
    assertEquals(List.of(catapatate, scarecrow, bramble), shop.getDefenseOffers());
  }

  // A catapatate goes on a slot around the field: 150 coins, placed at once (section 5 of the rules).
  /** A catapatate bought on a free slot costs 150 and is placed right away. */
  @Test
  void catapatateOnAFreeSlotIsPaidAndPlaced() {
    DefenseSlot slot = slots.getSlot(SlotSide.TOP, 1);

    assertTrue(shop.buyDefense(catapatate, slot));
    assertEquals(50, wallet.getBalance());
    assertFalse(slot.isEmpty());
  }

  // The offer refuses: a catapatate never goes on the field. The refused placement costs nothing.
  /** A catapatate bought on a cell of the field is refused, and nothing is paid. */
  @Test
  void catapatateOnACellIsRefused() {
    Cell cell = new Cell(2, 3);

    assertFalse(shop.buyDefense(catapatate, cell));
    assertEquals(200, wallet.getBalance());
    assertTrue(cell.isEmpty());
  }

  // The offer refuses: a scarecrow goes on the field, never on a slot.
  /** A scarecrow bought on a slot is refused, and nothing is paid. */
  @Test
  void scarecrowOnASlotIsRefused() {
    DefenseSlot slot = slots.getSlot(SlotSide.TOP, 1);

    assertFalse(shop.buyDefense(scarecrow, slot));
    assertEquals(200, wallet.getBalance());
    assertTrue(slot.isEmpty());
  }

  // The bramble is bought as a defense, like the view shows it (in the "Défenses" list since day 10): 40 coins.
  /** A bramble bought on an empty cell costs 40 and is planted right away. */
  @Test
  void brambleOnAnEmptyCellIsPaidAndPlaced() {
    Cell cell = new Cell(2, 3);

    assertTrue(shop.buyDefense(bramble, cell));
    assertEquals(160, wallet.getBalance());
    assertFalse(cell.isEmpty());
  }

  // The proof, without a screen, that a refused placement costs nothing: the cell is taken, the balance stays.
  /** A bramble bought on an occupied cell is refused, nothing is paid, and the occupant stays. */
  @Test
  void occupiedCellRefusesTheDefense() {
    Occupant occupant = new UnsellableOccupant();
    Cell cell = cellWith(occupant);

    assertFalse(shop.buyDefense(bramble, cell));
    assertEquals(200, wallet.getBalance());
    assertEquals(Optional.of(occupant), cell.getOccupant());
  }

  // canAfford comes before placeOn: without enough money, nothing is placed at all.
  /** A catapatate (150) with 100 coins is refused, and the slot stays empty. */
  @Test
  void defenseTooExpensiveIsNotPlaced() {
    Wallet poorWallet = new Wallet(100);
    Shop poorShop = shopWith(poorWallet);
    DefenseSlot slot = slots.getSlot(SlotSide.TOP, 1);

    assertFalse(poorShop.buyDefense(catapatate, slot));
    assertEquals(100, poorWallet.getBalance());
    assertTrue(slot.isEmpty());
  }

  // The same check on the field: canAfford comes before placeOn, so a scarecrow too expensive is never placed.
  /** A scarecrow (120) with 100 coins is refused on a cell, the cell stays empty and nothing is paid. */
  @Test
  void scarecrowTooExpensiveIsNotPlacedOnTheField() {
    Wallet poorWallet = new Wallet(100);
    Shop poorShop = shopWith(poorWallet);
    Cell cell = new Cell(2, 3);

    assertFalse(poorShop.buyDefense(scarecrow, cell));
    assertEquals(100, poorWallet.getBalance());
    assertTrue(cell.isEmpty());
  }

  // -------------------- UPGRADES --------------------
  // 300 coins: enough for both upgrades (100 + 200). An upgrade also repairs the defense (rules, section 7).
  /** A catapatate costs 100 to reach level 2, then 200 to reach level 3, and is repaired each time. */
  @Test
  void upgradesCostOneHundredThenTwoHundredAndRepair() {
    Wallet richWallet = new Wallet(300);
    Shop richShop = shopWith(richWallet);
    Defense defense = placedCatapatate();

    defense.wear(30);
    assertTrue(richShop.upgrade(defense));
    assertEquals(200, richWallet.getBalance());
    assertEquals(2, defense.getLevel());
    assertEquals(100, defense.getDurability());

    defense.wear(30);
    assertTrue(richShop.upgrade(defense));
    assertEquals(0, richWallet.getBalance());
    assertEquals(3, defense.getLevel());
    assertEquals(100, defense.getDurability());
  }

  // There is no level 4: the shop asks canUpgrade before reading the price, which would throw at level 3.
  /** A defense at level 3 cannot be upgraded: false, no exception, and nothing is paid. */
  @Test
  void levelThreeRefusesTheUpgrade() {
    Defense defense = placedCatapatate();
    defense.upgrade();
    defense.upgrade();

    assertFalse(shop.upgrade(defense));
    assertEquals(200, wallet.getBalance());
    assertEquals(3, defense.getLevel());
  }

  // Not enough money: spend refuses, so the defense keeps its level.
  /** An upgrade (100) with 50 coins is refused, and the level does not change. */
  @Test
  void upgradeTooExpensiveIsRefused() {
    Wallet poorWallet = new Wallet(50);
    Shop poorShop = shopWith(poorWallet);
    Defense defense = placedCatapatate();

    assertFalse(poorShop.upgrade(defense));
    assertEquals(50, poorWallet.getBalance());
    assertEquals(1, defense.getLevel());
  }

  // -------------------- URN --------------------
  // One coin short: spend refuses, the wallet keeps everything.
  /** With 9 999 coins, the urn cannot be bought and nothing is paid. */
  @Test
  void urnTooExpensiveChangesNothing() {
    Wallet poorWallet = new Wallet(9999);
    Shop poorShop = shopWith(poorWallet);

    assertFalse(poorShop.buyUrn());
    assertEquals(9999, poorWallet.getBalance());
  }

  // The exact price of the rules: the urn is paid and the wallet is empty.
  /** With 10 000 coins, the urn is bought and the balance falls to 0. */
  @Test
  void urnBoughtWithTheExactPrice() {
    Wallet richWallet = new Wallet(10000);
    Shop richShop = shopWith(richWallet);

    assertTrue(richShop.buyUrn());
    assertEquals(0, richWallet.getBalance());
  }
}
