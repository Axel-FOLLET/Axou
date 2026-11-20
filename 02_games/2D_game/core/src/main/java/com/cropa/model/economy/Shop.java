package com.cropa.model.economy;

// A defense to upgrade, the defenses on sale, and the slot a catapatate goes on. No Catapatate, Scarecrow
// nor Bramble: DefenseOffer is the only class that knows them, so a new defense never changes the shop.
import com.cropa.model.defense.Defense;
import com.cropa.model.defense.DefenseOffer;
import com.cropa.model.defense.DefenseSlot;
// GameConfig: the balancing numbers of the game, here the price of the urn.
import com.cropa.model.game.GameConfig;
// The field: the cell the player plants or sells, what sits on it, and the crops with their numbers.
import com.cropa.model.world.Cell;
import com.cropa.model.world.Crop;
import com.cropa.model.world.CropConfig;
import com.cropa.model.world.CropType;
import com.cropa.model.world.Occupant;
// List: the offers of the defenses. OptionalInt: what Occupant.onHarvested returns, a value that may be absent.
import java.util.List;
import java.util.OptionalInt;

// The shop: the immediate sale, the seeds, the defenses, their upgrades and the urn.
// It never checks the day or the night: the view reads session.getCycle().canAct() before calling it.
/**
 * The shop: it sells what grows on a cell, at the value of the stage it reached, it sells
 * the seeds and the defenses, placed as soon as they are paid, it charges the upgrades,
 * and it sells the urn.
 */
public class Shop {

  // -------------------- FIELDS --------------------
  // The player's wallet: a sale fills it, a purchase empties it.
  private final Wallet wallet;

  // The numbers of the crops: the seed prices, and what a new crop needs to be created.
  private final CropConfig cropConfig;

  // The numbers of the game: the price of the urn.
  private final GameConfig gameConfig;

  // The three defenses on sale (catapatate, scarecrow, bramble). Read-only: the view cannot add one.
  private final List<DefenseOffer> offers;

  // -------------------- CONSTRUCTOR --------------------
  // Called once when a game starts, with the wallet, the configs and the offers of the session.
  // Injection: the shop receives its offers, it does not build them. List.copyOf: a copy the caller cannot change.
  /**
   * Creates the shop.
   *
   * @param wallet     the player's wallet, filled by the sales and emptied by the purchases
   * @param cropConfig the numbers of the crops, which give the seed prices
   * @param gameConfig the balancing numbers of the game
   * @param offers     the defenses on sale
   */
  public Shop(Wallet wallet, CropConfig cropConfig, GameConfig gameConfig, List<DefenseOffer> offers) {
    this.wallet = wallet;
    this.cropConfig = cropConfig;
    this.gameConfig = gameConfig;
    this.offers = List.copyOf(offers);
  }

  // -------------------- ACTIONS --------------------
  // No instanceof Crop: the occupant says what its harvest brings, so a new occupant changes nothing here.
  // An empty cell or an empty answer: false, nothing changes. OptionalInt.of(0) is still a harvest: the cell is freed.
  /**
   * Sells what occupies the cell: its value goes to the wallet and the cell is freed.
   *
   * @param cell the cell to harvest
   * @return {@code true} if something was harvested, {@code false} if the cell is empty or
   *         its occupant cannot be harvested
   */
  public boolean sell(Cell cell) {
    OptionalInt value = cell.getOccupant().map(Occupant::onHarvested).orElse(OptionalInt.empty());
    if (value.isEmpty()) {
      return false;
    }
    wallet.add(value.getAsInt());
    cell.remove();
    return true;
  }

