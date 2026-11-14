/*
 * Decorative record animation: position, speed, gravity and lifetime of the particles.
 * export makes a value usable elsewhere; import fetches only the names needed.
 */
import { ctx } from "./canvas.js";
import { CANVAS_WIDTH, EXPLOSION_CHANCE, FIREWORK_COLORS, PARTICLE_GRAVITY, PARTICLE_LIFETIME, PARTICLES_PER_EXPLOSION } from "./constants.js";
import { state } from "./state.js";

/*
 * Returns a particle with its position, speed and lifetime.
 * sin and cos split its speed over the x and y axes.
 */
export function createParticle(x, y, color) {
    const angle = Math.random() * 2 * Math.PI;
    const speed = 1 + Math.random() * 3;

    return {
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: PARTICLE_LIFETIME,
        color: color
    };
}

/*
 * Creates the particles of an explosion around the point x, y and returns their array.
 */
export function createExplosion(x, y) {
    const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
    const created = [];

    for (let i = 0; i < PARTICLES_PER_EXPLOSION; i += 1) {
        created.push(createParticle(x, y, color));
    }

    return created;
}

/*
 * Updates the particles according to deltaFrames, expressed in frames equivalent to 60 Hz.
 * Applies gravity and removes the particles whose lifetime is over.
 */
export function updateFireworks(deltaFrames) {
    if (Math.random() < EXPLOSION_CHANCE * deltaFrames) {
        const x = 80 + Math.random() * (CANVAS_WIDTH - 160);
        const y = 80 + Math.random() * 220;
        state.particles.push(...createExplosion(x, y));
    }

    state.particles.forEach((particle) => {
        particle.x += particle.vx * deltaFrames;
        particle.y += particle.vy * deltaFrames;
        particle.vy += PARTICLE_GRAVITY * deltaFrames;
        particle.life -= deltaFrames;
    });

    /*
     * filter produces a new array holding only the particles still alive.
     */
    state.particles = state.particles.filter((particle) => particle.life > 0);
}

/*
 * Draws every remaining particle; its radius shrinks with its lifetime.
 */
export function drawParticles() {
    state.particles.forEach((particle) => {
        const radius = 2 + 2 * particle.life / PARTICLE_LIFETIME;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, Math.max(1, radius), 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.fill();
    });
}
