"""Lost music: offline rendering, then mp3.

Usage (from the Lost root, after tools/setup_audio.sh):
  tools/.audio-env/bin/python3 -B tools/render_music.py [--only meadow,boss] [--out public/sounds] [--work DIR] [--birds DIR]
  python3 -B tools/render_music.py --only mountain

Only the sampled boss track needs `tinysoundfont` and the instrument bank; the other tracks use the standard library
(math, array, seeded random, wave, subprocess). ffmpeg (libmp3lame) encodes the wavs and decodes the bird sources. Two
runs give the same samples (fixed `SEEDS`, no randomness in the birds or the sampled tracks). Melodies and chord
progressions were written for this project; no existing tune is reused. The CC0 birds and the MIT instrument bank
(docs/credits.md) stay out of the repository.

Tracks of --only:
- `meadow`: `music_meadow.mp3`, exploration; soft pad, a few harp notes, no percussion; D major, 72 BPM, 16 bars of 4
  beats (53.333 s), with recorded birdsong under the music (`bird_layer`). Requires --birds.
- `boss`: dark requiem with the Chartiste's theme (`boss_v5`), four stereo files read by Music.js. Sampled instruments.
- `mountain`: `music_mountain.mp3`, snowy mountain; sleigh bells, celesta, glockenspiel, music box, soft pad, plucked
  bass, light high-altitude wind underneath (filtered noise, slow gusts); G major, 90 BPM, 24 bars of 3 beats (48 s).

Seamless looping: each track is rendered circularly. Notes running past the end come back at the start, and filters and
reverb run in steady state over the loop (warm-up pass on its end, or two passes keeping the second), so the N samples
are periodic. The file contains [PAD s of the end][loop][PAD s of the start]; Music.js loops from PAD to PAD + duration.
A start offset under PAD s (mp3 encoder delay a browser would not remove, 1105 samples for LAME) falls in the copied
area, so the junction does not change. Durations are multiples of 1/300 s: a whole number of samples at 44.1 and 48 kHz.

The --work folder (temporary by default) receives the wavs used for measurements: each track and its stems (meadow:
music only, birds only; mountain: music only, wind only), at the same scale as the final file.
"""
import argparse
import array
import math
import os
import random
import subprocess
import sys
import tempfile
import wave
from fractions import Fraction
from itertools import accumulate
from operator import add, mul
from types import SimpleNamespace

SR = 44100
PAD = 0.25          # s copied on each side of the loop (Music.js: TRACKS[...].loop)
PEAK_DB = -3.0      # peak of each file before encoding (headroom for the mp3 encoder)
BITRATE = '64k'     # CBR mono mp3: 8000 bytes/s
WIND_DB = 15.0      # mountain wind: RMS level below the music (dB)
SEEDS = {'meadow': 9101, 'mountain': 9103}
TAU = 2 * math.pi
TABLE = 8192        # wavetable size (power of 2)
MASK = TABLE - 1
HERE = os.path.dirname(os.path.abspath(__file__))

# ------------------------------------------------------------------ bird settings (meadow)
# CC0 Freesound recordings, hq previews copied as freesound_<id>.mp3 into --birds.
BIRD_SOURCES = {
    568113: 'Spring Songbirds, RedHatCreator: continuous chorus, lows and mids already cleaned',
    116791: 'Blackbird 252, nigelcoop: solo blackbird, close phrases, background noise removed',
    725219: 'Robin song, Sacha.Julien: close robin, forest in southern France',
    513566: 'birdsong in moss valley, Laklop: distant thrush and blackbird',
}
# (source, start in the source in s, length in s, position in the loop in s, gain in dB).
# Layer 1 is uninterrupted: two long segments take turns and go around the loop (51.33 + 30 = 81.33, i.e. 28.0 after
# wrapping; 25 + 29.33 = 54.33, i.e. 1.0). Layer 2: soloists on top. Each excerpt is used once: nothing repeats.
# Starts and positions were chosen from the 2-8 kHz level per second, so the blackbird's silences (phrases one to two
# seconds apart) fall on the robin's phrases. Segment 4 enters at 26 s, before segment 1 ends at 28 s: entering at 28 s,
# their fades would touch and leave 0.75 s nearly silent in the 2-8 kHz band.
# Avoided in the sources: 725219 from 36 to 43 s (broadband noise) and after 100 s (visible noise processing); 513566
# before 80 s (too few phrases).
BIRD_PLAN = [
    (568113, 0.0, 30.0, 51.33, 0.0),
    (116791, 19.0, 29.33, 25.0, -1.0),
    (725219, 2.0, 20.0, 5.0, -3.0),
    (725219, 61.0, 28.0, 26.0, -3.0),
    (513566, 86.0, 22.0, 29.0, -5.0),
]
BIRD_FADE = 3.0        # s, fade in and out of each segment (constant power):
                       # long enough that no change of location is heard
BIRD_DB = 12.0         # RMS level of the birds below the music (dB): present in
                       # their band, where the music has almost nothing, without stepping in front of it
BIRD_HP = 1200.0       # Hz, 3-stage high-pass (36 dB/octave): removes wind and low background measured
                       # on the sources (up to -35 dB below 300 Hz) and keeps the songs (from 1.5 kHz up)
BIRD_LP = 9000.0       # Hz, low-pass: softens the brightest hiss and whistles
BIRD_MARGIN = 0.5      # s of source filtered before the segment, to discard the transient
BIRD_CEIL_DB = 12.0    # soft limiter (tanh, memoryless: loop stays intact) this many dB above
                       # the RMS level: an isolated call otherwise came out 21 dB above it


                       # by more than 1 dB, and base x 2 + intense must stay below full scale


# ------------------------------------------------------------------ tools

def zeros(n):
    return array.array('d', bytes(8 * n))


def mtof(m):
    return 440.0 * 2.0 ** ((m - 69) / 12.0)


def at(beat, bpm):
    """Time (quarter notes) to sample."""
    return int(round(beat * 60.0 / bpm * SR))


def scaled(x, g):
    return array.array('d', [v * g for v in x])


def summed(*xs):
    out = array.array('d', xs[0])
    for x in xs[1:]:
        out = array.array('d', map(add, out, x))
    return out


def rms(x):
    return math.sqrt(sum(v * v for v in x) / len(x))


def peak(x):
    return max(max(x), -min(x))


def mix(buf, start, src, gain=1.0):
    """Adds `src` to the circular buffer `buf` from `start` (wrapping to the beginning)."""
    n_buf, n = len(buf), len(src)
    pos, i = start % n_buf, 0
    while i < n:
        m = min(n - i, n_buf - pos)
        buf[pos:pos + m] = array.array('d', [a + gain * b for a, b in zip(buf[pos:pos + m], src[i:i + m])])
        i += m
        pos = 0


def noise(rng, n):
    return array.array('d', [rng.uniform(-1.0, 1.0) for _ in range(n)])


def wavetable(harmonics):
    """One period (TABLE points): sum of sines (rank, amplitude), peak normalised to 1."""
    t = zeros(TABLE)
    for n, a in harmonics:
        w = TAU * n / TABLE
        for i in range(TABLE):
            t[i] += a * math.sin(w * i)
    p = peak(t)
    return scaled(t, 1.0 / p)


def osc(tab, freq, dur, attack, release, amp=1.0, cents=0.0, vib_rate=0.0, vib_cents=0.0, vib_phase=0.0, phase=0.0):
    """Held note read from a wavetable: soft attack, held `dur` s, release `release` s."""
    n_on = max(1, int(dur * SR))
    n_rel = max(1, int(release * SR))
    n = n_on + n_rel
    na = max(1, min(n_on, int(attack * SR)))
    base = freq * 2.0 ** (cents / 1200.0) * TABLE / SR
    vr = TAU * vib_rate / SR
    vd = vib_cents / 1200.0 * math.log(2.0)
    out = zeros(n)
    ph = phase * TABLE
    inc = base
    for i in range(n):
        if vd and (i & 63) == 0:
            inc = base * math.exp(vd * math.sin(vr * i + vib_phase))
        if i < na:
            e = i / na
            e = e * e * (3.0 - 2.0 * e)
        elif i < n_on:
            e = 1.0
        else:
            r = 1.0 - (i - n_on) / n_rel
            e = r * r
        out[i] = amp * e * tab[int(ph) & MASK]
        ph += inc
    return out


def pluck(freq, partials, amp=1.0, attack=0.003, maxdur=7.0, floor=1e-3):
    """Struck or plucked note: partials (ratio, amplitude, decay constant in s)."""
    tmax = max(d for _, _, d in partials) * math.log(1.0 / floor)
    n = int(min(maxdur, tmax) * SR) + 2
    out = zeros(n)
    for r, a, d in partials:
        f = freq * r
        if f >= 0.45 * SR or a <= 0:
            continue
        w = TAU * f / SR
        k = math.exp(-1.0 / (d * SR))
        m = min(n, int(d * math.log(1.0 / floor) * SR) + 2)
        c1, c2 = 2.0 * k * math.cos(w), -k * k
        y2, y1 = 0.0, amp * a * k * math.sin(w)  # amp·a·k^i·sin(w·i), starting at 0
        out[1] += y1
        for i in range(2, m):
            y = c1 * y1 + c2 * y2
            out[i] += y
            y2, y1 = y1, y
    na = max(1, int(attack * SR))
    for i in range(min(na, n)):
        out[i] *= i / na
    nf = min(n, int(0.05 * SR))  # 50 ms soft ending (partials cut at -60 dB or at maxdur)
    for j in range(nf):
        out[n - 1 - j] *= j / nf
    return out


