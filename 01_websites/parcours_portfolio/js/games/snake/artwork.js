/*
 * Drawings specific to the game, built with the canvas primitives.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
import { FONT_FAMILY } from "../theme.js";
import { ctx } from "./canvas.js";
import { ACCENT, APPLE_COLOR, APPLE_LEAF, APPLE_STEM, BANNER, BANNER_HEIGHT, CANVAS_WIDTH, CELL_DARK, CELL_LIGHT, CELL_SIZE, EYE_PUPIL, EYE_WHITE, FIELD_FRAME, GRID_SIZE, SNAKE_BODY, SNAKE_HEAD, SNAKE_OUTLINE, STAR_COLOR, TONGUE_COLOR, WHITE } from "./constants.js";
import { drawRoundedRect, drawText } from "./drawing.js";
import { cellCenter, cellRect, offsetPoint, perpendicular } from "./geometry.js";
import { state } from "./state.js";
import { t } from "./translations.js";

/*
 * Draws the checkerboard; the parity of column + row alternates the two colours.
 * Then draws the frame of the playing field, which shows where the walls are.
 */
export function drawGrid() {
    for (let column = 0; column < GRID_SIZE; column += 1) {
        for (let row = 0; row < GRID_SIZE; row += 1) {
            ctx.fillStyle = (column + row) % 2 === 0 ? CELL_LIGHT : CELL_DARK;
            ctx.fillRect(
                column * CELL_SIZE,
                BANNER_HEIGHT + row * CELL_SIZE,
                CELL_SIZE,
                CELL_SIZE
            );
        }
    }

    ctx.strokeStyle = FIELD_FRAME;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, BANNER_HEIGHT + 1, GRID_SIZE * CELL_SIZE - 2, GRID_SIZE * CELL_SIZE - 2);
}

/*
 * Builds ten vertices alternating outer and inner radius to draw five points.
 */
export function drawStar(center, radius) {
    const points = [];

    for (let index = 0; index < 10; index += 1) {
        const angle = -Math.PI / 2 + index * Math.PI / 5;
        const distance = index % 2 === 0 ? radius : radius * 0.45;

        points.push([
            center[0] + distance * Math.cos(angle),
            center[1] + distance * Math.sin(angle)
        ]);
    }

    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);

    points.slice(1).forEach((point) => ctx.lineTo(point[0], point[1]));

    ctx.closePath();
    ctx.fillStyle = STAR_COLOR;
    ctx.fill();
}

/*
 * Draws the decorative snake of the welcome screen with dots following a sine wave.
 */
