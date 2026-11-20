#!/usr/bin/env python3

from functions.constants import GRID_SIZE, KEY_DIRECTIONS


def create_snake():
    # Creates a 3-cell snake in the middle of the grid, the head is the first cell of the list.
    middle = GRID_SIZE // 2
    return [(middle - offset, middle) for offset in range(3)]


def direction_from_key(key):
    # Returns the direction tied to an arrow key, or None if the key is not an arrow.
    return KEY_DIRECTIONS.get(key)


def are_opposite(direction_a, direction_b):
    # Checks whether two directions point the opposite way.
    return direction_a[0] == -direction_b[0] and direction_a[1] == -direction_b[1]


def choose_direction(current_direction, requested_direction):
    # Refuses a U-turn, the snake would bite itself immediately.
    if are_opposite(current_direction, requested_direction):
        return current_direction
    return requested_direction


def compute_new_head(snake, direction):
    # Computes the cell the head will occupy on the next step.
    column, row = snake[0]
    return (column + direction[0], row + direction[1])


def advance_snake(snake, direction, grows):
    # Adds a head in front, and removes the tail unless the snake has just eaten.
    new_snake = [compute_new_head(snake, direction)] + snake
    if not grows:
        new_snake.pop()
    return new_snake
