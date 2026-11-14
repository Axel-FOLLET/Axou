#!/usr/bin/env python3

from functions.constants import GRID_SIZE


def is_outside_grid(cell):
    # Checks whether a cell lies outside the grid (the snake hit a wall).
    column, row = cell
    return not (0 <= column < GRID_SIZE and 0 <= row < GRID_SIZE)


def bites_itself(snake):
    # Checks whether the head is on a cell of the body.
    return snake[0] in snake[1:]


def ate_apple(head_cell, apple):
    # Checks whether the head is on the apple.
    return head_cell == apple


def game_lost(snake):
    # The game is lost if the snake hits a wall or its own body.
    return is_outside_grid(snake[0]) or bites_itself(snake)
