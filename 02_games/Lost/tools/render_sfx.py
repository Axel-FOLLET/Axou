"""Lost combat sound effects: offline synthesis, then mp3.

Usage (WSL, from the Lost root):
  python3 -B tools/render_sfx.py [--out public/sounds] [--work DIR] [--only brush_air,phase2]

Heavy, realistic style (big wood, low impacts), all synthesised here with no recordings; the Chartiste's paint sounds
like lava. Only the standard library and the helpers of `render_music.py` (noise, filters, partials). Fixed seeds: two
runs give the same samples. ffmpeg (libmp3lame) encodes the wavs.

Files written to --out as `combat_<name>.mp3`, mono:
- `brush_air`     the giant brush cuts the air: low whoosh rising then falling, beating bristles;
- `brush_hit`  the brush hits the kitten: dull thud, wet slap;
- `brush_ground`     the brush hits the ground and misses: low blow, wood, falling debris;
- `lava_throw`        the Chartiste throws its paint: burning mass flying off, low roar, embers;
- `lava_land`     the paint lands: the lava crashes, rumbles, its bubbles burst, the ground sizzles;
- `lava_hit`     the kitten is caught in the paint: hissing burn, steam, bubbles;
- `phase2`          transition to phase 2: rise, then a big low hit and ringing metal;
- `claw_air`, `claw_hit`   the kitten's claw swipe, then the three claws catching;
- `sword_air`, `sword_hit`       the sword cuts the air, then slices: metal, impact.

The game varies the pitch of each playback (CombatSfx.js): one file per sound is enough.
The --work folder (temporary by default) receives the wavs.
"""
import argparse
import array
import math
import os
import random
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import render_music as rm  # noqa: E402

SR = rm.SR
TAU = rm.TAU
PEAK_DB = -1.0      # peak of each file before encoding; volumes are set in volumes.js
BITRATE = '96k'     # mono mp3: attacks stay crisp
SEED = 9201


# ------------------------------------------------------------------ tools

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
    out = rm.zeros(len(x))
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
    out = rm.zeros(n)
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
    out = rm.zeros(n)
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
    x = sweep(rm.noise(rng, n), freq, q)
    env = bump(n, peak)
    if flutter:
        env = array.array('d', [e * (1.0 - flutter * (0.5 + 0.5 * math.sin(TAU * flutter_hz * i / SR)))
                                for i, e in enumerate(env)])
    return shaped(x, env)


def drop(rng, f0, f1, dur):
    """A drop: brief sine with rising pitch (a closing bubble)."""
    n = int(dur * SR)
    out = rm.zeros(n)
    ph = 0.0
    for i in range(n):
        k = i / n
        ph += TAU * expi(f0, f1, k) / SR
        out[i] = math.sin(ph) * math.sin(math.pi * k) ** 2
    return out


def crackle(rng, dur, rate, tau, lo=2600.0):
    """Crackle: high noise (above `lo` Hz) chopped into small bursts, `rate` per second, fading over `tau` s."""
    n = int(dur * SR)
    hiss = rm.biquad(rm.noise(rng, n), 'hp', lo, 0.7, warm=0)
    level, env = 0.0, rm.zeros(n)
    for i in range(n):
        if rng.random() < rate / SR:
            level = rng.uniform(0.4, 1.0)
        level *= 0.9988
        env[i] = level * math.exp(-i / (tau * SR))
    return shaped(hiss, env)


def bubble(rng, f, dur):
    """Lava bubble: low blop with rising pitch, small dull pop when it bursts."""
    out = drop(rng, f, f * rng.uniform(1.7, 2.4), dur) + rm.zeros(int(0.03 * SR))
    put(out, 0.85 * dur, rm.biquad(burst(rng, 0.03, 0.006), 'lp', 900, 0.7, warm=0), 0.35)
    return out


def room(x, rt60, wet, tail, tone=5000.0):
    """Small room, linear: `tail` s added for the decay."""
    x = x + rm.zeros(int(tail * SR))
    acc = rm.zeros(len(x))
    for d in rm.COMBS:
        acc = rm.summed(acc, rm._comb(x, d, 10.0 ** (-3.0 * d / (rt60 * SR))))
    for d in rm.ALLPASSES:
        acc = rm._allpass(acc, d, 0.5)
    acc = rm.biquad(acc, 'lp', tone, 0.707, warm=0)
    rw = rm.rms(acc)
    return rm.summed(x, rm.scaled(acc, wet * rm.rms(x) / rw)) if rw > 0 else x