def _coefs(kind, f0, q):
    w0 = TAU * f0 / SR
    c, s = math.cos(w0), math.sin(w0)
    al = s / (2.0 * q)
    if kind == 'lp':
        b0, b1, b2 = (1 - c) / 2, 1 - c, (1 - c) / 2
    elif kind == 'hp':
        b0, b1, b2 = (1 + c) / 2, -(1 + c), (1 + c) / 2
    else:  # 'bp', 0 dB peak gain
        b0, b1, b2 = al, 0.0, -al
    a0 = 1 + al
    return b0 / a0, b1 / a0, b2 / a0, (-2 * c) / a0, (1 - al) / a0


def biquad(x, kind, f0, q=0.707, warm=1.0):
    """Biquad (RBJ). `warm` s: warm-up on the end of x (circular filter); 0: isolated signal."""
    b0, b1, b2, a1, a2 = _coefs(kind, f0, q)
    x1 = x2 = y1 = y2 = 0.0
    if warm:
        for v in x[len(x) - min(len(x), int(warm * SR)):]:
            y = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
            x2, x1, y2, y1 = x1, v, y1, y
    out = zeros(len(x))
    for i, v in enumerate(x):
        y = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, v, y1, y
        out[i] = y
    return out


def _comb(x, d, g):
    """y[n] = x[n] + g·y[n−d], in blocks of d samples."""
    n = len(x)
    y = array.array('d', x[:d])
    s = d
    while s < n:
        e = min(n, s + d)
        y.extend([a + g * b for a, b in zip(x[s:e], y[s - d:e - d])])
        s = e
    return y


def _allpass(x, d, g):
    """Schroeder all-pass: y[n] = −g·x[n] + x[n−d] + g·y[n−d]."""
    n = len(x)
    y = array.array('d', [-g * v for v in x[:d]])
    s = d
    while s < n:
        e = min(n, s + d)
        y.extend([-g * a + b + g * c for a, b, c in zip(x[s:e], x[s - d:e - d], y[s - d:e - d])])
        s = e
    return y


COMBS = (1557, 1617, 1491, 1422, 1277, 1356)  # Freeverb lengths (samples at 44.1 kHz)
ALLPASSES = (556, 441, 341)


def reverb(x, rt60=2.5, wet=0.4, tone=5000.0, predelay=0.02):
    """Circular reverb: two loop passes, second kept (steady state).
    `wet`: RMS level of the reverberated sound relative to the direct sound."""
    n = len(x)
    x2 = x + x
    acc = zeros(2 * n)
    for d in COMBS:
        acc = array.array('d', map(add, acc, _comb(x2, d, 10.0 ** (-3.0 * d / (rt60 * SR)))))
    for d in ALLPASSES:
        acc = _allpass(acc, d, 0.5)
    w = acc[n:]
    p = int(predelay * SR)
    w = w[n - p:] + w[:n - p]
    w = biquad(w, 'lp', tone, 0.707)
    rw = rms(w)
    return summed(x, scaled(w, wet * rms(x) / rw)) if rw > 0 else x


# ------------------------------------------------------------------ timbres

HARP = [(1, 1.0, 1.8), (2, 0.45, 1.0), (3, 0.22, 0.6), (4, 0.10, 0.4), (5, 0.05, 0.3), (6, 0.025, 0.22)]
CELESTA = [(1, 1.0, 1.3), (2, 0.3, 0.7), (3, 0.06, 0.35), (4, 0.1, 0.2), (5.4, 0.04, 0.05)]
GLOCK = [(1, 1.0, 1.1), (2.76, 0.4, 0.45), (5.4, 0.2, 0.22), (8.93, 0.1, 0.12)]
BASS = [(1, 1.0, 0.9), (2, 0.3, 0.5), (3, 0.1, 0.3)]


# ------------------------------------------------------------------ meadow

def meadow(rng):
    bpm = 72
    n = at(64, bpm)
    spb = 60.0 / bpm
    # (pad, arpeggio) per 2-bar chord: D, Bm, G, A, D/F#, G, Em, A
    chords = [
        ([50, 57, 62, 66], [62, 66, 69, 74]),
        ([47, 54, 59, 62], [59, 62, 66, 71]),
        ([43, 50, 59, 62], [55, 59, 62, 67]),
        ([45, 52, 57, 61], [57, 61, 64, 69]),
        ([42, 50, 57, 62], [54, 57, 62, 66]),
        ([43, 50, 55, 59], [55, 59, 62, 67]),
        ([40, 47, 55, 59], [52, 55, 59, 64]),
        ([45, 52, 57, 61], [57, 61, 64, 69]),
    ]
    melody = [(78, 76), (74, 78), (79, 78), (76, 73), (81, 78), (74, 79), (76, 79), (76, 73)]
    padtab = wavetable([(k, 1.0 / k ** 1.6) for k in range(1, 11)])
    pad = zeros(n)
    harp = zeros(n)
    for ci, (voicing, arp) in enumerate(chords):
        b0 = ci * 8
        for m in voicing:
            for cents in (-7.0, 7.0):
                mix(pad, at(b0, bpm), osc(padtab, mtof(m), 8 * spb, 2.2, 2.6, amp=0.10, cents=cents,
                                          vib_rate=0.25 + 0.2 * rng.random(), vib_cents=3.0,
                                          vib_phase=TAU * rng.random(), phase=rng.random()))
        if ci % 2 == 0:  # rising arpeggio every other chord, otherwise a single low note
            for k, m in enumerate(arp):
                mix(harp, at(b0 + k, bpm), pluck(mtof(m), HARP, amp=0.20 * (1 - 0.1 * k) * (0.9 + 0.2 * rng.random())))
        else:
            mix(harp, at(b0, bpm), pluck(mtof(arp[0] - 12), HARP, amp=0.22))
        m1, m2 = melody[ci]
        mix(harp, at(b0 + 4, bpm), pluck(mtof(m1), HARP, amp=0.26))
        mix(harp, at(b0 + 6, bpm), pluck(mtof(m2), HARP, amp=0.22))
    pad = biquad(pad, 'lp', 1600, 0.6)
    return {'music_meadow': reverb(summed(pad, harp), rt60=3.0, wet=0.5, tone=4500)}


def decode_source(path):
    """Audio file to mono samples at SR (ffmpeg, 32-bit float)."""
    raw = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', path, '-ac', '1', '-ar', str(SR),
                          '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    out = array.array('f')
    out.frombytes(raw)
    if sys.byteorder == 'big':
        out.byteswap()
    return out


def loud_level(x):
    """RMS level of the loudest 20% of the 0.25 s windows: the level of the sung phrase, which the silences
    between phrases do not change from one excerpt to another."""
    w = int(0.25 * SR)
    e = sorted(sum(v * v for v in x[i:i + w]) / w for i in range(0, len(x) - w + 1, w))
    top = e[int(0.8 * len(e)):]
    return math.sqrt(sum(top) / len(top))


def bird_layer(folder, music_rms, n):
    """Birds over the whole circular loop of n samples. No random draws: the music generator is untouched.
    Final RMS level = that of the music minus BIRD_DB."""
    sources = {}
    out = zeros(n)
    fade = int(BIRD_FADE * SR)
    for sid, start, length, pos, gain_db in BIRD_PLAN:
        if sid not in sources:
            path = os.path.join(folder, f'freesound_{sid}.mp3')
            if not os.path.isfile(path):
                sys.exit(f'meadow track: missing source {path} (see BIRD_SOURCES)')
            sources[sid] = decode_source(path)
        margin = int(BIRD_MARGIN * SR)
        i0, count = int(round(start * SR)), int(round(length * SR))
        seg = array.array('d', sources[sid][max(0, i0 - margin):i0 + count])
        if len(seg) < count:
            sys.exit(f'meadow track: source {sid} too short for segment {start} + {length} s')
        for _ in range(3):
            seg = biquad(seg, 'hp', BIRD_HP, 0.707, warm=0)
        seg = biquad(seg, 'lp', BIRD_LP, 0.707, warm=0)
        seg = seg[len(seg) - count:]
        seg = scaled(seg, 10.0 ** (gain_db / 20.0) / loud_level(seg))
        for i in range(fade):
            f = math.sin(0.5 * math.pi * i / fade)
            seg[i] *= f
            seg[count - 1 - i] *= f
        mix(out, int(round(pos * SR)), seg)
    target = music_rms * 10.0 ** (-BIRD_DB / 20.0)
    ceil = target * 10.0 ** (BIRD_CEIL_DB / 20.0)
    gain = target / rms(out)
    out = array.array('d', [ceil * math.tanh(v * gain / ceil) for v in out])
    return scaled(out, target / rms(out))


# ------------------------------------------------------------------ boss


def note_number(name):
    """'C#4' or 'Bb2' to MIDI number (C4 = 60)."""
    pitch = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}[name[0]]
    rest = name[1:]
    if rest[0] in '#b':
        pitch += 1 if rest[0] == '#' else -1
        rest = rest[1:]
    return 12 * (int(rest) + 1) + pitch


def curve(table, beat):
    """Interpolated value in a (beat, value) table."""
    for (b0, v0), (b1, v1) in zip(table, table[1:]):
        if b0 <= beat <= b1:
            return v0 + (v1 - v0) * (beat - b0) / (b1 - b0)
    return table[-1][1]