export function drawLogoSnake(center, width = 170) {
    const count = 24;
    const amplitude = Math.floor(width / 8);
    const points = [];

    for (let index = 0; index < count; index += 1) {
        const progress = index / (count - 1);
        const x = center[0] - width / 2 + progress * width;
        const y = center[1] + amplitude * Math.sin(progress * 3 * Math.PI);
        const radius = 4 + 6 * progress;
        points.push([x, y, radius]);
    }

    points.forEach(([x, y, radius]) => {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = SNAKE_BODY;
        ctx.fill();
        ctx.strokeStyle = SNAKE_OUTLINE;
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    const last = points[points.length - 1];
    const head = [last[0] + 4, last[1]];

    ctx.strokeStyle = TONGUE_COLOR;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(head[0] + 10, head[1]);
    ctx.lineTo(head[0] + 22, head[1]);
    ctx.stroke();

    [-1, 1].forEach((side) => {
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(head[0] + 22, head[1]);
        ctx.lineTo(head[0] + 28, head[1] + side * 4);
        ctx.stroke();
    });

    ctx.beginPath();
    ctx.arc(head[0], head[1], 13, 0, Math.PI * 2);
    ctx.fillStyle = SNAKE_HEAD;
    ctx.fill();
    ctx.strokeStyle = SNAKE_OUTLINE;
    ctx.lineWidth = 2;
    ctx.stroke();

    [-1, 1].forEach((side) => {
        drawEye([head[0] + 3, head[1] + side * 6], 1);
    });
}

/*
 * Draws one eye: a dark ring so it reads on the light head, the white, then the pupil shifted by pupilShift pixels
 * along x.
 */
function drawEye(eye, pupilShift) {
    ctx.beginPath();
    ctx.arc(eye[0], eye[1], 5, 0, Math.PI * 2);
    ctx.fillStyle = SNAKE_OUTLINE;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(eye[0], eye[1], 4, 0, Math.PI * 2);
    ctx.fillStyle = EYE_WHITE;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(eye[0] + pupilShift, eye[1], 2, 0, Math.PI * 2);
    ctx.fillStyle = EYE_PUPIL;
    ctx.fill();
}

/*
 * Draws an apple around the point center [x, y], with the requested radius.
 */
export function drawAppleAt(center, radius) {
    ctx.beginPath();
    ctx.arc(center[0], center[1], radius, 0, Math.PI * 2);
    ctx.fillStyle = APPLE_COLOR;
    ctx.fill();

    const top = [center[0], center[1] - radius];

    ctx.beginPath();
    ctx.moveTo(top[0], top[1]);
    ctx.lineTo(top[0] + 1, top[1] - radius / 2);
    ctx.strokeStyle = APPLE_STEM;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(
        top[0] + radius / 3,
        top[1] - radius / 3,
        Math.max(2, radius / 4),
        0,
        Math.PI * 2
    );
    ctx.fillStyle = APPLE_LEAF;
    ctx.fill();
}

/*
 * Converts the apple cell into a pixel centre before reusing its drawing.
 */
export function drawApple(cell) {
    drawAppleAt(cellCenter(cell), CELL_SIZE / 2 - 4);
}

/*
 * Draws a segment inside a cell with a small margin.
 */
export function drawSegment(cell, color) {
    const rect = cellRect(cell);

    drawRoundedRect(
        rect.x + 2,
        rect.y + 2,
        rect.width - 4,
        rect.height - 4,
        8,
        color,
        SNAKE_OUTLINE,
        2
    );
}

/*
 * Places the eyes on the sides and the pupils towards the direction of movement.
 */
export function drawEyes(cell, currentDirection) {
    const lateral = perpendicular(currentDirection);
    const front = offsetPoint(cellCenter(cell), currentDirection, 4);

    [-1, 1].forEach((side) => {
        const eye = offsetPoint(front, lateral, side * 6);
        const pupil = offsetPoint(eye, currentDirection, 1);

        ctx.beginPath();
        ctx.arc(eye[0], eye[1], 5, 0, Math.PI * 2);
        ctx.fillStyle = SNAKE_OUTLINE;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(eye[0], eye[1], 4, 0, Math.PI * 2);
        ctx.fillStyle = EYE_WHITE;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(pupil[0], pupil[1], 2, 0, Math.PI * 2);
        ctx.fillStyle = EYE_PUPIL;
        ctx.fill();
    });
}

/*
 * Draws the tongue in front of the head, then its two side branches.
 */
export function drawTongue(cell, currentDirection) {
    const lateral = perpendicular(currentDirection);
    const base = offsetPoint(cellCenter(cell), currentDirection, CELL_SIZE / 2 - 2);
    const tip = offsetPoint(base, currentDirection, 10);

    ctx.beginPath();
    ctx.moveTo(base[0], base[1]);
    ctx.lineTo(tip[0], tip[1]);
    ctx.strokeStyle = TONGUE_COLOR;
    ctx.lineWidth = 3;
    ctx.stroke();

    [-1, 1].forEach((side) => {
        const end = offsetPoint(offsetPoint(tip, currentDirection, 5), lateral, side * 4);

        ctx.beginPath();
        ctx.moveTo(tip[0], tip[1]);
        ctx.lineTo(end[0], end[1]);
        ctx.strokeStyle = TONGUE_COLOR;
        ctx.lineWidth = 2;
        ctx.stroke();
    });
}

/*
 * Draws the body from the tail, then the tongue, the head and the eyes.
 * slice makes a copy before reverse so the real snake is not reversed.
 */
export function drawSnake() {
    state.snake.slice(1).reverse().forEach((cell) => {
        drawSegment(cell, SNAKE_BODY);
    });

    drawTongue(state.snake[0], state.direction);
    drawSegment(state.snake[0], SNAKE_HEAD);
    drawEyes(state.snake[0], state.direction);
}

/*
 * Shows the score and the record; measureText computes the room the text needs.
 */
export function drawBanner() {
    ctx.fillStyle = BANNER;
    ctx.fillRect(0, 0, CANVAS_WIDTH, BANNER_HEIGHT);

    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, BANNER_HEIGHT - 2);
    ctx.lineTo(CANVAS_WIDTH, BANNER_HEIGHT - 2);
    ctx.stroke();

    drawAppleAt([30, BANNER_HEIGHT / 2 + 3], 12);
    drawText(t.apples(state.score), 52, 20, 30, WHITE);

    ctx.font = `30px ${FONT_FAMILY}`;
    const label = t.best(state.bestScore);
    const width = ctx.measureText(label).width;
    const textX = CANVAS_WIDTH - width - 20;

    drawText(label, textX, 20, 30, WHITE);
    drawStar([textX - 18, BANNER_HEIGHT / 2], 11);
}
