#!/usr/bin/env python3

import math

import pygame

from functions.constants import (
    WHITE, SNAKE_OUTLINE, BANNER_HEIGHT, STAR_YELLOW, BROWN, BLACK,
    GRID_SIZE, TONGUE_RED, APPLE_RED, CELL_SIZE, LIGHT_GREEN, FOREST_GREEN, SNAKE_GREEN, HEAD_GREEN,
)


# -------------------- POSITIONS --------------------

def cell_rect(cell):
    # Converts a (column, row) cell into a rectangle in pixels, below the score banner.
    column, row = cell
    return pygame.Rect(column * CELL_SIZE, BANNER_HEIGHT + row * CELL_SIZE, CELL_SIZE, CELL_SIZE)


def cell_center(cell):
    # Returns the center of a cell in pixels.
    return cell_rect(cell).center


def perpendicular(direction):
    # Returns the direction at a right angle, to place the eyes and fork the tongue.
    return (-direction[1], direction[0])


def offset_point(center, direction, distance):
    # Returns the point located at a given distance from the center, in a direction.
    return (center[0] + direction[0] * distance, center[1] + direction[1] * distance)


# -------------------- GRID --------------------

def cell_color(column, row):
    # Alternates light green and forest green like a checkerboard.
    if (column + row) % 2 == 0:
        return LIGHT_GREEN
    return FOREST_GREEN


def draw_grid(window):
    # Draws the 20 by 20 cells of the field.
    for column in range(GRID_SIZE):
        for row in range(GRID_SIZE):
            pygame.draw.rect(window, cell_color(column, row), cell_rect((column, row)))


# -------------------- STAR --------------------

def draw_star(window, center, radius):
    # Draws a yellow five-pointed star around a center.
    points = []
    for index in range(10):
        angle = -math.pi / 2 + index * math.pi / 5
        distance = radius if index % 2 == 0 else radius * 0.45
        points.append((center[0] + distance * math.cos(angle), center[1] + distance * math.sin(angle)))
    pygame.draw.polygon(window, STAR_YELLOW, points)
    pygame.draw.polygon(window, BLACK, points, 1)


# -------------------- LOGO --------------------

def draw_snake_logo(window, center, width=170):
    # Draws a wavy snake (head on the right) for the welcome and end screens.
    count = 24
    amplitude = width // 8
    points = []
    for index in range(count):
        t = index / (count - 1)
        x = center[0] - width // 2 + t * width
        y = center[1] + amplitude * math.sin(t * 3 * math.pi)
        points.append((x, y, 4 + 6 * t))
    for x, y, radius in points:
        pygame.draw.circle(window, SNAKE_GREEN, (x, y), radius)
        pygame.draw.circle(window, SNAKE_OUTLINE, (x, y), radius, 2)
    x, y, _ = points[-1]
    head = (x + 4, y)
    pygame.draw.line(window, TONGUE_RED, (head[0] + 10, head[1]), (head[0] + 22, head[1]), 3)
    for side in (-1, 1):
        pygame.draw.line(window, TONGUE_RED, (head[0] + 22, head[1]), (head[0] + 28, head[1] + side * 4), 2)
    pygame.draw.circle(window, HEAD_GREEN, head, 13)
    pygame.draw.circle(window, SNAKE_OUTLINE, head, 13, 2)
    for side in (-1, 1):
        eye = (head[0] + 3, head[1] + side * 6)
        pygame.draw.circle(window, WHITE, eye, 4)
        pygame.draw.circle(window, BLACK, (eye[0] + 1, eye[1]), 2)


# -------------------- APPLE --------------------

def draw_apple_at(window, center, radius):
    # Draws a bright red apple with its stem and leaf, around a center.
    pygame.draw.circle(window, APPLE_RED, center, radius)
    pygame.draw.circle(window, BLACK, center, radius, 1)
    top = (center[0], center[1] - radius)
    pygame.draw.line(window, BROWN, top, (top[0] + 1, top[1] - radius // 2), 2)
    pygame.draw.circle(window, SNAKE_GREEN, (top[0] + radius // 3, top[1] - radius // 3), max(2, radius // 4))


def draw_apple(window, cell):
    # Draws the apple on its cell.
    draw_apple_at(window, cell_center(cell), CELL_SIZE // 2 - 4)


# -------------------- SNAKE --------------------

def draw_segment(window, cell, color):
    # Draws one cell of the snake with a dark outline to set it apart from the grid.
    rect = cell_rect(cell).inflate(-4, -4)
    pygame.draw.rect(window, color, rect, border_radius=8)
    pygame.draw.rect(window, SNAKE_OUTLINE, rect, 2, border_radius=8)


def draw_eyes(window, cell, direction):
    # Draws two white eyes with black pupils toward the front of the head.
    sideways = perpendicular(direction)
    front = offset_point(cell_center(cell), direction, 4)
    for side in (-1, 1):
        eye = offset_point(front, sideways, side * 6)
        pygame.draw.circle(window, WHITE, eye, 4)
        pygame.draw.circle(window, BLACK, offset_point(eye, direction, 1), 2)


def draw_tongue(window, cell, direction):
    # Draws a forked red tongue coming out of the mouth.
    sideways = perpendicular(direction)
    base = offset_point(cell_center(cell), direction, CELL_SIZE // 2 - 2)
    tip = offset_point(base, direction, 10)
    pygame.draw.line(window, TONGUE_RED, base, tip, 3)
    for side in (-1, 1):
        end = offset_point(offset_point(tip, direction, 5), sideways, side * 4)
        pygame.draw.line(window, TONGUE_RED, tip, end, 2)


def draw_head(window, cell, direction):
    # Draws the head: the segment, the eyes and the red tongue.
    draw_tongue(window, cell, direction)
    draw_segment(window, cell, HEAD_GREEN)
    draw_eyes(window, cell, direction)


def draw_snake(window, snake, direction):
    # Draws the body from the tail toward the head, then the head on top.
    for cell in reversed(snake[1:]):
        draw_segment(window, cell, SNAKE_GREEN)
    draw_head(window, snake[0], direction)
