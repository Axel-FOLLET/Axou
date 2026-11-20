#!/usr/bin/env python3

import pygame

from functions.constants import (
    WHITE, GRAY, BANNER_HEIGHT, WINDOW_WIDTH, BLACK, APPLE_RED, FOREST_GREEN,
)
from functions.drawing import (
    draw_star, draw_grid, draw_snake_logo, draw_apple, draw_apple_at,
    draw_snake,
)
from functions.fireworks import draw_particles


# -------------------- TEXT --------------------

def draw_text(window, text, position, font, color=BLACK):
    # Draws a text at a precise position.
    window.blit(font.render(text, True, color), position)


def draw_centered(window, text, y, font, color=BLACK):
    # Draws a text centered horizontally.
    surface = font.render(text, True, color)
    window.blit(surface, ((window.get_width() - surface.get_width()) // 2, y))


def draw_centered_lines(window, lines, start_y, font, spacing=38):
    # Draws several lines of text centered one under the other.
    for index, line in enumerate(lines):
        draw_centered(window, line, start_y + index * spacing, font)


def draw_green_frame(window, rect):
    # Draws a forest green frame with rounded corners.
    pygame.draw.rect(window, FOREST_GREEN, rect, 4, border_radius=14)


# -------------------- SCORE BANNER --------------------

def draw_apples_eaten(window, score, font):
    # Draws the apple emoji followed by the number of apples eaten.
    draw_apple_at(window, (30, BANNER_HEIGHT // 2 + 3), 12)
    draw_text(window, "x " + str(score), (52, 20), font)


def draw_best_score(window, best_score, font):
    # Draws the star then the best score, aligned to the right of the banner.
    surface = font.render("Meilleur score : " + str(best_score), True, BLACK)
    text_x = WINDOW_WIDTH - surface.get_width() - 20
    window.blit(surface, (text_x, 20))
    draw_star(window, (text_x - 18, BANNER_HEIGHT // 2), 11)


def draw_banner(window, score, best_score, font):
    # Draws the white banner at the top with the apples eaten and the best score.
    pygame.draw.rect(window, WHITE, (0, 0, WINDOW_WIDTH, BANNER_HEIGHT))
    pygame.draw.line(window, FOREST_GREEN, (0, BANNER_HEIGHT - 2), (WINDOW_WIDTH, BANNER_HEIGHT - 2), 4)
    draw_apples_eaten(window, score, font)
    draw_best_score(window, best_score, font)


# -------------------- SCREENS --------------------

def draw_game(window, snake, direction, apple, score, best_score, font):
    # Clears the screen then redraws the whole current state of the game.
    window.fill(WHITE)
    draw_grid(window)
    if apple is not None:
        draw_apple(window, apple)
    draw_snake(window, snake, direction)
    draw_banner(window, score, best_score, font)
    pygame.display.flip()


def draw_welcome_screen(window, large_font, font, rules_font, small_font):
    # Draws the welcome screen: title, rules in a green frame, then the keys.
    window.fill(WHITE)
    draw_snake_logo(window, (WINDOW_WIDTH // 2 - 14, 40))
    draw_centered(window, "BIENVENUE AU JEU DU SNAKE", 80, large_font, FOREST_GREEN)
    draw_green_frame(window, pygame.Rect(50, 150, WINDOW_WIDTH - 100, 270))
    draw_centered_lines(window, [
        "Guidez le serpent avec les flèches directionnelles.",
        "Mangez les pommes rouges pour grandir.",
        "Chaque pomme mangée vous rapporte 1 point.",
        "Le serpent accélère au fil des pommes.",
        "Toucher un mur ou votre propre corps = défaite.",
        "Le demi-tour est impossible.",
    ], 180, rules_font)
    draw_centered(window, "Appuyez sur ENTRÉE pour commencer.", 470, font, FOREST_GREEN)
    draw_centered(window, "ÉCHAP pour quitter.", 520, small_font, GRAY)
    pygame.display.flip()


def record_text(record_broken, best_score):
    # Returns the message matching the best score.
    if record_broken:
        return "NOUVEAU MEILLEUR SCORE !"
    return "Meilleur score : " + str(best_score)


def draw_end_title(window, victory, large_font, font):
    # Draws the title and the sentence of the end screen depending on victory or defeat.
    if victory:
        draw_centered(window, "VICTOIRE !", 100, large_font, FOREST_GREEN)
        draw_centered(window, "La grille est entièrement remplie.", 170, font)
    else:
        draw_centered(window, "PERDU !", 100, large_font, APPLE_RED)
        draw_centered(window, "Le serpent s'est écrasé.", 170, font)


def draw_end_screen(window, victory, score, best_score, record_broken, particles, fonts):
    # Draws the end screen, with the fireworks behind the text if the record is broken.
    large_font, font, small_font = fonts
    window.fill(WHITE)
    draw_particles(window, particles)
    draw_snake_logo(window, (WINDOW_WIDTH // 2 - 14, 45))
    draw_end_title(window, victory, large_font, font)
    draw_centered(window, "Pommes mangées : " + str(score), 250, font)
    draw_centered(window, record_text(record_broken, best_score), 300, font, FOREST_GREEN)
    draw_centered(window, "Appuyez sur ENTRÉE pour rejouer.", 420, font, FOREST_GREEN)
    draw_centered(window, "ÉCHAP pour quitter.", 470, small_font, GRAY)
    pygame.display.flip()
