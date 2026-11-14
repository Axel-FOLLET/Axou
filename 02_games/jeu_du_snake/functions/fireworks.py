#!/usr/bin/env python3

import math
import random
import pygame

from functions.constants import (
    EXPLOSION_CHANCE, FIREWORK_COLORS, PARTICLE_LIFETIME, PARTICLE_GRAVITY,
    WINDOW_WIDTH, PARTICLES_PER_EXPLOSION,
)


def create_particle(x, y, color):
    # Creates a particle that flies off in a random direction at a random speed.
    angle = random.uniform(0, 2 * math.pi)
    speed = random.uniform(1, 4)
    return {
        "x": x, "y": y,
        "vx": math.cos(angle) * speed, "vy": math.sin(angle) * speed,
        "life": PARTICLE_LIFETIME, "color": color,
    }


def create_explosion(x, y):
    # Creates all the particles of one explosion, all of the same color.
    color = random.choice(FIREWORK_COLORS)
    return [create_particle(x, y, color) for _ in range(PARTICLES_PER_EXPLOSION)]


def launch_random_explosion(particles):
    # Adds an explosion at a random spot in the upper part of the window.
    x = random.randint(80, WINDOW_WIDTH - 80)
    y = random.randint(80, 300)
    return particles + create_explosion(x, y)


def move_particle(particle):
    # Moves the particle, gravity pulls it down and its life decreases.
    particle["x"] += particle["vx"]
    particle["y"] += particle["vy"]
    particle["vy"] += PARTICLE_GRAVITY
    particle["life"] -= 1


def animate_fireworks(particles):
    # Advances the animation by one step: a new explosion may start, dead particles are removed.
    if random.random() < EXPLOSION_CHANCE:
        particles = launch_random_explosion(particles)
    for particle in particles:
        move_particle(particle)
    return [particle for particle in particles if particle["life"] > 0]


def draw_particles(window, particles):
    # Draws every particle, it shrinks near the end of its life.
    for particle in particles:
        radius = 2 + 2 * particle["life"] // PARTICLE_LIFETIME
        pygame.draw.circle(window, particle["color"], (int(particle["x"]), int(particle["y"])), radius)
