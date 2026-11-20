package com.cropa.model.economy;

// The player's money. The shop asks it before every purchase and reads the answer of spend before placing anything.
// The balance never goes below 0, and a negative amount never changes it (like Farm.takeDamage).
/**
 * The player's money: it goes up with the sales and down with the purchases, never below 0.
 */
public class Wallet {

  // -------------------- FIELDS --------------------
  // The coins the player has now. Only add and spend change it.
  private int balance;

  // -------------------- CONSTRUCTOR --------------------
  // Called once when a game starts, with GameConfig.getStartingMoney() (250 coins).
  /**
   * Creates a wallet holding the starting money.
   *
   * @param startingMoney the coins the player starts with
   */
  public Wallet(int startingMoney) {
    balance = startingMoney;
  }

  // -------------------- ACTIONS --------------------
  // Called by the shop when the player sells a crop. Early return on a negative amount: add never takes money away.
  /**
   * Adds money to the wallet. A negative amount is ignored.
   *
   * @param amount the coins to add; ignored if negative
   */
  public void add(int amount) {
    if (amount < 0) {
      return;
    }
    balance += amount;
  }

  // Called by the shop for a purchase. It reuses canAfford, so the two always give the same answer.
  /**
   * Spends money if the player can afford it. Otherwise nothing is spent.
   *
   * @param amount the price to pay
   * @return {@code true} if the money was spent, {@code false} if the amount is negative or above the balance
   */
  public boolean spend(int amount) {
    if (!canAfford(amount)) {
      return false;
    }
    balance -= amount;
    return true;
  }

  // -------------------- QUERIES --------------------
  // Read by the HUD to grey out the buttons that are too expensive: it spends nothing. A negative price is never valid.
  /**
   * Tells whether the player can pay the given amount, without spending it.
   *
   * @param amount the price to check
   * @return {@code true} if the amount is not negative and not above the balance
   */
  public boolean canAfford(int amount) {
    return amount >= 0 && amount <= balance;
  }

  // Read by the HUD, through GameListener.onMoneyChanged, and by the tests.
  /**
   * Returns the coins the player has now.
   *
   * @return the balance, never negative
   */
  public int getBalance() {
    return balance;
  }
}
