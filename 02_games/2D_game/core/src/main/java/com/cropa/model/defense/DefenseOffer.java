package com.cropa.model.defense;

// Enemy: the list the catapatate and the scarecrow aim at. Cell: a cell of the field, where the scarecrow
// and the bramble go.
import com.cropa.model.enemy.Enemy;
import com.cropa.model.world.Cell;
// List: the enemies of the game.
import java.util.List;

// A defense on sale in the shop. The Factory of the defenses: the only class that knows Catapatate,
// Scarecrow and Bramble. The shop only knows DefenseOffer: a new defense changes this class, never Shop.
/**
 * A defense on sale: its price, and the defense it creates where the player clicks.
 */
public class DefenseOffer {

    //-------------------- FIELDS --------------------
    // What it sells, the numbers, and what the new defenses need: the enemies, and the slots that keep the field ones.
    private final DefenseType type;
    private final DefenseConfig config;
    private final List<Enemy> enemies;
    private final DefenseSlots slots;

    //-------------------- CONSTRUCTOR --------------------
    // Called by GameSession, once per type (Antonin, day 8), then given to the Shop.
    /**
     * Creates the offer of one kind of defense.
     *
     * @param type the kind of defense on sale
     * @param config the balancing numbers
     * @param enemies the enemies of the game, read only
     * @param slots the defenses of the game, which keep the ones placed on the field
     */
    public DefenseOffer(DefenseType type, DefenseConfig config, List<Enemy> enemies, DefenseSlots slots) {
        this.type = type;
        this.config = config;
        this.enemies = enemies;
        this.slots = slots;
    }

    //-------------------- QUERIES --------------------
    /**
     * Returns the kind of defense on sale.
     *
     * @return its type
     */
    public DefenseType getType() {
        return type;
    }

    // Read by the shop before charging the player, and by the menu to show the price.
    /**
     * Returns the price of the defense.
     *
     * @return the price, in coins
     */
    public int getPrice() {
        return config.getPrice(type);
    }

    // Read by the view: after a click on this offer, the player clicks a cell (true) or a slot (false).
    /**
     * Tells whether this defense goes on a cell of the field.
     *
     * @return {@code false} for the catapatate, {@code true} for the scarecrow and the bramble
     */
    public boolean isPlacedOnField() {
        return type != DefenseType.CATAPATATE;
    }

    //-------------------- ACTIONS --------------------
    // Called by Shop.buyDefense(offer, slot). Only a catapatate goes on a slot; the slot refuses if it is taken.
    // false: nothing is placed, and the shop does not charge the player.
    /**
     * Creates the defense and places it on the given slot.
     *
     * @param slot the slot the player clicked
     * @return {@code true} if it was placed; {@code false} for a defense of the field or a taken slot
     */
    public boolean placeOn(DefenseSlot slot) {
        if (type != DefenseType.CATAPATATE) {
            return false;
        }
        return slot.place(new Catapatate(slot, config, enemies));
    }

    // Called by Shop.buyDefense(offer, cell). The scarecrow and the bramble go on a cell, through DefenseSlots,
    // which keeps them for the game. A switch over the enum, with no default: a fourth DefenseType does not compile
    // until its line is written here.
    /**
     * Creates the defense and places it on the given cell of the field.
     *
     * @param cell the cell the player clicked
     * @return {@code true} if it was placed; {@code false} for the catapatate or a taken cell
     */
    public boolean placeOn(Cell cell) {
        return switch (type) {
            case CATAPATATE -> false;
            case SCARECROW -> slots.placeOnField(cell, new Scarecrow(cell, config, enemies));
            case BRAMBLE -> slots.placeOnField(cell, new Bramble(cell, config));
        };
    }
}