  // A seed is paid and planted at once: there is no inventory (rules, sections 5 and 11).
  // The order matters: the cell is checked before paying, so a seed that cannot be planted is never paid.
  // spend checks the balance itself: if it says no, nothing has changed and nothing is planted.
  /**
   * Buys a seed and plants it on the cell.
   *
   * @param type the crop to plant
   * @param cell the cell to plant it on
   * @return {@code true} if the seed was paid and planted, {@code false} if the cell is
   *         occupied or the balance is too low; nothing is paid nor planted then
   */
  public boolean buySeed(CropType type, Cell cell) {
    if (!cell.isEmpty()) {
      return false;
    }
    if (!wallet.spend(getSeedPrice(type))) {
      return false;
    }
    cell.place(new Crop(type, cropConfig));
    return true;
  }

  // A defense is paid and placed at once (rules, section 5). Overload: the type of the second parameter
  // picks the method. Here a slot around the field: only the catapatate goes there, the offer decides.
  // Unlike buySeed, only the offer knows if the placement works: so canAfford checks the money without spending
  // it, placeOn tries, and the money is taken only once the defense is placed. A refused placement costs nothing.
  /**
   * Buys a defense and places it on a slot around the field.
   *
   * @param offer the defense on sale
   * @param slot  the slot to place it on
   * @return {@code true} if it was paid and placed, {@code false} if the balance is too low,
   *         the slot is taken or this defense does not go on a slot; nothing is paid then
   */
  public boolean buyDefense(DefenseOffer offer, DefenseSlot slot) {
    if (!wallet.canAfford(offer.getPrice())) {
      return false;
    }
    if (!offer.placeOn(slot)) {
      return false;
    }
    wallet.spend(offer.getPrice());
    return true;
  }

  // The same order, on a cell of the field: the scarecrow and the bramble go there.
  // The bramble is bought here, as a defense: since day 10 the view shows it in the "Défenses" list, not with the seeds.
  /**
   * Buys a defense and places it on a cell of the field.
   *
   * @param offer the defense on sale
   * @param cell  the cell to place it on
   * @return {@code true} if it was paid and placed, {@code false} if the balance is too low,
   *         the cell is occupied or this defense does not go on the field; nothing is paid then
   */
  public boolean buyDefense(DefenseOffer offer, Cell cell) {
    if (!wallet.canAfford(offer.getPrice())) {
      return false;
    }
    if (!offer.placeOn(cell)) {
      return false;
    }
    wallet.spend(offer.getPrice());
    return true;
  }

  // "Upgrade": the next level, paid, and the defense is repaired (rules, section 7).
  // canUpgrade comes first: at level 3 there is no next level, and getUpgradePrice would throw.
  // Unlike buyDefense, canUpgrade tells beforehand that upgrade() will work: so spend can pay first, like buySeed.
  /**
   * Buys the next level of a defense, which also puts its durability back to 100 %.
   *
   * @param defense the defense to upgrade
   * @return {@code true} if it was paid and upgraded, {@code false} if it is already at
   *         level 3 or the balance is too low; nothing is paid then
   */
  public boolean upgrade(Defense defense) {
    if (!defense.canUpgrade()) {
      return false;
    }
    if (!wallet.spend(defense.getUpgradePrice())) {
      return false;
    }
    defense.upgrade();
    return true;
  }

  // The urn: the goal of the game (rules, section 2). Its price comes from GameConfig, never written here.
  // spend checks the balance itself: if it says no, nothing has changed. Whether it wins is up to GameSession.
  /**
   * Buys the urn.
   *
   * @return {@code true} if it was paid, {@code false} if the balance is too low; nothing is
   *         paid then
   */
  public boolean buyUrn() {
    return wallet.spend(gameConfig.getUrnPrice());
  }

  // -------------------- ACCESSORS --------------------
  // Used by the shop window to show the price of each seed, and by buySeed to charge it.
  /**
   * Returns the price of the seed of a crop.
   *
   * @param type the crop
   * @return the seed price, in coins
   */
  public int getSeedPrice(CropType type) {
    return cropConfig.getSeedPrice(type);
  }

  // Used by the shop window to list the defenses, with their price and where they go.
  /**
   * Returns the defenses on sale.
   *
   * @return a read-only list of the offers
   */
  public List<DefenseOffer> getDefenseOffers() {
    return offers;
  }
}
