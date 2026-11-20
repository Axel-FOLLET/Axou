"""Shared synthesis helpers for the sounds of the 2D game (standard library only).

Copied from the sound tools of the Lost game of the same repository (02_games/Lost/tools/render_music.py and
render_sfx.py), unchanged except for the module prefix. Mono signals are array('d') of floats in [-1, 1] at SR Hz;
stereo signals are pairs (left, right). write_wav and write_wav_st write 16-bit PCM wavs; ffmpeg encodes the mp3.
"""
import array
import math
import sys
import wave
from itertools import accumulate
from operator import add, mul

SR = 44100
TAU = 2 * math.pi
TABLE = 8192        # wavetable size (power of 2)
MASK = TABLE - 1
RQ_CH = 1 << 16     # samples converted per slice in write_wav_st
PEAK_DB = -1.0      # peak reached by finish() (dBFS)
COMBS = (1557, 1617, 1491, 1422, 1277, 1356)  # Freeverb lengths (samples at 44.1 kHz)
ALLPASSES = (556, 441, 341)
# Partials (ratio, amplitude, decay in s) for pluck:
HARP = [(1, 1.0, 1.8), (2, 0.45, 1.0), (3, 0.22, 0.6), (4, 0.10, 0.4), (5, 0.05, 0.3), (6, 0.025, 0.22)]
CELESTA = [(1, 1.0, 1.3), (2, 0.3, 0.7), (3, 0.06, 0.35), (4, 0.1, 0.2), (5.4, 0.04, 0.05)]
GLOCK = [(1, 1.0, 1.1), (2.76, 0.4, 0.45), (5.4, 0.2, 0.22), (8.93, 0.1, 0.12)]
BASS = [(1, 1.0, 0.9), (2, 0.3, 0.5), (3, 0.1, 0.3)]


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


def write_wav(path, x):
    pcm = array.array('h', [max(-32767, min(32767, int(round(v * 32767.0)))) for v in x])
    if sys.byteorder == 'big':
        pcm.byteswap()
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


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


def expi(a, b, k):
    """Exponential interpolation from a (k = 0) to b (k = 1): a pitch glide that sounds even."""
    return a * (b / a) ** k


def put(buf, t, src, gain=1.0):
    """Adds `src` to `buf` from t seconds on (anything past the end is lost)."""
    i0 = int(t * SR)
    m = min(len(src), len(buf) - i0)
    if m > 0:
        buf[i0:i0 + m] = array.array('d', [a + gain * b for a, b in zip(buf[i0:i0 + m], src[:m])])


def sweep(x, freq, q, mode='bp'):
    """State-variable filter whose frequency follows `freq(i)` (Hz); q: band sharpness."""
    low = band = 0.0
    damp = 1.0 / q
    out = zeros(len(x))
    for i, v in enumerate(x):
        f = 2.0 * math.sin(math.pi * min(freq(i), 7000.0) / SR)
        low += f * band
        high = v - low - damp * band
        band += f * high
        out[i] = band if mode == 'bp' else (low if mode == 'lp' else high)
    return out


def thud(f0, f1, glide, tau, dur, drive=1.0):
    """Thud: sine whose pitch falls from f0 to f1 (time constant `glide` s), fading over `tau` s."""
    n = int(dur * SR)
    out = zeros(n)
    ph = 0.0
    for i in range(n):
        t = i / SR
        ph += TAU * (f1 + (f0 - f1) * math.exp(-t / glide)) / SR
        a = min(1.0, t / 0.002) * math.exp(-t / tau)
        out[i] = math.tanh(drive * a * math.sin(ph)) / math.tanh(drive)
    return out


def burst(rng, dur, tau, attack=0.001):
    """White noise fading over `tau` s."""
    n = int(dur * SR)
    return array.array('d', [rng.uniform(-1.0, 1.0) * min(1.0, i / (attack * SR)) * math.exp(-i / (tau * SR))
                             for i in range(n)])


def bump(n, peak, rise=2.2, fall=3.0):
    """Whoosh envelope: rises to `peak` (fraction of the duration), then falls."""
    out = zeros(n)
    p = max(1, int(peak * n))
    for i in range(n):
        out[i] = (i / p) ** rise if i < p else (1.0 - (i - p) / max(1, n - p)) ** fall
    return out


def shaped(x, env):
    return array.array('d', [a * b for a, b in zip(x, env)])


def whoosh(rng, dur, f0, f1, f2, q, peak, flutter=0.0, flutter_hz=28.0):
    """Whoosh: noise in a band gliding from f0 to f1 (at its loudest), then to f2; `flutter`: beating."""
    n = int(dur * SR)
    p = max(1, int(peak * n))
    freq = lambda i: expi(f0, f1, i / p) if i < p else expi(f1, f2, (i - p) / max(1, n - p))  # noqa: E731
    x = sweep(noise(rng, n), freq, q)
    env = bump(n, peak)
    if flutter:
        env = array.array('d', [e * (1.0 - flutter * (0.5 + 0.5 * math.sin(TAU * flutter_hz * i / SR)))
                                for i, e in enumerate(env)])
    return shaped(x, env)


def drop(rng, f0, f1, dur):
    """A drop: brief sine with rising pitch (a closing bubble)."""
    n = int(dur * SR)
    out = zeros(n)
    ph = 0.0
    for i in range(n):
        k = i / n
        ph += TAU * expi(f0, f1, k) / SR
        out[i] = math.sin(ph) * math.sin(math.pi * k) ** 2
    return out


def crackle(rng, dur, rate, tau, lo=2600.0):
    """Crackle: high noise (above `lo` Hz) chopped into small bursts, `rate` per second, fading over `tau` s."""
    n = int(dur * SR)
    hiss = biquad(noise(rng, n), 'hp', lo, 0.7, warm=0)
    level, env = 0.0, zeros(n)
    for i in range(n):
        if rng.random() < rate / SR:
            level = rng.uniform(0.4, 1.0)
        level *= 0.9988
        env[i] = level * math.exp(-i / (tau * SR))
    return shaped(hiss, env)


def bubble(rng, f, dur):
    """Lava bubble: low blop with rising pitch, small dull pop when it bursts."""
    out = drop(rng, f, f * rng.uniform(1.7, 2.4), dur) + zeros(int(0.03 * SR))
    put(out, 0.85 * dur, biquad(burst(rng, 0.03, 0.006), 'lp', 900, 0.7, warm=0), 0.35)
    return out


def room(x, rt60, wet, tail, tone=5000.0):
    """Small room, linear: `tail` s added for the decay."""
    x = x + zeros(int(tail * SR))
    acc = zeros(len(x))
    for d in COMBS:
        acc = summed(acc, _comb(x, d, 10.0 ** (-3.0 * d / (rt60 * SR))))
    for d in ALLPASSES:
        acc = _allpass(acc, d, 0.5)
    acc = biquad(acc, 'lp', tone, 0.707, warm=0)
    rw = rms(acc)
    return summed(x, scaled(acc, wet * rms(x) / rw)) if rw > 0 else x


def finish(x, drive=1.4, fade=0.02):
    """Soft saturation, peak at PEAK_DB, faded end."""
    x = biquad(x, 'hp', 30.0, 0.707, warm=0)
    p = peak(x)
    g = 10.0 ** (PEAK_DB / 20.0) / math.tanh(drive)
    out = array.array('d', [g * math.tanh(drive * v / p) for v in x])
    nf = min(len(out), int(fade * SR))
    for j in range(nf):
        out[len(out) - 1 - j] *= j / nf
    return out
