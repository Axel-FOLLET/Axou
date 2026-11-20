"""One-shot D-centred stings and eight syllables for the neighbour."""

import math
from functools import partial

import synth as s


def _buffer(seconds):
    return s.zeros(round(seconds * s.SR))


def _strike(buf, start, midi, partials, gain, ring, attack=0.004):
    note = s.pluck(s.mtof(midi), partials, amp=gain, attack=attack, maxdur=ring)
    s.put(buf, start, note)


def _space(buf, cutoff, decay, wet, tail):
    dry = s.biquad(buf, 'lp', cutoff, warm=0)
    air = s.room(dry, rt60=decay, wet=wet, tail=tail, tone=0.72 * cutoff)
    return s.finish(air, drive=0.24, fade=0.060)


def sting_dawn(rng):
    # A chesty pickup cracks into a long nasal crow, with two catches of the throat on one breath.
    # Each knot gives time, syrinx pitch in Hz, air pressure, and relative beak opening.
    contour = (
        (0.000, 335, 0.00, 0.28), (0.004, 350, 0.62, 0.34),
        (0.078, 470, 0.80, 0.67), (0.145, 510, 0.52, 0.66),
        (0.170, 440, 0.02, 0.24), (0.202, 396, 0.32, 0.31),
        (0.256, 450, 0.56, 0.53), (0.285, 425, 0.18, 0.36),
        (0.350, 575, 0.89, 0.89), (0.463, 625, 0.96, 0.98),
        (0.512, 538, 0.38, 0.48), (0.573, 584, 0.85, 0.72),
        (0.775, 655, 1.00, 1.00), (1.040, 633, 0.94, 0.95),
        (1.280, 586, 0.79, 0.77), (1.440, 556, 0.55, 0.56),
        (1.565, 450, 0.27, 0.33), (1.650, 365, 0.00, 0.17),
    )
    source = _buffer(contour[-1][0])
    opening = s.zeros(len(source))
    pulse = s.wavetable([(h, 1.0 / h ** 0.72) for h in range(1, 13)])
    phase = 0.0
    jitter = 1.0
    rasp_phase = rng.uniform(0, s.TAU)
    for left, right in zip(contour, contour[1:]):
        t0, f0, a0, b0 = left
        t1, f1, a1, b1 = right
        first, stop = round(t0 * s.SR), round(t1 * s.SR)
        for i in range(first, stop):
            u = (i - first) / (stop - first)
            u = u * u * (3 - 2 * u)
            t = i / s.SR
            hz = f0 + (f1 - f0) * u
            phase += hz * jitter / s.SR
            if phase >= 1.0:
                phase -= 1.0
                jitter = rng.uniform(0.982, 1.018)
            rasp_phase += s.TAU * (31 + 4 * math.sin(19 * t)) / s.SR
            pressure = a0 + (a1 - a0) * u
            source[i] = pressure * (1 + 0.17 * math.sin(rasp_phase)) * pulse[int(phase * s.TABLE)]
            opening[i] = b0 + (b1 - b0) * u

    throat = s.sweep(source, lambda i: 860 + 480 * opening[i], 2.7)
    beak = s.sweep(source, lambda i: 1720 + 550 * opening[i], 3.0)
    crow = s.scaled(source, 0.33)
    s.put(crow, 0, throat, 0.62)
    s.put(crow, 0, beak, 0.44)
    return _space(crow, 3550, 0.39, 0.085, 0.30)


def sting_dusk(rng):
    # A felt mallet strikes a low D gong; close pairs of plate modes beat as the upper rim blooms.
    root = s.mtof(38)
    length = 4.0
    # Each mode has its own frequency ratio, strength and decay time in seconds.
    body = ((1.00, 0.90, 1.13), (1.43, 0.46, 0.99), (1.47, 0.28, 1.12),
            (2.11, 0.42, 1.09), (2.16, 0.25, 0.98), (2.82, 0.31, 1.00),
            (3.64, 0.21, 0.94), (4.31, 0.12, 0.81))
    rim = ((3.19, 0.32, 1.04), (3.24, 0.22, 1.17), (4.74, 0.31, 0.96),
           (4.81, 0.20, 1.03), (5.93, 0.25, 0.89), (6.07, 0.18, 0.86),
           (7.69, 0.22, 0.80), (7.75, 0.13, 0.93), (9.58, 0.19, 0.78),
           (11.83, 0.15, 0.73), (13.51, 0.14, 0.80), (13.62, 0.10, 0.75),
           (16.37, 0.12, 0.68), (20.79, 0.09, 0.63), (25.31, 0.07, 0.57),
           (31.67, 0.05, 0.50))
    low = s.pluck(root, body, attack=0.005, maxdur=length)
    high = s.pluck(root, rim, attack=0.018, maxdur=length)
    out = _buffer(length)
    for i in range(len(out)):
        t = i / s.SR
        # The flexed plate starts 3.5% flat and relaxes towards pitch with a 0.24 s time constant.
        pos = i - 0.035 * 0.24 * s.SR * (1 - math.exp(-t / 0.24))
        j = int(pos)
        frac = pos - j
        center = low[j] + frac * (low[j + 1] - low[j])
        edge = high[j] + frac * (high[j + 1] - high[j])
        bloom = (1 - math.exp(-t / 0.17)) ** 2
        release = min(1.0, (length - t) / 0.38)
        out[i] = (center + bloom * edge) * release * release

    felt = s.biquad(s.burst(rng, 0.044, 0.009, attack=0.002), 'lp', 680, warm=0)
    s.put(out, 0, felt, 0.19)
    s.put(out, 0, s.thud(147, 84, 0.016, 0.023, 0.13), 0.32)
    return _space(out, 3900, 0.72, 0.14, 0.24)