def finish(x, drive=1.4, fade=0.02):
    """Soft saturation, peak at PEAK_DB, faded end."""
    x = rm.biquad(x, 'hp', 30.0, 0.707, warm=0)
    p = rm.peak(x)
    g = 10.0 ** (PEAK_DB / 20.0) / math.tanh(drive)
    out = array.array('d', [g * math.tanh(drive * v / p) for v in x])
    nf = min(len(out), int(fade * SR))
    for j in range(nf):
        out[len(out) - 1 - j] *= j / nf
    return out


# ------------------------------------------------------------------ the Chartiste

def brush_air(rng):
    """0.8 s, loudest at 0.42 s: play it 0.42 s before the impact."""
    x = rm.zeros(int(0.8 * SR))
    put(x, 0.0, whoosh(rng, 0.8, 140, 950, 260, 0.9, 0.52, flutter=0.35), 1.0)       # handle and air mass
    put(x, 0.05, whoosh(rng, 0.7, 500, 2600, 900, 1.6, 0.52, flutter=0.5, flutter_hz=41.0), 0.35)  # bristles
    low = shaped(rm.biquad(rm.noise(rng, int(0.8 * SR)), 'lp', 110, 0.8, warm=0), bump(int(0.8 * SR), 0.55))
    put(x, 0.0, low, 2.2)                                                            # weight, below 110 Hz
    return finish(room(x, 0.7, 0.18, 0.5))


def brush_hit(rng):
    x = rm.zeros(int(0.6 * SR))
    put(x, 0.0, thud(120, 46, 0.035, 0.17, 0.6, drive=2.2), 1.0)                     # impact
    put(x, 0.0, rm.biquad(burst(rng, 0.3, 0.045), 'lp', 1700, 0.7, warm=0), 0.8)     # slap
    wet = sweep(burst(rng, 0.35, 0.11), lambda i: expi(900, 380, min(1.0, i / (0.3 * SR))), 3.0)
    wet = array.array('d', [v * (0.6 + 0.4 * math.sin(TAU * 63 * i / SR)) for i, v in enumerate(wet)])
    put(x, 0.012, wet, 0.9)                                                          # crushed paint
    return finish(room(x, 0.6, 0.2, 0.4), drive=1.8)


def brush_ground(rng):
    x = rm.zeros(int(1.0 * SR))
    put(x, 0.0, thud(85, 31, 0.06, 0.36, 1.0, drive=2.6), 1.0)                       # the ground takes the blow
    put(x, 0.0, rm.biquad(burst(rng, 0.2, 0.028), 'lp', 2600, 0.7, warm=0), 0.7)     # crack
    wood = rm.pluck(188.0, [(1.0, 1.0, 0.13), (1.72, 0.6, 0.09), (2.93, 0.4, 0.055), (4.4, 0.2, 0.035)],
                    amp=1.0, attack=0.001, maxdur=0.6)
    put(x, 0.0, wood, 0.45)                                                          # wooden handle
    for _ in range(16):                                                              # falling debris
        t = 0.06 + 0.6 * rng.random() ** 1.6
        tick = sweep(burst(rng, 0.05, 0.008 + 0.01 * rng.random()), lambda i, f=rng.uniform(900, 3200): f, 4.0)
        put(x, t, tick, 0.5 * (1.0 - t))
    return finish(room(x, 1.0, 0.24, 0.8), drive=1.8)


def lava_throw(rng):
    n = int(0.7 * SR)
    x = rm.zeros(n)
    put(x, 0.0, whoosh(rng, 0.7, 150, 700, 240, 0.8, 0.35, flutter=0.55, flutter_hz=23.0), 1.0)   # roaring fire
    put(x, 0.0, shaped(rm.biquad(rm.noise(rng, n), 'lp', 130, 0.8, warm=0), bump(n, 0.3)), 2.0)   # mass, below 130 Hz
    put(x, 0.0, thud(110, 48, 0.05, 0.14, 0.4, drive=1.6), 0.6)                      # tearing away
    put(x, 0.05, crackle(rng, 0.6, 500, 0.22), 0.5)                                  # embers
    for _ in range(5):                                                               # torn-off bubbles
        put(x, 0.08 + 0.4 * rng.random(), bubble(rng, rng.uniform(110, 240), rng.uniform(0.05, 0.09)), 0.35)
    return finish(room(x, 0.7, 0.18, 0.5))