# ------------------------------------------------------------------ mountain

def jingles(rng, count=8):
    """Variants of a sleigh-bell hit: 4 bells offset by 0 to 18 ms and a high breath."""
    out = []
    for _ in range(count):
        x = zeros(int(0.3 * SR))
        for _b in range(4):
            f = rng.uniform(3500.0, 6000.0)
            g = pluck(f, [(1, 1.0, 0.09), (1.48, 0.6, 0.07), (2.1, 0.4, 0.05), (2.7, 0.25, 0.04)],
                      amp=rng.uniform(0.5, 1.0), attack=0.0008, maxdur=0.25)
            off = int(rng.uniform(0.0, 0.018) * SR)
            for i, v in enumerate(g):
                x[off + i] += v
        nn = int(0.06 * SR)
        ns = biquad(noise(rng, nn), 'hp', 6000, 0.7, warm=0)
        for i in range(nn):
            x[i] += 0.3 * ns[i] * math.exp(-i / (0.015 * SR))
        out.append(x)
    return out


def mountain(rng):
    bpm = 90
    n = at(72, bpm)
    spb = 60.0 / bpm
    # (pad, bass) per 2-bar chord of 3 beats: G Em C D | G Bm Em C | Am D7 G D
    chords = [
        ([55, 59, 62, 67], 43), ([52, 59, 64, 67], 40), ([48, 55, 60, 64], 36), ([50, 57, 62, 66], 38),
        ([55, 59, 62, 67], 43), ([47, 54, 59, 62], 35), ([52, 59, 64, 67], 40), ([48, 55, 60, 64], 36),
        ([45, 52, 57, 60], 33), ([50, 57, 60, 66], 38), ([55, 59, 62, 67], 43), ([50, 57, 62, 66], 38),
    ]
    # melody (beat in the chord, note, duration in beats), composed for Lost
    melody = [
        [(0, 83, 1), (1, 86, 1), (2, 83, 1), (3, 81, 1.5), (4.5, 79, 0.5), (5, 81, 1)],
        [(0, 83, 2), (2, 79, 1), (3, 76, 3)],
        [(0, 76, 1), (1, 79, 1), (2, 84, 1), (3, 83, 1.5), (4.5, 81, 0.5), (5, 79, 1)],
        [(0, 78, 2), (2, 81, 1), (3, 74, 3)],
        [(0, 79, 1), (1, 83, 1), (2, 86, 1), (3, 88, 2), (5, 86, 1)],
        [(0, 83, 1.5), (1.5, 81, 0.5), (2, 78, 1), (3, 74, 3)],
        [(0, 76, 1), (1, 79, 1), (2, 83, 1), (3, 81, 1), (4, 79, 1), (5, 78, 1)],
        [(0, 76, 3), (3, 79, 3)],
        [(0, 81, 1), (1, 84, 1), (2, 88, 1), (3, 86, 1.5), (4.5, 84, 0.5), (5, 83, 1)],
        [(0, 81, 2), (2, 78, 1), (3, 84, 3)],
        [(0, 83, 1), (1, 81, 1), (2, 79, 1), (3, 86, 3)],
        [(0, 78, 1), (1, 76, 1), (2, 78, 1), (3, 81, 2), (5, 74, 1)],
    ]
    padtab = wavetable([(k, 1.0 / k ** 1.4) for k in range(1, 9)])
    pad, keys, low = zeros(n), zeros(n), zeros(n)
    for ci, (voicing, root) in enumerate(chords):
        b0 = ci * 6
        for m in voicing:
            for cents in (-6.0, 6.0):
                mix(pad, at(b0, bpm), osc(padtab, mtof(m), 6 * spb, 1.2, 2.0, amp=0.10, cents=cents,
                                          vib_rate=0.3 + 0.2 * rng.random(), vib_cents=3.0,
                                          vib_phase=TAU * rng.random(), phase=rng.random()))
        for bar in range(2):
            mix(low, at(b0 + 3 * bar, bpm), pluck(mtof(root), BASS, amp=0.30, attack=0.004, maxdur=3.0))
            for k in (1, 2):  # music box: chord notes on beats 2 and 3
                mix(keys, at(b0 + 3 * bar + k, bpm), pluck(mtof(voicing[k] + 12), CELESTA, amp=0.07, maxdur=3.0))
        for beat, m, dur in melody[ci]:
            mix(keys, at(b0 + beat, bpm), pluck(mtof(m), CELESTA, amp=0.25 * (0.92 + 0.16 * rng.random()), maxdur=4.0))
            if ci >= 4:  # glockenspiel at the octave on the last two phrases
                mix(keys, at(b0 + beat, bpm), pluck(mtof(m + 12), GLOCK, amp=0.08, attack=0.001, maxdur=3.0))
    bells = zeros(n)
    variants = jingles(rng)
    for k in range(72 * 2):  # sleigh bells in eighth notes, accent on the first beat of each bar
        beat = 0.5 * k
        g = 1.2 if beat % 3 == 0 else (1.0 if beat == int(beat) else 0.55)
        mix(bells, at(beat, bpm), variants[rng.randrange(len(variants))], 0.16 * g)
    pad = biquad(pad, 'lp', 2600, 0.6)
    music = reverb(summed(pad, keys, low, bells), rt60=2.6, wet=0.45, tone=6000)
    # wind: low breath (band around 420 Hz) and whistle (1250 Hz) in slow gusts,
    # periodic over the loop (3, 5, 7 and 11 cycles per pass)
    p = [TAU * rng.random() for _ in range(4)]
    lo = biquad(biquad(noise(rng, n), 'bp', 420, 0.9), 'lp', 900, 0.7)
    hi = biquad(noise(rng, n), 'bp', 1250, 5.0)
    g1 = [0.55 + 0.30 * math.sin(TAU * 3 * i / n + p[0]) + 0.15 * math.sin(TAU * 7 * i / n + p[1]) for i in range(n)]
    g2 = [max(0.0, 0.2 + 0.5 * math.sin(TAU * 5 * i / n + p[2]) + 0.3 * math.sin(TAU * 11 * i / n + p[3])) ** 2 for i in range(n)]
    lo = array.array('d', [a * b for a, b in zip(lo, g1)])
    hi = array.array('d', [a * b for a, b in zip(hi, g2)])
    wind = summed(scaled(lo, 1.0 / rms(lo)), scaled(hi, 0.6 / rms(hi)))
    wind = scaled(wind, rms(music) * 10.0 ** (-WIND_DB / 20.0) / rms(wind))
    return {'music_mountain': summed(music, wind), '_mountain_music': music, '_mountain_wind': wind}


# ------------------------------------------------------------------ boss, version 5: dark requiem with a theme
# Combat music. Intent: epic, dramatic and menacing; choir, strings, percussion and organ; slow and heavy, then a
# relentless march from half of the boss's health, the same piece more densely scored; the piece evolves, with a
# reprise written into it. Hence no drum kit or synthetic orchestra hits, long notes, low register, large room,
# stereo; minor chords and open fifths, a major third only in E flat and in the dominant A7b9; full power at 12 s.
# The solo-voice lull launches the second phase.
# Beside the men's chant (`RQ_CHANT_D`) and the solo voice of the lull (`RQ_SOLO`), the piece has one theme, the
# Chartiste's (`CHARTISTE_THEME`): the slow phase only hints at its head with a distant solo cor anglais, so that the
# march can state it whole, choir and brass in unison, the first time it is heard in full.
#
# Four stereo files (`boss_v5`), read by Music.js:
#   music_boss_slow_intro   12 s rise (hit, men's chant, roll, first hint of the theme), played once;
#   music_boss_slow         96 s loop at 60 BPM: tutti with organ, chant (second hint of the theme), climax;
#   music_boss_march_intro  the solo-voice lull (16 s) that ends in a rise (strings at the march's sixteenth notes,
#                           brass entering one by one, rolls, reverse cymbal), then the march entry hit (5 s);
#   music_boss_march        85 s loop at 96 BPM: tutti marching on the organ, the theme sung by choir and brass
#                           (statement), a break that builds, the theme again enlarged with octaves and higher strings
#                           (reprise), descending chords (D minor, C minor, B flat minor, A, then the same with E flat).
RQ_SF = None        # path of the soundfont (FluidR3_GM.sf2), set by boss_v5
RQ_TAIL = 7.0       # s rendered after the last note of a slice (note and room decay)
RQ_REF = 0.1        # RMS level of a group at 0 dB, before the final level adjustment
RQ_CH = 1 << 16     # computation block size


def voic(text):
    return [note_number(x) for x in text.split()]


def amap(fn, *xs):
    """map by blocks: no large intermediate list."""
    out = array.array('d')
    for s in range(0, len(xs[0]), RQ_CH):
        out.extend(map(fn, *[x[s:s + RQ_CH] for x in xs]))
    return out


def rms_fast(x):
    return math.sqrt(sum(sum(map(mul, x[s:s + RQ_CH], x[s:s + RQ_CH])) for s in range(0, len(x), RQ_CH)) / len(x))


