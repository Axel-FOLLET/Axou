package com.cropa.model.world;

// OptionalInt: an amount of money that may be absent, without null or a special value.
import java.util.OptionalInt;

// Contract for whatever can sit on a Cell of the field: a crop, a scarecrow or a bramble.
// The callers never ask what the occupant is: they tell it what happens, and it reacts in its own way.
// A new occupant is one new class and one line in SpriteCatalog: Cell and WorldRenderer do not change.
/**
 * Something that occupies a {@link Cell} of the field: a crop, a scarecrow or a
 * bramble.
 */
public interface Occupant {

  // Called by Cell.crossBy when an enemy walks over the cell. A crop is crushed and leaves;
  // a bramble stays and can hurt the crosser through takeDamage.
  /**
   * Reacts to an enemy crossing the cell.
   *
   * @param crosser what crosses the cell, which this occupant may hurt
   * @return {@code true} if this occupant leaves the cell
   */
  boolean onCrossedBy(Damageable crosser);

  // Called by the mole when it bites the cell. A crop is eaten; a defense is not.
  /**
   * Reacts to a mole biting it.
   *
   * @return {@code true} if this occupant was eaten
   */
  boolean onBittenByMole();

  // Read by Board.spriteAt for the view. A key, never a file path: SpriteCatalog links the two.
  /**
   * Returns the name of the sprite to draw, for example {@code "carrot_0"}.
   *
   * @return the sprite key, as listed in SpriteCatalog
   */
  String spriteKey();

  // Asked by the shop when the player sells the cell: no instanceof Crop, the occupant answers.
  // default: the fake occupants of the tests and the defenses compile without a change.
  // Empty: it cannot be sold and stays. The bramble will answer OptionalInt.of(0): harvested for nothing.
  /**
   * Returns the money a harvest of this occupant brings.
   *
   * @return the amount, or an empty {@code OptionalInt} if this occupant cannot be harvested
   */
  default OptionalInt onHarvested() {
    return OptionalInt.empty();
  }

  // Asked by an enemy before it walks onto the cell: true makes it turn aside. No instanceof Crop either.
  // default: by default an occupant stops nobody.
  /**
   * Tells whether this occupant stops an enemy that avoids the given crop.
   *
   * @param blocker the crop type the enemy avoids
   * @return {@code true} if this occupant stops that enemy
   */
  default boolean blocks(CropType blocker) {
    return false;
  }
}