def lava_land(rng):
    x = rm.zeros(int(1.3 * SR))
    put(x, 0.0, thud(80, 34, 0.05, 0.22, 0.8, drive=2.4), 1.0)                       # the mass crashes
    put(x, 0.0, rm.biquad(burst(rng, 0.35, 0.07), 'lp', 1100, 0.7, warm=0), 0.8)     # thick splash, no highs
    n = int(1.2 * SR)
    rumble = rm.biquad(rm.noise(rng, n), 'lp', 160, 0.8, warm=0)
    put(x, 0.0, shaped(rumble, [math.exp(-i / (0.45 * SR)) for i in range(n)]), 2.2)  # rumble
    for _ in range(11):                                                              # bubbles burst
        t = 0.1 + 0.9 * rng.random() ** 1.3
        put(x, t, bubble(rng, rng.uniform(75, 210), rng.uniform(0.07, 0.15)), 0.75 * (1.15 - t))
    put(x, 0.03, crackle(rng, 1.2, 420, 0.4), 0.7)                                   # the ground sizzles
    return finish(room(x, 0.9, 0.2, 0.7), drive=1.8)


def lava_hit(rng):
    x = rm.zeros(int(0.8 * SR))
    put(x, 0.0, crackle(rng, 0.8, 620, 0.28), 1.0)                                   # hissing burn
    steam = sweep(burst(rng, 0.5, 0.16), lambda i: expi(5200, 2600, min(1.0, i / (0.4 * SR))), 1.5)
    put(x, 0.0, steam, 0.7)                                                          # steam
    put(x, 0.0, thud(120, 55, 0.03, 0.09, 0.3, drive=1.6), 0.75)                     # impact
    for t in (0.06, 0.2, 0.33):                                                      # three bubbles
        put(x, t, bubble(rng, rng.uniform(120, 230), rng.uniform(0.06, 0.1)), 0.45)
    return finish(room(x, 0.5, 0.15, 0.3))


def phase2(rng):
    """3.6 s: 1.2 s rise, then the big hit."""
    hit = 1.2
    x = rm.zeros(int(3.6 * SR))
    n = int(hit * SR)
    rise = sweep(rm.noise(rng, n), lambda i: expi(180, 2600, i / n), 1.2)
    put(x, 0.0, array.array('d', [v * (i / n) ** 2.5 for i, v in enumerate(rise)]), 0.7)   # rising whoosh
    ph, sub = 0.0, rm.zeros(n)
    for i in range(n):
        ph += TAU * expi(38, 82, i / n) / SR
        sub[i] = math.sin(ph) * (i / n) ** 2
    put(x, 0.0, sub, 0.8)
    put(x, hit, thud(64, 27, 0.12, 0.85, 2.4, drive=3.0), 1.0)                       # the hit
    put(x, hit, rm.biquad(burst(rng, 0.8, 0.2), 'lp', 1500, 0.7, warm=0), 0.9)
    gong = rm.pluck(65.4, [(1.0, 1.0, 1.9), (1.48, 0.7, 1.5), (2.02, 0.6, 1.2), (2.71, 0.45, 0.9), (3.43, 0.35, 0.7),
                           (4.9, 0.25, 0.5), (6.3, 0.15, 0.35)], amp=1.0, attack=0.002, maxdur=2.4)
    put(x, hit, gong, 0.55)                                                          # ringing metal
    return finish(room(x, 2.0, 0.3, 1.2, tone=4000.0), drive=2.0, fade=0.3)


# ------------------------------------------------------------------ the kitten

def claw_air(rng):
    x = rm.zeros(int(0.22 * SR))
    for k in range(3):                                                               # three staggered claws
        put(x, 0.012 * k, whoosh(rng, 0.17, 1400, 5200, 2400, 2.2, 0.45), 1.0 - 0.15 * k)
    return finish(room(x, 0.35, 0.1, 0.2))