def active_rms(l, r, win=4410):
    """RMS level of loud passages: mean of the loudest tenth of the 0.1 s windows."""
    vals = []
    for s in range(0, len(l) - win, win):
        a, b = l[s:s + win], r[s:s + win]
        vals.append((sum(map(mul, a, a)) + sum(map(mul, b, b))) / (2 * win))
    vals.sort(reverse=True)
    k = max(1, len(vals) // 10)
    return math.sqrt(sum(vals[:k]) / k)

# ------------------------------------------------------------------ score

class RqPart:
    """An instrument: notes (beat, MIDI, duration in beats, velocity)."""

    def __init__(self, program, bank=0, pan=0.0, cents=0.0, vib=None):
        self.program, self.bank, self.pan, self.cents, self.vib = program, bank, pan, cents, vib
        self.notes = []

    def add(self, beat, midi, dur, v):
        if isinstance(midi, str):
            midi = note_number(midi)
        self.notes.append((float(beat), int(midi), float(dur), max(1, min(127, int(round(v))))))

    def chord(self, beat, notes, dur, v):
        for m in sorted(set(voic(notes) if isinstance(notes, str) else notes)):
            self.add(beat, m, dur, v)

    def line(self, beat, text, v, hold=0.97, shift=0):
        """`note:duration` items separated by spaces, R for a rest; v: number or function of the beat."""
        for item in text.split():
            name, d = item.split(':')
            d = float(Fraction(d))
            if name != 'R':
                self.add(beat, note_number(name) + shift, hold * d, v(beat) if callable(v) else v)
            beat += d
        return beat

    def roll(self, beat, length, note, v0, v1, step=0.125):
        k = max(1, int(round(length / step)))
        for i in range(k):
            self.add(beat + i * step, note, step * 0.9, v0 + (v1 - v0) * i / max(1, k - 1))


class RqGroup:
    def __init__(self, level, send, expr):
        self.level, self.send, self.expr, self.parts = level, send, expr, []

    def part(self, program, **kw):
        p = RqPart(program, **kw)
        self.parts.append(p)
        return p


class RqScore:
    def __init__(self, bpm, beats, wet=0.45, rt60=4.5, tone=4200.0):
        self.bpm, self.beats, self.wet, self.rt60, self.tone = bpm, beats, wet, rt60, tone
        self.groups = {}

    def group(self, name, level, send=1.0, expr=None):
        self.groups[name] = RqGroup(level, send, expr)
        return self.groups[name]

    def dyn(self, table):
        return lambda beat, d=0: max(1, min(127, curve(table, beat) + d))

    def sec(self, seconds):
        return seconds * self.bpm / 60.0


RQ_LEVELS = {'lows': -2, 'ostinato': -5, 'tremolo': -8, 'violins': -7, 'men': 0, 'women': -1, 'organ': -3,
          'brass': -4, 'timpani': -1, 'drum': 1, 'bell': -9, 'cymbal': -11, 'solo': -5,
          'herald': -12}    # herald: far under the choir (a sparse group is raised to its level)
HERALD_SEND = 1.6   # room send of the herald (1 = as the choir): more room than dry sound, so it sounds far away
HERALD_V_RISE = 76  # MIDI velocity (1-127) of the first hint, played over the rise
HERALD_V_CHANT = 58  # MIDI velocity of the second hint, softer: the chant under it is thinner than the rise
LULL_STRING_STEP = 0.15625   # beats between the string notes of the lull's rise at 60 BPM: 0.15625 s, the march's sixteenth note


def orchestra(sc, ex):
    """Instruments shared by all the scores, placed in space (pan from -1 left to +1 right)."""
    o = SimpleNamespace()
    g = sc.group('lows', RQ_LEVELS['lows'], expr=ex)
    o.cb, o.vc = g.part(43, pan=0.35), g.part(42, pan=0.2)
    g = sc.group('ostinato', RQ_LEVELS['ostinato'])
    o.ost, o.ostb = g.part(42, pan=0.2), g.part(43, pan=0.35)
    g = sc.group('tremolo', RQ_LEVELS['tremolo'], expr=ex)
    o.trem = g.part(44, pan=-0.2)
    g = sc.group('violins', RQ_LEVELS['violins'], expr=ex)
    o.vln, o.vln2 = g.part(48, pan=-0.35), g.part(48, pan=-0.2, cents=6)
    g = sc.group('men', RQ_LEVELS['men'], expr=ex)
    o.ma, o.mb, o.mo = g.part(52, pan=0.25, cents=-7), g.part(52, pan=-0.05, cents=7), g.part(53, pan=0.1)
    g = sc.group('women', RQ_LEVELS['women'], expr=ex)
    o.wa, o.wb, o.wo = g.part(52, pan=-0.25, cents=-7), g.part(52, pan=0.05, cents=7), g.part(53, pan=-0.1)
    g = sc.group('organ', RQ_LEVELS['organ'], expr=ex)
    o.org = g.part(19)
    g = sc.group('brass', RQ_LEVELS['brass'], expr=ex)
    o.hn, o.hn2 = g.part(60, pan=-0.15), g.part(60, pan=-0.3, cents=7)
    o.tb, o.tu = g.part(57, pan=0.25), g.part(58, pan=0.15)
    g = sc.group('timpani', RQ_LEVELS['timpani'])
    o.timp = g.part(47, pan=0.1)
    g = sc.group('drum', RQ_LEVELS['drum'], send=0.6)
    o.gc, o.taiko = g.part(48, bank=128), g.part(116, pan=-0.1)
    g = sc.group('bell', RQ_LEVELS['bell'])
    o.bell = g.part(14, pan=-0.1)
    g = sc.group('cymbal', RQ_LEVELS['cymbal'])
    o.crash, o.rev = g.part(48, bank=128), g.part(119)
    g = sc.group('solo', RQ_LEVELS['solo'])
    o.solo = g.part(53, vib=(5.3, 28.0, 0.35))
    # The cor anglais hints at the Chartiste's theme: a reedy, plaintive voice that the choir and the brass do not
    # cover, placed to the right and sent deep into the room so that it sounds far away.
    g = sc.group('herald', RQ_LEVELS['herald'], send=HERALD_SEND)
    o.herald = g.part(69, pan=0.4)
    return o


def timp_note(m):
    while m < 38:
        m += 12
    while m > 53:
        m -= 12
    return m


def bell_note(root):
    return 60 + root % 12


def riser(o, sc, target, seconds=2.5, v=100):
    """Reverse cymbal ending on `target`."""
    o.rev.add(target - sc.sec(seconds), 60, sc.sec(seconds), v)


def tutti(o, b0, root, five, w, vv, length=3.95, big=False):
    """Whole orchestra held on a chord: `five` five voices from low to high, `w` the women's voices."""
    pedal = ([root - 12] if root - 12 >= 24 else []) + [root]
    o.org.chord(b0, pedal + five + (w if big else []), length, vv - 8)
    for p in (o.ma, o.mb):
        p.chord(b0, five[:3] if big else five[:2], length, vv - 4)
    o.mo.add(b0, root if root >= 36 else root + 12, length, vv - 6)
    for p in (o.wa, o.wb):
        p.chord(b0, w, length, vv - 4)
    o.wo.add(b0, w[-1], length, vv - 6)
    o.hn.chord(b0, five[1:4], length, vv - 6)
    o.tb.chord(b0, five[:2], length, vv - 8)
    o.tu.add(b0, root, length, vv - 8)
    o.vc.add(b0, root + 12, length, vv - 8)
    o.trem.chord(b0, w, length, vv - 14)
    o.vln.add(b0, w[-1] + (0 if big else 12), length, vv - 12)
    if big:
        o.hn2.add(b0, w[-1] - 12, length, vv - 2)


def closing(o, sc, root, five, w):
    """Closing chord of the complete score (outside the loop)."""
    b = sc.beats
    tutti(o, b, root, five, w, 124, length=sc.sec(4.5), big=True)
    o.cb.add(b, root, sc.sec(4.5), 120)
    o.gc.add(b, 36, 1, 127)
    o.taiko.add(b, 40, 1, 127)
    o.timp.add(b, timp_note(root), 2, 127)
    o.crash.add(b, 57, sc.sec(4), 115)
    o.bell.add(b, bell_note(root), sc.sec(4), 110)

# ================================================================== first requiem score (D minor)
RQ = {  # chord: (bass, five voices from low to high); no third below D3
    'Dm': ('D2', 'D3 A3 D4 F4 A4'), 'Gm': ('G1', 'G2 D3 G3 Bb3 D4'), 'A7b9': ('A1', 'A2 G3 Bb3 C#4 E4'),
    'Eb': ('Eb2', 'Eb3 Bb3 Eb4 G4 Bb4'), 'Bbm': ('Bb1', 'Bb2 F3 Bb3 Db4 F4'), 'Eb/D': ('D2', 'D3 Bb3 Eb4 G4 Bb4'),
    'Dm/A': ('A1', 'A2 F3 A3 D4 F4'), 'Asus': ('A1', 'A2 E3 A3 D4 E4'), 'C#o/D': ('D2', 'D3 Bb3 C#4 E4 G4'),
}
RQ_SOLO = ['A4:3 Bb4:1', 'A4:2 F4:2', 'G4:3 Bb4:1', 'G4:2 E4:2']     # solo voice of the lull
# low-string ostinato, 8 eighth notes: pedal and semitone above, or root and fifth
RQ_PED = {'Dm': 38, 'Gm': 38, 'Eb/D': 38, 'C#o/D': 38, 'Dm/A': 45, 'A7b9': 45, 'Asus': 45}
RQ_ROOT = {'Eb': 39, 'Bbm': 46}
RQ_CELL, RQ_CELL_ROOT = [0, 0, 1, 0, 0, 0, -2, 0], [0, 0, 7, 0, 0, 0, -2, 0]


def rq_ostinato(o, b0, name, vv, hold, double):
    base, cell = (RQ_PED[name], RQ_CELL) if name in RQ_PED else (RQ_ROOT[name], RQ_CELL_ROOT)
    for k, off in enumerate(cell):
        acc = 12 if k == 0 else (6 if k % 2 == 0 else -8)
        o.ost.add(b0 + 0.5 * k, base + off, hold, vv + acc)
        if double:
            o.ostb.add(b0 + 0.5 * k, base + off, hold, vv + acc)


BRASS_HOLD = 0.9   # fraction of its length that a brass note sounds (the choir keeps 0.97): the gap sharpens the attack
STRING_STEP = 0.25     # beats between two sixteenth notes of the strings at 96 BPM (0.15625 s)


def score_march_phase():
    """The march: tutti hit, organ, the theme sung (statement), a break that builds, the theme again enlarged
    (reprise), then descending chords. Bars 0-1 hit, 2-9 organ, 10-17 statement, 18-19 break, 20-27 reprise,
    28-35 descending chords (`rq_sections`, ending)."""
    organ_bars, _, _, ending_bars = rq_sections()
    reprise_chords = THEME_CHORDS[:-1] + [REPRISE_LAST_BAR[0]]
    plan = ([('hit', 'Dm', None)] * 2 + organ_bars + [('statement', c, None) for c in THEME_CHORDS]
            + [('break', 'Dm', None), ('break', 'A5', None)] + [('reprise', c, None) for c in reprise_chords]
            + ending_bars)
    sc = RqScore(96, 144, wet=0.42, rt60=4.6)
    v = sc.dyn([(0, 124), (8, 120), (40, 112), (71.9, 124), (72, 72), (76, 82), (80, 122), (112, 124), (144, 127)])
    ex = [(0, 124), (8, 120), (40, 114), (71.5, 127), (72, 84), (79.5, 118), (80, 124), (144, 127)]
    o = orchestra(sc, ex)

    def marcato(b0, root, five, w, vv):
        pedal = ([root - 12] if root - 12 >= 24 else []) + [root]
        o.org.chord(b0, pedal + five + w, 3.95, vv - 8)
        for off, d, dv in ((0, 1.9, 0), (2, 1.9, -5)):
            for p in (o.ma, o.mb):
                p.chord(b0 + off, five[:3], d, vv - 3 + dv)
            o.mo.add(b0 + off, root if root >= 36 else root + 12, d, vv - 6 + dv)
            for p in (o.wa, o.wb):
                p.chord(b0 + off, w, d, vv - 3 + dv)
            o.wo.add(b0 + off, w[-1], d, vv - 6 + dv)
            o.hn.chord(b0 + off, five[1:4], d * 0.9, vv - 4 + dv)
            o.tb.chord(b0 + off, five[:2], d * 0.9, vv - 6 + dv)
            o.tu.add(b0 + off, root, d * 0.9, vv - 6 + dv)
            o.hn2.add(b0 + off, w[-1] - 12, d * 0.9, vv - 2 + dv)
        o.vc.add(b0, root + 12, 3.9, vv - 8)
        o.trem.chord(b0, w, 3.9, vv - 14)
        hammer(b0, w, vv - 12)

    def hammer(b0, upper, vq):
        """Violins: measured sixteenth notes on the two top voices of `upper`, the first of each beat accented."""
        for k in range(16):
            o.vln.add(b0 + STRING_STEP * k, upper[-1] if k % 4 != 2 else upper[-2], 0.2, vq + (8 if k % 4 == 0 else 0))

    def sing(p, b0, text, dv=0, shift=0, hold=0.97):
        """A part plays a theme bar `text` with the dynamics of the score offset by `dv`."""
        p.line(b0, text, lambda t: v(t, dv), hold=hold, shift=shift)

    for bar, (sec, name, women) in enumerate(plan):
        b0 = 4.0 * bar
        root, five = note_number(RQ[name][0]), voic(RQ[name][1])
        w = voic(women) if women else five[2:]
        vv = v(b0)
        tn, t5 = timp_note(root), timp_note(root + 7)
        o.cb.add(b0, root, 3.9, vv - 8)
        rq_ostinato(o, b0, name, vv - 2, 0.3, True)
        if sec != 'break':  # the march: bass drum on every beat, timpani
            for k in range(4):
                o.gc.add(b0 + k, 36, 0.5, vv + (8, -12, 0, -12)[k])
            o.taiko.add(b0, 40, 0.8, vv)
            o.taiko.add(b0 + 2, 40, 0.8, vv - 8)
            for off, note, dv in ((0, tn, 4), (1.5, tn, -14), (2, t5, -2), (3, tn, -8), (3.5, t5, -12)):
                o.timp.add(b0 + off, note, 0.45, vv + dv)
            for k in range(8):  # eighth-note drum, bell every bar
                if k not in (0, 4):
                    o.taiko.add(b0 + 0.5 * k, 40, 0.4, vv - (10 if k % 2 == 0 else 18))
            if sec != 'hit':
                o.bell.add(b0, bell_note(root), 3.5, 100)
        if sec == 'hit':
            if bar == 0:  # the entry hit: the large tutti (three men's voices, two horns, women in the organ)
                tutti(o, b0, root, five, w, vv, length=7.9, big=True)
                o.gc.add(b0, 36, 1, 127)
                o.crash.add(b0, 57, 6, 116)
                o.bell.add(b0, 62, 6, 108)
        elif sec in ('statement', 'reprise'):
            big = sec == 'reprise'
            i = bar - (20 if big else 10)
            text = REPRISE_LAST_BAR[1] if big and i == 7 else CHARTISTE_THEME[i]
            pedal = ([root - 12] if root - 12 >= 24 else []) + [root]
            hi = [m + 12 for m in five[2:]]   # upper voices an octave higher, for the strings
            o.org.chord(b0, pedal + five[:2] + (five[2:] if big else []), 3.95, vv - (8 if big else 10))
            for p in (o.ma, o.mb):   # the choir carries the theme: men as written, women an octave above
                sing(p, b0, text)
            sing(o.mo, b0, text, -4, -12)
            for p in (o.wa, o.wb) + ((o.wo,) if big else ()):
                sing(p, b0, text, -4 if p is not o.wo else -6, 12)
            sing(o.hn, b0, text, -6, hold=BRASS_HOLD)   # the brass double it in unison, for the attack
            sing(o.tb, b0, text, -8, hold=BRASS_HOLD)
            if big:   # reprise: horns also an octave up, tuba an octave under the men, violins above the women
                sing(o.hn2, b0, text, -8, 12, BRASS_HOLD)
                sing(o.tu, b0, text, -8, -12, BRASS_HOLD)
                sing(o.vln2, b0, text, -16, 24)
                o.vc.add(b0, root + 12, 3.9, vv - 8)
                hammer(b0, hi, vv - 12)
            else:     # statement: horns in unison, lighter accompaniment, hammered violins only in the second phrase
                sing(o.hn2, b0, text, -8, hold=BRASS_HOLD)
                o.tu.add(b0, root, 1.7, vv - 8)
                o.tu.add(b0 + 2, root, 1.7, vv - 14)
                if i >= 4:
                    hammer(b0, hi, vv - 22)
            o.trem.chord(b0, five[2:], 3.9, vv - (12 if big else 18))
            if i == 0 or (big and i == 4):
                o.crash.add(b0, 57, 3.5, 112 if big else 108)
            if i == 7:
                o.timp.roll(b0 + 2, 2, 45, 70 if big else 60, 127 if big else 122)
                if big:
                    o.gc.roll(b0 + 3, 1, 36, 70, 122, 0.25)
                riser(o, sc, b0 + 4)
        elif sec in ('organ', 'end'):
            first = {'organ': 2, 'end': 28}[sec]
            i = bar - first
            marcato(b0, root, five, w, vv)
            if i % 4 == 0:
                o.crash.add(b0, 57, 3.5, 112)
            if i == 7:
                o.timp.roll(b0 + 2, 2, 45, 70, 127)
                if sec == 'end':
                    o.gc.roll(b0 + 3, 1, 36, 70, 122, 0.25)
                    riser(o, sc, b0 + 4)
        else:  # break: everything stops but the ostinato, then the roll
            if bar == 18:
                o.gc.add(b0, 36, 1, vv)
                o.gc.add(b0 + 2, 36, 1, vv - 6)
                o.timp.add(b0, tn, 1, vv)
            else:
                o.timp.roll(b0, 4, 45, 40, 124)
                o.gc.roll(b0 + 2, 2, 36, 50, 116, 0.25)
                for p in (o.ma, o.mb, o.hn):
                    p.chord(b0, 'A2 E3', 3.9, 104)
                for p, note in ((o.vln, 'E5'), (o.vln2, 'A4')):   # the strings swell on the dominant into the reprise
                    p.roll(b0, 3.9, note, 40, 118, STRING_STEP)
                riser(o, sc, b0 + 4)
    closing(o, sc, note_number('D2'), voic(RQ['Dm'][1]), voic('D5 F5 A5'))
    return sc

# Dark colour, divine and ominous choir: no bright major chords (B flat minor, A minor, C minor; dominant as an open
# fifth; a major third only in E flat, the flat second of D, and in the dominant A7b9, kept dark by its flat ninth;
# descending chords at the end of the march), a 12 s rise then tutti, and the lull placed just before the march,
# which starts louder still.
RQ.update({'Am': ('A1', 'A2 E3 A3 C4 E4'), 'A5': ('A1', 'A2 E3 A3 E4 A4'), 'Cm': ('C2', 'C3 G3 C4 Eb4 G4')})
RQ_PED.update({'Am': 45, 'A5': 45})
RQ_ROOT['Cm'] = 48
RQ_CHANT_D = ['D3:3 E3:1', 'F3:2 E3:1 D3:1', 'F3:3 Gb3:1', 'F3:2 Db3:2', 'G3:3 A3:1', 'Bb3:2 A3:1 G3:1', 'A3:4',
              'A3:2 C#4:2']
# Theme of the Chartiste, the one theme of the boss music. D minor, 8 bars of 4 beats (20 s at the march's
# 96 BPM), one `RqPart.line` string per bar, written for the sampled choir: men sing it as written (D3-F4, a tenth),
# women an octave above, brass double it for the attack. Every note lasts a beat or more, because the choir samples
# attack slowly. Two phrases of 4 bars. The first answers the head with a rising fourth (A D E flat) and stops on D4
# over a suspended A chord, the dominant, as a question; the second repeats the head, climbs to F4 over B flat minor
# and falls through the leading tone C#4 and the flat ninth B flat to the dominant A, then drops a fifth to D3. The
# head (bars 0-1: D A B flat, then A) is the motif: the slow phase hints at it (`score_slow_phase`), the march states
# the whole theme and brings it back in its loop (`score_march_phase`). Chords that carry it, one per bar: Dm, Dm,
# Dm/A, Asus, Dm, Bbm, A7b9, Dm.
CHARTISTE_THEME = ['D3:2 A3:1 Bb3:1', 'A3:3 R:1', 'A3:2 D4:1 Eb4:1', 'D4:3 R:1',
                   'D3:2 A3:1 Bb3:1', 'Bb3:1 F4:2 Eb4:1', 'C#4:2 Bb3:1 A3:1', 'D3:3 R:1']
# The march sings the theme twice. The statement (march bars 10-17) puts it over the chords below; the reprise (bars
# 20-27) is the same bars with a last bar that stays on the dominant (A held, over A5) instead of dropping to D, so
# that the first chord of the descending chords after it (D minor) is the resolution.
THEME_CHORDS = ['Dm', 'Dm', 'Dm/A', 'Asus', 'Dm', 'Bbm', 'A7b9', 'Dm']
REPRISE_LAST_BAR = ('A5', 'A3:4')   # chord and note of the last bar of the reprise


def rq_sections():
    dom = 'A5'
    organ = [('organ', 'Dm', 'D4 F4 A4'), ('organ', 'Bbm', 'Db4 F4 Bb4'), ('organ', 'Am', 'E4 A4 C5'),
             ('organ', 'Dm', 'F4 A4 D5'), ('organ', 'Gm', 'G4 Bb4 D5'), ('organ', 'Eb', 'G4 Bb4 Eb5'),
             ('organ', 'Asus', 'A4 D5 E5'), ('organ', dom, 'E4 A4 E5')]
    chant = [('chant', c, w) for c, w in zip('Dm Dm Bbm Bbm Gm Gm A5 A7b9'.split(),
                                             [None, None, 'Db4 F4 Bb4', 'Db4 F4 Bb4', 'D4 G4 Bb4', 'D4 G4 Bb4',
                                              'E4 A4', 'C#4 E4 Bb4'])]
    climax = [('climax', 'Dm', 'A4 D5 F5'), ('climax', 'Bbm', 'Bb4 Db5 F5'), ('climax', 'Gm', 'Bb4 D5 G5'),
              ('climax', dom, 'E4 A4 E5'), ('climax', 'Bbm', 'Bb4 Db5 F5'), ('climax', 'Dm/A', 'D5 F5 A5'),
              ('climax', 'Eb', 'Eb5 G5 Bb5'), ('climax', dom, 'A4 E5 A5')]
    ending = [('end', 'Dm', 'A4 D5 F5'), ('end', 'Cm', 'G4 C5 Eb5'), ('end', 'Bbm', 'F4 Bb4 Db5'), ('end', dom, 'E4 A4 E5'),
           ('end', 'Dm', 'D5 F5 A5'), ('end', 'Cm', 'C5 Eb5 G5'), ('end', 'Eb', 'Bb4 Eb5 G5'), ('end', dom, 'A4 E5 A5')]
    return organ, chant, climax, ending


def score_slow_phase():
    """Slow phase: rise (12 s), tutti, chant, climax, then the solo-voice lull that launches the march."""
    sc = RqScore(60, 124, wet=0.5, rt60=5.0)
    v = sc.dyn([(0, 108), (8, 116), (12, 120), (43.9, 124), (44, 100), (75.9, 110), (76, 122), (107.9, 127),
                (108, 66), (120, 78), (124, 90)])
    ex = [(0, 100), (11.5, 124), (12, 116), (43.5, 127), (44, 98), (75.5, 114), (76, 120), (107.5, 127), (108, 76),
          (120, 86), (123.5, 112), (124, 112)]
    o = orchestra(sc, ex)
    organ_bars, chant_bars, climax_bars, _ = rq_sections()
    plan = ([('rise', 'Dm', None), ('rise', 'Dm', None), ('rise', 'A7b9', 'C#4 E4 Bb4')] + organ_bars + chant_bars + climax_bars
            + [('lull', c, None) for c in ('Dm', 'Dm', 'Eb/D', 'C#o/D')])
    rise = [RQ_CHANT_D[0], RQ_CHANT_D[1], RQ_CHANT_D[7]]

    def heartbeat(b0, note, vv):
        o.timp.add(b0, note, 1.5, vv)
        o.timp.add(b0 + 2.5, note, 0.4, vv - 28)
        o.timp.add(b0 + 3, note, 0.9, vv - 14)

    def psalm(b0, text):
        for p in (o.ma, o.mb):
            p.line(b0, text, v)
        o.mo.line(b0, text, lambda t: v(t, -4), shift=-12)

    for bar, (sec, name, women) in enumerate(plan):
        b0 = 4.0 * bar
        root, five = note_number(RQ[name][0]), voic(RQ[name][1])
        w = voic(women) if women else five[2:]
        vv = v(b0)
        tn, t5 = timp_note(root), timp_note(root + 7)
        low_pedal = ([root - 12] if root - 12 >= 24 else []) + [root]
        o.cb.add(b0, root, 3.95, vv - 8)
        if sec != 'lull' and bar > 0:
            rq_ostinato(o, b0, name, vv - (10 if sec in ('rise', 'chant') else 4), 0.42, sec != 'chant')
        if sec == 'rise':
            o.org.chord(b0, low_pedal + five[:2], 3.95, vv - 12)
            psalm(b0, rise[bar])
            o.vc.add(b0, root + 12, 3.95, vv - 10)
            o.trem.chord(b0, five[2:], 3.9, vv - 16)
            if bar == 0:
                o.gc.add(b0, 36, 1, 127)
                o.taiko.add(b0, 40, 1, 122)
                o.bell.add(b0, 62, 3.5, 104)
                heartbeat(b0, tn, vv + 10)
            else:
                o.wo.chord(b0, w, 3.9, vv - 12)
                o.hn.chord(b0, five[1:4], 3.9, vv - 10)
                o.tb.chord(b0, five[:2], 3.9, vv - 12)
                o.gc.add(b0, 36, 1, vv)
            if bar == 1:
                heartbeat(b0, tn, vv)
                # first hint: the head's first three notes, left hanging on B flat (a chord note of the next bar)
                o.herald.line(b0, CHARTISTE_THEME[0], HERALD_V_RISE, shift=12)
            if bar == 2:
                for p in (o.wa, o.wb):
                    p.chord(b0, w, 3.9, vv - 8)
                o.timp.roll(b0, 4, 45, 50, 124)
                o.gc.roll(b0 + 2, 2, 36, 50, 116, 0.25)
                riser(o, sc, b0 + 4)
        elif sec == 'organ':
            i = bar - 3
            tutti(o, b0, root, five, w, vv)
            for off, note, dv in ((0, tn, 2), (2, t5, -8), (3.5, tn, -14)):
                o.timp.add(b0 + off, note, 0.6, vv + dv)
            o.gc.add(b0, 36, 1, 127 if i % 4 == 0 else vv)
            if i % 4 == 0:
                o.crash.add(b0, 57, 3.5, 108)
                o.taiko.add(b0, 40, 1, 120)
                o.bell.add(b0, bell_note(root), 3.5, 100)
            if i == 7:
                o.timp.roll(b0 + 2, 2, 45, 60, 116)
        elif sec == 'chant':
            i = bar - 11
            o.org.chord(b0, low_pedal + five[:2], 3.95, vv - 12)
            o.vc.add(b0, root + 12, 3.95, vv - 10)
            psalm(b0, RQ_CHANT_D[i])
            o.trem.chord(b0, five[2:], 3.9, vv - 18)
            heartbeat(b0, tn, vv)
            o.wo.chord(b0, w, 3.9, vv - 12)
            if i == 0:  # second hint: the whole head, resolved on A, over the two D minor bars of the chant
                o.herald.line(b0, ' '.join(CHARTISTE_THEME[:2]), HERALD_V_CHANT, shift=12)
            if i % 2 == 0:
                o.gc.add(b0, 36, 1, vv + 4)
            if i % 4 == 0:
                o.bell.add(b0, bell_note(root), 3.5, 90)
            if i >= 4:
                for p in (o.wa, o.wb):
                    p.chord(b0, w, 3.9, vv - 8)
                o.hn.chord(b0, five[1:4], 3.9, vv - 8)
                o.tb.chord(b0, five[:2], 3.9, vv - 10)
            if i == 7:
                o.timp.roll(b0 + 2, 2, 45, 50, 122)
                riser(o, sc, b0 + 4)
        elif sec == 'climax':
            i = bar - 19
            tutti(o, b0, root, five, w, vv, big=True)
            for off, note, dv in ((0, tn, 6), (1.5, tn, -16), (2, t5, -4), (3, tn, -10), (3.5, tn, -14)):
                o.timp.add(b0 + off, note, 0.45, vv + dv)
            o.gc.add(b0, 36, 1, 127 if i % 4 == 0 else vv)
            o.gc.add(b0 + 2, 36, 1, vv - 10)
            o.bell.add(b0, bell_note(root), 3.5, 104)
            if i % 4 == 0:
                o.crash.add(b0, 57, 3.5, 114)
                o.taiko.add(b0, 40, 1, 124)
            if i == 7:
                o.timp.roll(b0 + 2, 2, 45, 70, 127)
                o.gc.roll(b0 + 3, 1, 36, 70, 120, 0.25)
        else:  # lull: solo voice, bell, then the roll that launches the march
            i = bar - 27
            o.org.chord(b0, [26, 38], 3.95, vv - 6)
            o.trem.chord(b0, 'A5 D6', 3.95, vv - 6)
            o.solo.line(b0, RQ_SOLO[i], 98)
            o.bell.add(b0, 62 if i % 2 == 0 else 57, 3.5, 84)
            o.timp.add(b0, 38, 1.5, vv - 6)
            o.timp.add(b0 + 3, 38, 0.9, vv - 16)
            if i == 3:  # the rise: strings take up the march's sixteenth notes, the brass enter one by one
                o.timp.roll(b0, 4, 38, 30, 122)
                o.gc.roll(b0 + 2, 2, 36, 40, 110, 0.25)
                for p in (o.ma, o.mb):
                    p.chord(b0, five[:2], 3.9, 92)
                for p, note in ((o.vln, 'C#5'), (o.vln2, 'E5')):
                    p.roll(b0, 3.9, note, 60, 127, LULL_STRING_STEP)
                for p, chord, off, vq in ((o.hn, five[1:4], 0, 84), (o.tb, five[:2], 1, 96), (o.tu, [root], 2, 108),
                                          (o.hn2, [m + 12 for m in five[1:4]], 3, 122)):
                    p.chord(b0 + off, chord, 3.9 - off, vq)
                for p in (o.wa, o.wb):   # the women join for the last two beats: the choir is whole when the hit falls
                    p.chord(b0 + 2, five[2:], 1.9, 104)
                riser(o, sc, b0 + 4)
    return sc

# ------------------------------------------------------------------ render

def bend(cents):
    return max(0, min(16383, int(round(8192 + cents / 200.0 * 8192))))


def clean(notes):
    """A note never overlaps itself on a channel: the previous one is shortened, a duplicate is removed."""
    out, last = [], {}
    for beat, m, dur, v in sorted(notes):
        j = last.get(m)
        if j is not None:
            pb, _, pd, pv = out[j]
            if abs(beat - pb) < 1e-9:
                out[j] = (pb, m, max(pd, dur), max(pv, v))
                continue
            if pb + pd > beat - 1e-9:
                out[j] = (pb, m, (beat - pb) * 0.98, pv)
        last[m] = len(out)
        out.append((beat, m, dur, v))
    return out


def render_group_st(tsf, g, bpm, beats, n, keep=None):
    """Renders a group in stereo over n samples, without folding. `keep` (lo, hi): only notes started in
    [lo, hi[ (beats) are played, to render a slice of the score."""
    synth = tsf.Synth(gain=0, samplerate=SR)
    sf = synth.sfload(RQ_SF, gain=0.0, max_voices=256)
    events = []
    for chan, p in enumerate(g.parts):
        synth.program_select(chan, sf, p.bank, p.program)
        synth.control_change(chan, 10, int(round(64 + 63 * p.pan)))
        synth.pitchbend(chan, bend(p.cents))
        for beat, m, dur, v in clean(p.notes):
            if keep and not keep[0] <= beat < keep[1]:
                continue
            s0, s1 = at(beat, bpm), at(beat + dur, bpm)
            events.append((s0, 1, chan, m, v))
            events.append((s1, 0, chan, m, 0))
            if p.vib:  # vibrato through the pitch wheel, settling in after `delay` s
                rate, depth, delay = p.vib
                for i in range(int((s1 - s0) / (0.01 * SR))):
                    t = i * 0.01
                    grow = min(1.0, max(0.0, (t - delay) / 0.5))
                    events.append((s0 + int(t * SR), 2, chan, bend(p.cents + depth * grow * math.sin(TAU * rate * t)), 0))
        if g.expr:
            for k in range(int(beats * 4) + 1):
                events.append((at(0.25 * k, bpm), -1, chan, 11, int(round(curve(g.expr, 0.25 * k)))))
    events.sort()  # at the same position: expression, note ends, attacks, pitch wheel
    data = array.array('f')
    pos = 0
    for sample, kind, chan, a, b in events:
        if sample >= n:
            break
        if sample > pos:
            data.frombytes(bytes(synth.generate(sample - pos)))
            pos = sample
        if kind == 1:
            synth.noteon(chan, a, b)
        elif kind == 0:
            synth.noteoff(chan, a)
        elif kind == 2:
            synth.pitchbend(chan, a)
        else:
            synth.control_change(chan, a, b)
    data.frombytes(bytes(synth.generate(n - pos)))
    if sys.byteorder == 'big':
        data.byteswap()
    return array.array('d', data[0::2]), array.array('d', data[1::2])


HALL_COMBS = (1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617)   # Freeverb lengths (samples at 44.1 kHz)
HALL_ALLPASSES = (556, 441, 341, 225)


def comb_damped(x, d, g, damp):
    """y[n] = x[n] + g·f[n−d], f = one-pole low-pass of y: highs die faster, as in a hall."""
    n = len(x)
    y = array.array('d', x[:d])
    prev = 0.0
    step = lambda p, c: c + damp * (p - c)
    s = d
    while s < n:
        e = min(n, s + d)
        f = list(accumulate(y[s - d:e - d], step, initial=prev))
        prev = f[-1]
        y.extend([a + g * b for a, b in zip(x[s:e], f[1:])])
        s = e
    return y


def hall(x, rt60, tone, spread=0, damp=0.25, predelay=0.03):
    """Reverberated sound only (large hall), linear; `spread` shifts the lengths for the other ear."""
    n = len(x)
    acc = zeros(n)
    for d in HALL_COMBS:
        d += spread
        acc = amap(add, acc, comb_damped(x, d, 10.0 ** (-3.0 * d / (rt60 * SR)), damp))
    for d in HALL_ALLPASSES:
        acc = _allpass(acc, d + spread, 0.5)
    p = int(predelay * SR)
    acc = zeros(p) + acc[:n - p]
    return biquad(acc, 'lp', tone, 0.707, warm=0)

def write_wav_st(path, l, r):
    n = len(l)
    pcm = array.array('h', bytes(4 * n))
    conv = lambda u: max(-32767, min(32767, int(round(u * 32767.0))))
    for s in range(0, n, RQ_CH):
        e = min(n, s + RQ_CH)
        pcm[2 * s:2 * e:2] = array.array('h', map(conv, l[s:e]))
        pcm[2 * s + 1:2 * e:2] = array.array('h', map(conv, r[s:e]))
    if sys.byteorder == 'big':
        pcm.byteswap()
    with wave.open(path, 'wb') as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes(pcm.tobytes())


# ---- boss, version 5: from scores to game files
V5_BITRATE = '96k'    # stereo mp3
V5_BOOST_DB = 1.5     # the march sounds at least this much above the loud passages of the slow phase
V5_DRIVE = 1.5        # soft saturation (memoryless tanh: loops stay intact)
V5_PEAK_DB = -1.0     # peak of slow phase and march together, before encoding


def rq_dry(tsf, sc, n, gains=None, keep=None):
    """Direct sound and room send of a score (stereo, n samples). Without `gains`, each group is set to its level
    (`level`, from its loud passages) and the gains are returned; with `gains`, they are reused as is (slice `keep`
    of an already balanced score)."""
    dry, send, used = [zeros(n), zeros(n)], [zeros(n), zeros(n)], {}
    for name, g in sc.groups.items():
        starts = [b for p in g.parts for b, _, _, _ in p.notes]
        if not starts or (keep and not any(keep[0] <= b < keep[1] for b in starts)):
            continue
        if gains is not None and name not in gains:
            continue
        chans = render_group_st(tsf, g, sc.bpm, sc.beats, n, keep)
        if gains is None:
            a = active_rms(*chans)
            if a <= 0:
                continue
            k = RQ_REF * 10.0 ** (g.level / 20.0) / a
        else:
            k = gains[name]
        used[name] = k
        for c, x in enumerate(chans):
            x = amap(k.__mul__, x)
            dry[c] = amap(add, dry[c], x)
            send[c] = amap(add, send[c], amap(g.send.__mul__, x) if g.send != 1.0 else x)
    return dry, send, used


def rq_wet(send, sc):
    return [hall(biquad(send[c], 'hp', 110.0, 0.707, warm=0), sc.rt60, sc.tone, spread=23 * c) for c in range(2)]


def rq_full(tsf, sc):
    """Whole score: (stereo mix, gain of each group, room gain)."""
    n = at(sc.beats, sc.bpm) + int(RQ_TAIL * SR)
    dry, send, gains = rq_dry(tsf, sc, n)
    wet = rq_wet(send, sc)
    kw = sc.wet * math.sqrt((rms_fast(dry[0]) ** 2 + rms_fast(dry[1]) ** 2)
                            / (rms_fast(wet[0]) ** 2 + rms_fast(wet[1]) ** 2))
    return [amap(lambda u, w: u + kw * w, dry[c], wet[c]) for c in range(2)], gains, kw


def rq_segment(tsf, sc, gains, kw, lo, hi, scale=1.0):
    """Slice [lo, hi[ (beats) of a score balanced by `rq_full`, including a tail of RQ_TAIL s."""
    i0, i1 = at(lo, sc.bpm), at(hi, sc.bpm) + int(RQ_TAIL * SR)
    dry, send, _ = rq_dry(tsf, sc, i1, gains, (lo, hi))
    dry, send = [x[i0:] for x in dry], [x[i0:] for x in send]
    wet = rq_wet(send, sc)
    k2 = kw * scale
    return [biquad(amap(lambda u, w: scale * u + k2 * w, dry[c], wet[c]), 'hp', 28.0, 0.707, warm=0) for c in range(2)]


def rq_fold(x, n):
    """Circular loop of n samples: the tail comes back onto the start."""
    out, tail = x[:n], x[n:]
    out[:len(tail)] = amap(add, out[:len(tail)], tail)
    return out


def encode_st(wav_path, mp3_path):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', wav_path,
                    '-c:a', 'libmp3lame', '-b:a', V5_BITRATE, '-ac', '2', '-ar', str(SR),
                    '-map_metadata', '-1', '-id3v2_version', '0', mp3_path], check=True)


