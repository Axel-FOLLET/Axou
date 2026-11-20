package com.cropa.model.defense;

// Cell: the cell it grows on. Damageable: what crosses it, and what it stings. Occupant: whatever sits on a cell.
import com.cropa.model.world.Cell;
import com.cropa.model.world.Damageable;
import com.cropa.model.world.Occupant;
// OptionalInt: what onHarvested returns.
import java.util.OptionalInt;

// extends Defense and implements Occupant, like the scarecrow: a defense that sits on a cell of the field.
// It does nothing on its own (update is empty): it only acts when an enemy walks onto its cell.
/**
 * The bramble: it grows on a cell of the field and, once it has spent a night there, stings
 * every walking enemy that crosses it.
 */
public class Bramble extends Defense implements Occupant {

    //-------------------- FIELDS --------------------
    // Where it grows. growthNights is read once in the config; nights counts the dawns it has seen.
    private final Cell cell;
    private final int growthNights;
    private int nights;

    //-------------------- CONSTRUCTOR --------------------
    // Called by DefenseOffer when the player buys a bramble. It does not place itself: DefenseSlots.placeOnField does.
    /**
     * Creates a young bramble for the given cell. It does not sting yet.
     *
     * @param cell the cell of the field it grows on
     * @param config the balancing numbers
     */
    public Bramble(Cell cell, DefenseConfig config) {
        super(DefenseType.BRAMBLE, config);
        this.cell = cell;
        this.growthNights = config.getBrambleGrowthNights();
    }

    //-------------------- GROWTH --------------------
    // One more night spent on the field. Called at dawn through onDawn.
    /**
     * Counts one more night of growth.
     */
    public void grow() {
        nights++;
    }

    // Planted on day 1, it sees its first dawn on day 2: it stings from night 2 (rules, section 7).
    /**
     * Tells whether the bramble has grown enough to sting.
     *
     * @return {@code true} after its first night
     */
    public boolean isActive() {
        return nights >= growthNights;
    }

    // Defense.onDawn is empty; the bramble is the one defense that changes at dawn.
    /**
     * Grows at dawn.
     */
    @Override
    public void onDawn() {
        grow();
    }

    //-------------------- ACTIONS --------------------
    // Nothing to do on each frame: the bramble only acts when crossed.
    /**
     * Does nothing: the bramble only acts when an enemy crosses it.
     *
     * @param delta the seconds elapsed since the previous frame
     */
    @Override
    public void update(float delta) {
    }

    // The bramble only stings what walks onto its own cell: the view veils that one cell (Defense.reaches).
    /**
     * Tells whether this bramble reaches a cell: only the cell it grows on.
     *
     * @param row the row, from 1 to 3
     * @param column the column, from 1 to 5
     * @return {@code true} for its own cell
     */
    @Override
    public boolean reaches(int row, int column) {
        return row == cell.getRow() && column == cell.getColumn();
    }

    // Called by Defense.wear at 0 %: the bramble empties its cell.
    @Override
    protected void leavePlace() {
        cell.remove();
    }

    //-------------------- OCCUPANT --------------------
    // Called by Cell.crossBy when a walker enters its cell (a flyer never calls it: Flyable).
    // Too young: it is crushed like a crop and leaves (the rules say nothing more, choice of day 8).
    // Grown: it stings, loses 20 %, and stays unless that wear destroyed it. One wear only: the bramble's.
    /**
     * Reacts to an enemy crossing its cell.
     *
     * @param crosser what crosses the cell, stung once the bramble is grown
     * @return {@code true} if the bramble leaves the cell: crushed while young, or destroyed
     */
    @Override
    public boolean onCrossedBy(Damageable crosser) {
        if (!isActive()) {
            return true;
        }
        crosser.takeDamage(getDamage());
        wear(getWearPerUse());
        return isDestroyed();
    }

    // The mole does not eat the bramble (rules, section 8).
    /**
     * Reacts to a mole biting it.
     *
     * @return always {@code false}: a bramble is not eaten
     */
    @Override
    public boolean onBittenByMole() {
        return false;
    }

    // Not for sale, but it can be removed to free the cell ("Retirer" in the shop): Shop.sell adds 0 coins, then
    // empties the cell.
    /**
     * Returns the money a harvest of the bramble brings.
     *
     * @return always 0: the harvest only frees the cell
     */
    @Override
    public OptionalInt onHarvested() {
        return OptionalInt.of(0);
    }

    // Young: the seeds; grown: the bush. The files are listed in view/SpriteCatalog (this afternoon).
    /**
     * Returns the name of the sprite of the bramble at its stage.
     *
     * @return {@code "bramble_0"} while young, {@code "bramble_1"} once it stings
     */
    @Override
    public String spriteKey() {
        return isActive() ? "bramble_1" : "bramble_0";
    }
}
