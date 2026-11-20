#!/usr/bin/env python3

import random

from functions.constants import GRID_SIZE


def list_free_cells(snake):
    # Lists every cell of the grid that is not occupied by the snake.
    return [
        (column, row)
        for column in range(GRID_SIZE)
        for row in range(GRID_SIZE)
        if (column, row) not in snake
    ]


def place_apple(snake):
    # Picks a free cell at random, returns None if the grid is full.
    free_cells = list_free_cells(snake)
    if len(free_cells) == 0:
        return None
    return random.choice(free_cells)