def boss_v5(args, work):
    """Writes the four version 5 files to args.out (wavs in `work`); deterministic render."""
    global RQ_SF
    if not os.path.isfile(args.soundfont):
        sys.exit(f'boss track: instrument bank not found at {args.soundfont}; run tools/setup_audio.sh or pass --soundfont')
    try:
        import tinysoundfont as tsf
    except ImportError:
        sys.exit('boss track: tinysoundfont module missing; run tools/setup_audio.sh, then use tools/.audio-env/bin/python3')
    RQ_SF = args.soundfont
    slow, march = score_slow_phase(), score_march_phase()
    # 1. Both complete scores: group gains, room level, march boost, overall peak.
    a, g1, kw1 = rq_full(tsf, slow)
    print('  full slow phase rendered', flush=True)
    b, g2, kw2 = rq_full(tsf, march)
    print('  full march rendered', flush=True)
    boost = max(1.0, active_rms(*a) * 10.0 ** (V5_BOOST_DB / 20.0) / active_rms(*b))
    n1 = at(slow.beats, slow.bpm)
    p = 0.0
    for c in range(2):
        x = zeros(n1 + len(b[c]))
        x[:len(a[c])] = a[c]
        x[n1:] = amap(lambda u, w: u + boost * w, x[n1:], b[c])
        p = max(p, peak(biquad(x, 'hp', 28.0, 0.707, warm=0)))
    del a, b
    print(f'  march raised by {20 * math.log10(boost):.2f} dB, overall peak {20 * math.log10(p):.2f} dB '
          '(before level adjustment)', flush=True)
    # 2. The slices: rise, slow loop, lull, march entry hit, march loop.
    intro1 = rq_segment(tsf, slow, g1, kw1, 0, 12)
    loop1 = [rq_fold(x, at(96, slow.bpm)) for x in rq_segment(tsf, slow, g1, kw1, 12, 108)]
    lull = rq_segment(tsf, slow, g1, kw1, 108, 124)
    hit = rq_segment(tsf, march, g2, kw2, 0, 8, boost)
    loop2 = [rq_fold(x, at(136, march.bpm)) for x in rq_segment(tsf, march, g2, kw2, 8, 144, boost)]
    nc = at(16, slow.bpm)
    intro2 = []
    for c in range(2):  # the lull, then the hit: the lull's tail passes under the hit
        x = zeros(nc + len(hit[c]))
        x[:len(lull[c])] = lull[c]
        x[nc:] = amap(add, x[nc:], hit[c])
        intro2.append(x)
    # 3. Common level adjustment, then files.
    g = 10.0 ** (V5_PEAK_DB / 20.0) / math.tanh(V5_DRIVE)
    files = [('music_boss_slow_intro', intro1, False), ('music_boss_slow', loop1, True),
             ('music_boss_march_intro', intro2, False), ('music_boss_march', loop2, True)]
    for name, chans, looped in files:
        chans = [amap(lambda u: g * math.tanh(V5_DRIVE * u / p), x) for x in chans]
        n = len(chans[0])
        if looped:
            chans = [framed(x) for x in chans]
        else:
            nf = int(0.3 * SR)   # faded end: the room tail is cut at RQ_TAIL s
            for x in chans:
                x[n - nf:] = array.array('d', [u * (nf - j) / nf for j, u in enumerate(x[n - nf:])])
        wav_path = os.path.join(work, name + '.wav')
        mp3_path = os.path.join(args.out, name + '.mp3')
        write_wav_st(wav_path, *chans)
        encode_st(wav_path, mp3_path)
        level = math.sqrt((rms_fast(chans[0]) ** 2 + rms_fast(chans[1]) ** 2) / 2)
        print(f'{name}: {"loop" if looped else "one-shot"} {n} samples ({n / SR:.6f} s), file {len(chans[0])} samples, '
              f'peak {20 * math.log10(max(peak(chans[0]), peak(chans[1]))):.2f} dB, average {20 * math.log10(level):.2f} dB, '
              f'mp3 {os.path.getsize(mp3_path)} bytes', flush=True)
    return {}


