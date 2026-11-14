/*
 * Conversions and position calculations. A cell is an array [column, row].
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
import { BANNER_HEIGHT, CELL_SIZE, GRID_SIZE } from "./constants.js";

/*
 * A direction is an array [horizontal move, vertical move].
 * Checks whether each component of a is the opposite of that of b.
 */
export function isOpposite(a, b) {
    return a[0] === -b[0] && a[1] === -b[1];
}

/*
 * Returns the requested direction, unless it would cause an immediate U-turn.
 */
export function chooseDirection(currentDirection, newDirection) {
    if (isOpposite(currentDirection, newDirection)) {
        return currentDirection;
    }

    return newDirection;
}

/*
 * Creates three aligned cells in the middle of the grid; the head is at index 0.
 */
export function createSnake() {
    const middle = Math.floor(GRID_SIZE / 2);

    return [0, 1, 2].map((offset) => [middle - offset, middle]);
}

/*
 * Turns a cell [column, row] into a text key to compare positions by value.
 */
export function cellKey(cell) {
    return `${cell[0]}:${cell[1]}`;
}

/*
 * Walks the grid, leaving out the positions occupied by the snake.
 * A Set of keys finds a cell without walking the whole snake again.
 */
export function listFreeCells(currentSnake) {
    const occupied = new Set(currentSnake.map(cellKey));
    const cells = [];

    for (let column = 0; column < GRID_SIZE; column += 1) {
        for (let row = 0; row < GRID_SIZE; row += 1) {
            if (!occupied.has(`${column}:${row}`)) {
                cells.push([column, row]);
            }
        }
    }

    return cells;
}

/*
 * Picks a free cell at random; returns null if the grid is completely occupied.
 */
export function placeApple(currentSnake) {
    const freeCells = listFreeCells(currentSnake);

    if (freeCells.length === 0) {
        return null;
    }

    return freeCells[Math.floor(Math.random() * freeCells.length)];
}

/*
 * Checks the grid limits: indexes go from 0 to GRID_SIZE - 1.
 */
export function isOutOfGrid(cell) {
    return cell[0] < 0
        || cell[0] >= GRID_SIZE
        || cell[1] < 0
        || cell[1] >= GRID_SIZE;
}

/*
 * Compares the head with the other cells of the snake.
 * slice(1) leaves out the head; some stops as soon as one cell matches.
 */
export function bitesItself(currentSnake) {
    const head = cellKey(currentSnake[0]);
    return currentSnake.slice(1).some((cell) => cellKey(cell) === head);
}

/*
 * Compares the coordinates if both cells exist.
 * The short-circuit of && avoids reading the coordinates of a missing apple.
 */
export function sameCell(a, b) {
    return a && b && a[0] === b[0] && a[1] === b[1];
}

/*
 * Converts a logical cell into a pixel rectangle.
 * The y coordinate includes the banner height above the grid.
 */
export function cellRect(cell) {
    return {
        x: cell[0] * CELL_SIZE,
        y: BANNER_HEIGHT + cell[1] * CELL_SIZE,
        width: CELL_SIZE,
        height: CELL_SIZE
    };
}

/*
 * Returns the centre point of the rectangle of a cell.
 */
export function cellCenter(cell) {
    const rect = cellRect(cell);
    return [rect.x + rect.width / 2, rect.y + rect.height / 2];
}

/*
 * Rotates the direction by a quarter turn to place details on both sides of the head.
 */
export function perpendicular(currentDirection) {
    return [-currentDirection[1], currentDirection[0]];
}

/*
 * Returns a point moved from center, along a direction and a distance in pixels.
 */
export function offsetPoint(center, currentDirection, distance) {
    return [
        center[0] + currentDirection[0] * distance,
        center[1] + currentDirection[1] * distance
    ];
}