def claw_hit(rng):
    x = rm.zeros(int(0.3 * SR))
    for k in range(3):
        rip = sweep(burst(rng, 0.09, 0.022), lambda i, f=2100 + 500 * k: f * (1.0 - 0.3 * min(1.0, i / (0.08 * SR))), 2.5)
        put(x, 0.016 * k, rip, 1.0)                                                  # the claws catch
    put(x, 0.0, thud(170, 88, 0.02, 0.05, 0.25), 0.7)                                # the paw lands
    put(x, 0.0, rm.biquad(burst(rng, 0.15, 0.04), 'lp', 900, 0.7, warm=0), 0.5)      # fur
    return finish(room(x, 0.4, 0.12, 0.25))


def sword_air(rng):
    x = rm.zeros(int(0.36 * SR))
    put(x, 0.0, whoosh(rng, 0.34, 700, 3600, 1300, 3.0, 0.5), 1.0)                   # blade
    ring = rm.pluck(2480.0, [(1.0, 1.0, 0.12), (1.51, 0.5, 0.09), (2.27, 0.3, 0.06)], amp=1.0, attack=0.02, maxdur=0.3)
    put(x, 0.08, ring, 0.12)                                                         # a touch of metal
    return finish(room(x, 0.45, 0.12, 0.25))


def sword_hit(rng):
    x = rm.zeros(int(0.7 * SR))
    put(x, 0.0, thud(125, 58, 0.03, 0.1, 0.4, drive=1.8), 0.8)                       # the boss's mass
    put(x, 0.0, sweep(burst(rng, 0.12, 0.035), lambda i: expi(3600, 1500, min(1.0, i / (0.1 * SR))), 2.0), 0.9)
    clang = rm.pluck(1870.0, [(1.0, 1.0, 0.33), (1.52, 0.7, 0.26), (2.19, 0.5, 0.19), (2.83, 0.35, 0.14),
                              (3.71, 0.2, 0.1)], amp=1.0, attack=0.0008, maxdur=0.65)
    put(x, 0.0, clang, 0.5)                                                          # the blade rings
    return finish(room(x, 0.6, 0.16, 0.4), drive=1.6)


SOUNDS = {
    'brush_air': brush_air, 'brush_hit': brush_hit, 'brush_ground': brush_ground,
    'lava_throw': lava_throw, 'lava_land': lava_land, 'lava_hit': lava_hit,
    'phase2': phase2, 'claw_air': claw_air, 'claw_hit': claw_hit,
    'sword_air': sword_air, 'sword_hit': sword_hit,
}


def encode(wav_path, mp3_path):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', wav_path,
                    '-c:a', 'libmp3lame', '-b:a', BITRATE, '-ac', '1', '-ar', str(SR),
                    '-map_metadata', '-1', '-id3v2_version', '0', mp3_path], check=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--out', default=os.path.join(HERE, '..', 'public', 'sounds'))
    ap.add_argument('--work', default=None)
    ap.add_argument('--only', default=','.join(SOUNDS))
    args = ap.parse_args()
    names = args.only.split(',')
    for name in names:
        if name not in SOUNDS:
            sys.exit(f'unknown sound: {name} (sounds: {", ".join(SOUNDS)})')
    work = args.work or tempfile.mkdtemp(prefix='lost_sfx_')
    os.makedirs(work, exist_ok=True)
    os.makedirs(args.out, exist_ok=True)
    for k, name in enumerate(SOUNDS):
        if name not in names:
            continue
        x = SOUNDS[name](random.Random(SEED + k))
        wav_path = os.path.join(work, f'combat_{name}.wav')
        mp3_path = os.path.join(args.out, f'combat_{name}.mp3')
        rm.write_wav(wav_path, x)
        encode(wav_path, mp3_path)
        loud = max(range(len(x)), key=lambda i: abs(x[i])) / SR
        print(f'combat_{name}: {len(x) / SR:.3f} s, peak {20 * math.log10(rm.peak(x)):.1f} dB at {loud:.3f} s, '
              f'average {20 * math.log10(rm.rms(x)):.1f} dB, mp3 {os.path.getsize(mp3_path)} bytes', flush=True)


if __name__ == '__main__':
    main()