# ------------------------------------------------------------------ files

def write_wav(path, x):
    pcm = array.array('h', [max(-32767, min(32767, int(round(v * 32767.0)))) for v in x])
    if sys.byteorder == 'big':
        pcm.byteswap()
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def framed(x):
    """[PAD s of the end][loop][PAD s of the start]."""
    p = int(round(PAD * SR))
    return x[len(x) - p:] + x + x[:p]


def encode(wav_path, mp3_path):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', wav_path,
                    '-c:a', 'libmp3lame', '-b:a', BITRATE, '-ac', '1', '-ar', str(SR),
                    '-map_metadata', '-1', '-id3v2_version', '0', mp3_path], check=True)


def scaled_parts(fn, seed):
    """Scales the stems of a track together so that its mix peaks at PEAK_DB."""
    parts = fn(random.Random(seed))
    files = {k: v for k, v in parts.items() if not k.startswith('_')}
    total = summed(*files.values())
    g = 10.0 ** (PEAK_DB / 20.0) / peak(total)
    return {k: scaled(v, g) for k, v in parts.items()}


def meadow_parts(args):
    """Music at its original scale (computed on its own), then birds added."""
    if not args.birds or not os.path.isdir(args.birds):
        sys.exit('meadow track: --birds DIR required (freesound_<id>.mp3, see BIRD_SOURCES)')
    music = scaled_parts(meadow, SEEDS['meadow'])['music_meadow']
    birds = bird_layer(args.birds, rms(music), len(music))
    return {'music_meadow': summed(music, birds), '_meadow_music': music, '_meadow_birds': birds}


