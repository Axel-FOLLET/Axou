package com.cropa.model.economy;

// JUnit: assertion helpers and the @Test marker.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

/**
 * Tests for {@link Wallet}. Every test starts with the 200 coins of the rules.
 */
class WalletTest {

  // -------------------- START --------------------
  // The game fills the wallet with GameConfig.getStartingMoney(): 200 coins.
  /** A new wallet holds the starting money. */
  @Test
  void startsWithTheStartingMoney() {
    assertEquals(200, new Wallet(200).getBalance());
  }

  // -------------------- ADD --------------------
  // A sale adds its value to the balance.
  /** add raises the balance. */
  @Test
  void addRaisesTheBalance() {
    Wallet wallet = new Wallet(200);

    wallet.add(50);

    assertEquals(250, wallet.getBalance());
  }

  // Like Farm.takeDamage: a negative amount is ignored, so add can never take money away.
  /** A negative add does not change the balance. */
  @Test
  void negativeAddIsIgnored() {
    Wallet wallet = new Wallet(200);

    wallet.add(-10);

    assertEquals(200, wallet.getBalance());
  }

  // -------------------- SPEND --------------------
  // A purchase the player can afford is paid: true, and the price leaves the balance.
  /** spend lowers the balance and returns true. */
  @Test
  void spendLowersTheBalance() {
    Wallet wallet = new Wallet(200);

    assertTrue(wallet.spend(50));
    assertEquals(150, wallet.getBalance());
  }

  // The limit is included: the player may spend every last coin.
  /** Spending the whole balance succeeds and leaves 0. */
  @Test
  void spendTheWholeBalance() {
    Wallet wallet = new Wallet(200);

    assertTrue(wallet.spend(200));
    assertEquals(0, wallet.getBalance());
  }

  // The shop reads false before placing anything: nothing is paid, the balance never goes below 0.
  /** Spending more than the balance returns false and spends nothing. */
  @Test
  void spendMoreThanTheBalanceFails() {
    Wallet wallet = new Wallet(200);

    assertFalse(wallet.spend(201));
    assertEquals(200, wallet.getBalance());
  }

  // Without this rule, spend(-10) would add 10 coins.
  /** A negative spend returns false and does not change the balance. */
  @Test
  void negativeSpendIsRefused() {
    Wallet wallet = new Wallet(200);

    assertFalse(wallet.spend(-10));
    assertEquals(200, wallet.getBalance());
  }

  // -------------------- CAN AFFORD --------------------
  // The HUD greys out the buttons that are too expensive: canAfford answers without spending.
  /** canAfford is true up to the balance, false above, and spends nothing. */
  @Test
  void canAffordUpToTheBalance() {
    Wallet wallet = new Wallet(200);

    assertTrue(wallet.canAfford(200));
    assertFalse(wallet.canAfford(201));
    assertEquals(200, wallet.getBalance());
  }

  // A negative amount is never a valid price: canAfford and spend give the same answer.
  /** A negative amount is not affordable. */
  @Test
  void negativeAmountIsNotAffordable() {
    assertFalse(new Wallet(200).canAfford(-10));
  }
}
