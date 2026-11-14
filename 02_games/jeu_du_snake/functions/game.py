#!/usr/bin/env python3

from functions.constants import APPLES_PER_LEVEL, MAX_SPEED, RIGHT, START_SPEED
from functions.collisions import ate_apple, game_lost
from functions.apple import place_apple
from functions.snake import advance_snake, compute_new_head, create_snake


def new_game():
    # Prepares a game: snake, starting direction, first apple and a score of zero.
    snake = create_snake()
    return snake, RIGHT, place_apple(snake), 0


def compute_speed(score):
    # The snake speeds up every few apples, up to a maximum speed.
    return min(MAX_SPEED, START_SPEED + score // APPLES_PER_LEVEL)


def step_elapsed(last_step, now, score):
    # Checks whether the delay between two moves has elapsed (in milliseconds).
    return now - last_step >= 1000 // compute_speed(score)


def advance_game(snake, direction, apple, score):
    # Plays one game step, returns the new snake, the apple, the score and whether the game is over.
    ate = ate_apple(compute_new_head(snake, direction), apple)
    snake = advance_snake(snake, direction, ate)
    if game_lost(snake):
        return snake, apple, score, True
    if ate:
        return handle_apple_eaten(snake, score)
    return snake, apple, score, False


def handle_apple_eaten(snake, score):
    # Adds a point and places a new apple; if there is no room left the grid is full: victory.
    new_apple = place_apple(snake)
    return snake, new_apple, score + 1, new_apple is None
