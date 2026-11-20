"""Mono enemy and farmhouse effects for the farm game."""

import math

import synth as s


def _buffer(seconds):
    return s.zeros(round(seconds * s.SR))


def _dust(rng, duration, decay, cutoff, attack=0.002):
    air = s.burst(rng, duration, decay, attack)
    return s.biquad(air, 'lp', cutoff, warm=0)


def _finish(sound, cutoff):
    sound = s.biquad(sound, 'lp', cutoff, warm=0)
    return s.finish(sound, drive=0.35, fade=0.035)


def _crunch(rng, pitch):
    # A bite has one cushioned contact and a few fibres breaking just after it.
    bite = _buffer(0.085)
    s.put(bite, 0, s.thud(pitch, pitch * 0.62, 0.009, 0.012, 0.065), 0.26)
    for start in (0, 0.012, 0.027):
        snap = _dust(rng, 0.040, rng.uniform(0.003, 0.008), rng.uniform(1800, 3200))
        s.put(bite, start * rng.uniform(0.8, 1.2), snap, 0.85 - 15 * start)
    return bite


def mole_munch(rng):
    # A round soil pop gives way to two pairs of little vegetable crunches.
    sound = _buffer(0.78)
    s.put(sound, 0, _dust(rng, 0.11, 0.023, 950), 0.85)
    s.put(sound, 0, s.drop(rng, 160, 390, 0.069), 0.28)
    for start, weight in ((0.17, 0.9), (0.28, 0.66), (0.49, 1.0), (0.65, 0.73)):
        s.put(sound, start, _crunch(rng, rng.uniform(310, 420)), weight)
    return _finish(sound, 3500)


def mole_death(rng):
    # A dusty poof lifts a small, round squeak that slides back underground.
    sound = _buffer(0.40)
    s.put(sound, 0, _dust(rng, 0.24, 0.048, 1050), 1.0)
    s.put(sound, 0.009, s.thud(152, 90, 0.018, 0.036, 0.19), 0.19)
    s.put(sound, 0.070, s.drop(rng, 940, 305, 0.27), 0.26)
    return _finish(sound, 2350)


def witch_attack(rng):
    # A trouser swish ends in a heavy boot thump, a hollow knock and a sole scuff.
    sound = _buffer(0.31)
    s.put(sound, 0, _dust(rng, 0.055, 0.014, 1800, attack=0.001), 0.74)
    swish = s.whoosh(rng, 0.079, 520, 2350, 930, 0.85, 0.65)
    s.put(sound, 0, swish, 0.75)

    hit = 0.074
    s.put(sound, hit, s.thud(175, 77, 0.018, 0.036, 0.195), 0.92)
    board = ((1, 1, 0.033), (1.68, 0.58, 0.020), (3.12, 0.28, 0.011))
    s.put(sound, hit, s.pluck(218, board, attack=0.0015, maxdur=0.17), 0.46)
    s.put(sound, hit + 0.004, _dust(rng, 0.085, 0.016, 3300), 0.60)
    scuff = s.whoosh(rng, 0.071, 2450, 1830, 700, 1.1, 0.17, flutter=0.45)
    s.put(sound, hit + 0.014, scuff, 0.47)
    return _finish(sound, 4200)


_GLOTTIS = s.wavetable([(h, h ** -1.25) for h in range(1, 18)])


def witch_death(rng):
    # A high nasal "aaah" buckles twice, slides down and vanishes in a sparkling puff.
    sound = _buffer(1.04)
    voice = _buffer(0.72)
    phase = 0.0
    for i in range(len(voice)):
        t = i / s.SR
        u = i / len(voice)
        wobble = math.sin(s.TAU * (6 * t + 3 * t * t))
        pitch = 495 * (175 / 495) ** (u ** 1.65) * (1 + 0.058 * wobble)
        phase = (phase + pitch * s.TABLE / s.SR) % s.TABLE
        catch = (1 - 0.78 * math.exp(-((t - 0.18) / 0.026) ** 2)
                   - 0.87 * math.exp(-((t - 0.35) / 0.032) ** 2))
        envelope = min(1.0, t / 0.003) * (1 - u ** 3) ** 2
        voice[i] = _GLOTTIS[int(phase)] * catch * envelope

    # Parallel resonances give the vowel a pinched nasal ring and an open mouth.
    for hz, q, gain in ((475, 3.0, 0.56), (970, 4.5, 1.25), (1780, 5.0, 1.70)):
        s.put(sound, 0, s.biquad(voice, 'bp', hz, q, warm=0), gain)

    puff = 0.705
    s.put(sound, puff, _dust(rng, 0.28, 0.054, 1250, attack=0.006), 0.83)
    s.put(sound, puff, s.whoosh(rng, 0.24, 620, 1680, 420, 0.8, 0.18), 0.51)
    s.put(sound, puff + 0.041, s.pluck(1175, s.CELESTA[:2], maxdur=0.14), 0.045)
    return _finish(sound, 3800)


def bat_attack(rng):
    # A single little tooth snap is followed by a clipped upward squeak.
    sound = _buffer(0.215)
    s.put(sound, 0, _crunch(rng, 550))
    s.put(sound, 0.049, s.drop(rng, 1300, 2030, 0.118), 0.23)
    return _finish(sound, 3200)


def bat_death(rng):
    # Peaceful and low (Axel, 20/11: the squeak was too high): no voice, three soft wing beats slowing down, then a
    # muffled landing.
    sound = _buffer(0.62)
    for start, dur, gain in ((0.0, 0.07, 0.50), (0.10, 0.085, 0.38), (0.23, 0.10, 0.27)):
        s.put(sound, start, s.whoosh(rng, dur, 240, 430, 260, 1.1, 0.35), gain)
    s.put(sound, 0.40, s.thud(150, 95, 0.022, 0.035, 0.15, drive=1.0), 0.26)
    s.put(sound, 0.402, _dust(rng, 0.10, 0.025, 600), 0.22)
    return _finish(sound, 1200)


SOUNDS = {
    'mole_munch': mole_munch,
    'mole_death': mole_death,
    'witch_attack': witch_attack,
    'witch_death': witch_death,
    'bat_attack': bat_attack,
    'bat_death': bat_death,
}