def sting_victory(rng):
    # A harp skips up a D major triad and rolls the final chord under two glock accents.
    out = _buffer(2.17)
    for start, midi, gain, ring in (
        (0, 62, 0.65, 0.55), (0.22, 66, 0.48, 0.45), (0.34, 69, 0.50, 0.54),
        (0.57, 74, 0.62, 0.60), (0.90, 69, 0.48, 0.40),
        (1.09, 50, 0.39, 1.00), (1.12, 62, 0.39, 0.98),
        (1.15, 66, 0.31, 0.96), (1.18, 69, 0.32, 0.94), (1.21, 74, 0.45, 0.92),
    ):
        _strike(out, start, midi, s.HARP, gain * rng.uniform(0.97, 1.03), ring)
    glock_gain = 0.22
    _strike(out, 0.57, 74, s.GLOCK, glock_gain * 0.8, 0.51)
    _strike(out, 1.21, 86, s.GLOCK, glock_gain, 0.93, attack=0.008)
    return _space(out, 4900, 0.47, 0.12, 0.34)


def sting_defeat(rng):
    # Celesta falls through A, F, E and D while two softly detuned low strings bow the tonic.
    out = _buffer(2.46)
    for start, midi, gain, ring in ((0, 69, 0.50, 0.75), (0.60, 65, 0.43, 0.76),
                                    (1.13, 64, 0.34, 0.59), (1.60, 62, 0.39, 0.83)):
        _strike(out, start, midi, s.CELESTA, gain, ring, attack=0.008)
    strings = s.wavetable([(h, 1.0 / h ** 1.45) for h in range(1, 10)])
    for cents in (-4, 4):
        bow = s.osc(strings, s.mtof(50), 1.77, 0.25, 0.61, amp=0.12,
                    cents=cents, vib_rate=4.3, vib_cents=5, phase=rng.random())
        s.put(out, 0, bow)
    return _space(out, 3400, 0.51, 0.13, 0.33)


# Band-limited voiced excitation, rich enough to feed all three mouth resonances.
_GLOTTIS = s.wavetable([(h, 1.0 / h ** 0.78) for h in range(1, 15)])


def _syllable(rng, *, pitch, bend, length, vowel, consonant):
    voiced = length - 0.012
    source = _buffer(voiced)
    phase = 0.0
    for i in range(len(source)):
        u = i / len(source)
        hz = pitch + bend * (2 * u - u * u) + 4.0 * math.sin(math.pi * u)
        phase += hz * s.TABLE / s.SR
        source[i] = _GLOTTIS[int(phase) & s.MASK]

    mouth = s.scaled(source, 0.038)
    for center, initial, bandwidth, gain in zip(
        vowel, (500, 1550, 2850), (210, 300, 390), (1.0, 0.85, 0.38)
    ):
        # The lips move from a shared consonant posture into this particular vowel.
        q = center / bandwidth

        def resonance(i):
            return center + (initial - center) * math.exp(-i / (0.009 * s.SR))

        band = s.sweep(source, resonance, q)
        s.put(mouth, 0, band, gain / q)

    for i in range(len(mouth)):
        t = i / s.SR
        mouth[i] *= min(1.0, t / 0.0035) * min(1.0, (voiced - t) / 0.022) ** 2
    puff = s.biquad(s.burst(rng, 0.013, 0.0032), 'bp', consonant, q=0.8, warm=0)
    s.put(mouth, 0, puff, 0.12)
    mouth = s.biquad(mouth, 'lp', 4600, warm=0)
    return s.finish(mouth, drive=0.20, fade=0.014) + _buffer(0.012)


SOUNDS = {
    'sting_dawn': sting_dawn,
    'sting_dusk': sting_dusk,
    'sting_victory': sting_victory,
    'sting_defeat': sting_defeat,
    # A rising "ba" opens wide after a low lip puff.
    'neighbour_voice_1': partial(_syllable, pitch=363, bend=37, length=0.100,
                                 vowel=(850, 1450, 2850), consonant=800),
    # A quick "teh" dips from a higher pitch with a light tongue tap.
    'neighbour_voice_2': partial(_syllable, pitch=466, bend=-32, length=0.085,
                                 vowel=(690, 2070, 3000), consonant=2300),
    # A bright "yi" lifts into a narrow vowel with a high second formant.
    'neighbour_voice_3': partial(_syllable, pitch=475, bend=34, length=0.093,
                                 vowel=(350, 2880, 3460), consonant=2000),
    # A round "bo" droops through closely spaced low formants.
    'neighbour_voice_4': partial(_syllable, pitch=405, bend=-40, length=0.111,
                                 vowel=(510, 960, 2650), consonant=700),
    # A small "pou" tips upward behind a muffled lip release.
    'neighbour_voice_5': partial(_syllable, pitch=337, bend=27, length=0.080,
                                 vowel=(360, 800, 2480), consonant=620),
    # A forward "deh" lifts slightly, with a brighter tongue release.
    'neighbour_voice_6': partial(_syllable, pitch=410, bend=43, length=0.103,
                                 vowel=(490, 2420, 3070), consonant=1740),
    # A rounded "beu" falls lazily from the top of the speaking register.
    'neighbour_voice_7': partial(_syllable, pitch=502, bend=-53, length=0.116,
                                 vowel=(590, 1510, 2630), consonant=1050),
    # A clipped "daw" drops into an open, rounded vowel.
    'neighbour_voice_8': partial(_syllable, pitch=390, bend=-36, length=0.089,
                                 vowel=(700, 1160, 2760), consonant=1480),
}