# track name -> function (args, work) returning the stems and files to write (the boss track writes its own files)
TRACKS = {
    'meadow': lambda args, work: meadow_parts(args),
    'boss': boss_v5,
    'mountain': lambda args, work: scaled_parts(mountain, SEEDS['mountain']),
}


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--out', default=os.path.join(HERE, '..', 'public', 'sounds'))
    ap.add_argument('--work', default=None)
    ap.add_argument('--only', default='meadow,boss')
    ap.add_argument('--birds', default=None, help='folder of the freesound_<id>.mp3 sources (meadow track)')
    ap.add_argument('--soundfont', default=os.path.join(HERE, '.audio-env', 'FluidR3_GM.sf2'), help='instrument bank (boss track)')
    args = ap.parse_args()
    names = args.only.split(',')
    for name in names:
        if name not in TRACKS:
            sys.exit(f'unknown track: {name} (tracks: {", ".join(TRACKS)})')
    work = args.work or tempfile.mkdtemp(prefix='lost_music_')
    os.makedirs(work, exist_ok=True)
    os.makedirs(args.out, exist_ok=True)
    for name in names:
        parts = TRACKS[name](args, work)
        for key, sig in parts.items():
            sig = framed(sig)
            wav_path = os.path.join(work, key.lstrip('_') + '.wav')
            write_wav(wav_path, sig)
            line = f'{key.lstrip("_")}: loop {len(sig) - 2 * int(round(PAD * SR))} samples ' \
                   f'({(len(sig) / SR - 2 * PAD):.6f} s), file {len(sig)} samples, wav {wav_path}'
            if not key.startswith('_'):
                mp3_path = os.path.join(args.out, key + '.mp3')
                encode(wav_path, mp3_path)
                line += f', mp3 {os.path.getsize(mp3_path)} bytes'
            print(line, flush=True)


if __name__ == '__main__':
    main()
