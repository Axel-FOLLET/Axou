"""Soft mono one-shots for the farm defenses and old Garry."""

import random

import synth
from render_sounds import seed_of


WOOD = ((1.0, 1.0, 0.024), (2.37, 0.36, 0.014), (3.82, 0.17, 0.008))


def _buffer(seconds):
    return synth.zeros(round(seconds * synth.SR))


def _wood(hz):
    return synth.pluck(hz, WOOD, attack=0.0018, maxdur=0.13)


def _grain(rng, seconds, decay, hz, attack=0.0015):
    noise = synth.burst(rng, seconds, decay, attack=attack)
    return synth.biquad(noise, "bp", hz, q=0.82, warm=0)


def _finish(buf, cutoff):
    buf = synth.biquad(buf, "lp", cutoff, warm=0)
    return synth.finish(buf, drive=0.55, fade=0.024)


def _catapatate(rng, length, wood_hz, air_hz, release_at):
    buf = _buffer(length)
    arm = synth.thud(wood_hz * 0.84, wood_hz * 0.51, 0.012, 0.025, 0.135)
    synth.put(buf, 0, arm, 0.46)
    synth.put(buf, 0.003, _wood(wood_hz), 0.52)
    air = synth.whoosh(rng, length - release_at - 0.014,
                       360, air_hz, 330, 0.85, 0.27)
    synth.put(buf, release_at, air, 0.51)
    return _finish(buf, 4400)


def catapatate_fire(rng):
    # The approved hollow arm and potato puff use the original take's noise stream.
    rng = random.Random(seed_of("catapatate_fire_1"))
    return _catapatate(rng, 0.245, wood_hz=222, air_hz=1080, release_at=0.027)


def scarecrow_punch(rng):
    # A glove swishes in, then taut leather cracks over a low, padded impact.
    buf = _buffer(0.205)
    hit = 0.034
    synth.put(buf, 0, _grain(rng, 0.019, 0.005, 1200), 0.49)
    synth.put(buf, 0, synth.whoosh(rng, hit, 720, 1850, 960, 0.82, 0.62), 0.65)
    synth.put(buf, hit, synth.thud(202, 86, 0.010, 0.026, 0.150), 0.65)
    leather = _grain(rng, 0.036, 0.0055, 3500, attack=0.0006)
    synth.put(buf, hit, leather, 1.8)
    synth.put(buf, hit + 0.004, _grain(rng, 0.045, 0.009, 1560), 0.79)
    return _finish(buf, 7100)


def bramble_sting(rng):
    # A thorn rasps across the surface, catches twice, then releases a dry twig snap.
    buf = _buffer(0.145)
    tip = _grain(rng, 0.019, 0.0032, 3900, attack=0.0006)
    synth.put(buf, 0, tip, 0.87)
    rasp = synth.whoosh(rng, 0.047, 1950, 3200, 1250, 0.88, 0.21)
    synth.put(buf, 0.001, rasp, 0.70)
    for at, hz, gain in ((0.032, 3150, 0.75), (0.061, 4250, 0.60)):
        synth.put(buf, at, _grain(rng, 0.016, 0.0026, hz, attack=0.00045), gain)
    for at, hz, gain in ((0.047, 840, 0.26), (0.090, 670, 0.34)):
        synth.put(buf, at, synth.thud(hz * 1.7, hz, 0.0018, 0.0036, 0.025), gain)
        synth.put(buf, at, _grain(rng, 0.015, 0.0028, hz * 3.5), gain)
    return _finish(synth.biquad(buf, "lp", 4600, warm=0), 5200)


def defense_destroyed(rng):
    # A joint gives way, the frame lands in straw, and smaller wood pieces settle.
    length = 0.650
    buf = _buffer(length)
    synth.put(buf, 0, _wood(314), 0.38)
    synth.put(buf, 0, _grain(rng, 0.09, 0.017, 1410), 0.45)
    straw = synth.whoosh(rng, length * 0.69, 570, 1720, 580, 0.8, 0.43,
                         flutter=0.48, flutter_hz=31)
    synth.put(buf, length * 0.07, straw, 0.70)
    synth.put(buf, length * 0.30, synth.thud(156, 86, 0.016, 0.036, 0.19), 0.49)
    for fraction, hz, gain in ((0.27, 192, 0.43), (0.39, 245, 0.28),
                               (0.55, 308, 0.19), (0.69, 264, 0.12),
                               (0.81, 356, 0.07)):
        at = length * fraction + rng.uniform(-0.006, 0.006)
        synth.put(buf, at, _wood(hz), gain)
        synth.put(buf, at, _grain(rng, 0.067, 0.012, hz * 5), gain * 0.72)
    return _finish(buf, 3900)


def garry_fork(rng):
    # A rising air cut brushes steel, then five inharmonic blade modes ring out.
    buf = _buffer(0.490)
    contact = 0.054

    synth.put(buf, 0, _grain(rng, 0.021, 0.007, 1280, attack=0.0007), 0.55)
    air = synth.whoosh(rng, 0.064, 720, 3750, 4450, 0.95, 0.76)
    synth.put(buf, 0, air, 0.85)

    scrape = synth.whoosh(rng, 0.027, 2900, 5100, 3900, 1.15, 0.24)
    synth.put(buf, contact - 0.006, scrape, 0.48)
    # The upper modes die first, leaving a slowly beating pair in the steel tail.
    blade = ((1.000, 0.78, 0.094), (1.009, 0.32, 0.073),
             (1.427, 0.46, 0.080), (1.913, 0.36, 0.054),
             (2.596, 0.40, 0.036))
    ring = synth.pluck(2580, blade, attack=0.004, maxdur=0.418)
    synth.put(buf, contact, ring, 0.48)
    return _finish(buf, 7800)


SOUNDS = {
    "catapatate_fire": catapatate_fire,
    "scarecrow_punch": scarecrow_punch,
    "bramble_sting": bramble_sting,
    "defense_destroyed": defense_destroyed,
    "garry_fork": garry_fork,
}
