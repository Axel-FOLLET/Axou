#!/usr/bin/env python3

import os
import pygame


# -------------------- GRID --------------------

CELL_SIZE = 30
GRID_SIZE = 20
BANNER_HEIGHT = 60
WINDOW_WIDTH = CELL_SIZE * GRID_SIZE
WINDOW_HEIGHT = WINDOW_WIDTH + BANNER_HEIGHT


# -------------------- COLORS --------------------

WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
GRAY = (200, 200, 200)
LIGHT_GREEN = (190, 230, 190)
FOREST_GREEN = (34, 110, 45)
SNAKE_GREEN = (0, 175, 120)
HEAD_GREEN = (0, 125, 85)
SNAKE_OUTLINE = (0, 70, 45)
APPLE_RED = (255, 20, 20)
TONGUE_RED = (230, 0, 40)
BROWN = (101, 67, 33)
STAR_YELLOW = (255, 200, 0)
FIREWORK_COLORS = [(255, 20, 20), (255, 200, 0), (255, 120, 0), (0, 175, 120), (30, 110, 255), (200, 40, 220)]


# -------------------- FIREWORKS --------------------

PARTICLES_PER_EXPLOSION = 40
PARTICLE_LIFETIME = 60
PARTICLE_GRAVITY = 0.08
EXPLOSION_CHANCE = 0.04


# -------------------- DIRECTIONS --------------------

UP = (0, -1)
DOWN = (0, 1)
LEFT = (-1, 0)
RIGHT = (1, 0)

KEY_DIRECTIONS = {
    pygame.K_UP: UP,
    pygame.K_DOWN: DOWN,
    pygame.K_LEFT: LEFT,
    pygame.K_RIGHT: RIGHT,
}


# -------------------- SPEED --------------------

START_SPEED = 6
MAX_SPEED = 15
APPLES_PER_LEVEL = 3


# -------------------- SCORE --------------------

SCORE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "best_score.txt")
