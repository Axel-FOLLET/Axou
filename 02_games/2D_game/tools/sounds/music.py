"""Stereo music for the farm game. Python 3, synth.py and FFmpeg 5+."""
import math
import os
import random
import re
import subprocess
import sys
from array import array
from bisect import bisect_right
from functools import lru_cache
from itertools import accumulate
from operator import mul

import synth as s
from render_sounds import seed_of


SR = s.SR
HOP = 220
SOURCE = os.path.join(os.path.dirname(__file__), "sources", "musique-jour.m4a")
FFMPEG = ("ffmpeg", "-hide_banner", "-nostdin", "-nostats")
NIGHT_TEMPO = .875
SOURCE_BPM = 100.492
SOURCE_DOWNBEAT = 33.019


def _run(args, data=None):
    proc = subprocess.run(
        [*FFMPEG, *args], input=data, stdout=subprocess.PIPE,
        stderr=subprocess.PIPE, check=False,
    )
    if proc.returncode:
        raise RuntimeError(proc.stderr.decode("utf-8", "replace").strip())
    return proc


def _unpack(code, data):
    out = array(code)
    out.frombytes(data)
    if sys.byteorder != "little":
        out.byteswap()
    return out


def _wire(samples):
    if sys.byteorder != "little":
        samples = samples[:]
        samples.byteswap()
    return memoryview(samples).cast("B")


@lru_cache(maxsize=1)
def _source():
    proc = _run([
        "-v", "error", "-i", SOURCE, "-map", "0:a:0",
        "-af", f"aformat=sample_fmts=fltp,volume=0.5,aresample={SR}",
        "-ar", str(SR), "-ac", "2", "-c:a", "pcm_s16le", "-f", "s16le", "-",
    ])
    pcm = _unpack("h", proc.stdout)
    if len(pcm) % 2 or len(pcm) < 2 * 100 * SR:
        raise ValueError("Expected the full stereo day track in " + SOURCE)
    return pcm


def _raw_input(fmt):
    return ["-f", fmt, "-ar", str(SR), "-ac", "2", "-i", "pipe:0"]


def _filter(pcm, fmt, chain, rate=SR, channels=2):
    proc = _run([
        "-v", "error", *_raw_input(fmt), "-af", chain,
        "-ar", str(rate), "-ac", str(channels), "-c:a", "pcm_f32le",
        "-f", "f32le", "pipe:1",
    ], _wire(pcm))
    return _unpack("f", proc.stdout)


def _stereo(packed):
    return tuple(array("d", packed[k::2]) for k in (0, 1))


def _interleave(channels):
    left, right = channels
    out = array("f", [0]) * (2 * len(left))
    for i in range(0, len(left), 65536):
        j = min(len(left), i + 65536)
        out[2*i:2*j:2] = array("f", left[i:j])
        out[2*i+1:2*j:2] = array("f", right[i:j])
    return out


def _analysis(channels):
    left, right = channels
    level = []
    for i in range(0, len(left) - HOP + 1, HOP):
        a = left[i:i+HOP:5]
        b = right[i:i+HOP:5]
        power = (sum(map(mul, a, a)) + sum(map(mul, b, b))) / (2 * len(a))
        level.append(10 * math.log10(max(power, 1e-12)))
    rise = [0.0] * len(level)
    for i in range(3, len(level)):
        rise[i] = min(15.0, max(0.0, level[i] - sum(level[i-3:i]) / 3))
    return level, rise


def _match(level, rise, starts, min_length, max_length):
    width = round(2 * SR / HOP)
    half = round(.5 * SR / HOP)
    sums = [0.0, *accumulate(rise)]
    squares = [0.0, *accumulate(x*x for x in rise)]
    levels = [0.0, *accumulate(level)]
    best = None
    for start in starts:
        pattern = rise[start:start+width]
        mean = sum(pattern) / width
        pattern = [v - mean for v in pattern]
        norm = math.sqrt(sum(v*v for v in pattern))
        head_db = (levels[start+half] - levels[start]) / half
        lo = start + math.ceil(min_length * SR / HOP)
        hi = min(start + math.floor(max_length * SR / HOP), len(rise) - width)
        for end in range(lo, hi + 1):
            total = sums[end+width] - sums[end]
            var = squares[end+width] - squares[end] - total*total / width
            dot = sum(map(mul, pattern, rise[end:end+width]))
            corr = dot / max(1e-9, norm * math.sqrt(max(0.0, var)))
            tail_db = (levels[end] - levels[end-half]) / half
            score = corr - .025 * abs(head_db - tail_db)
            if best is None or score > best[0]:
                best = score, start * HOP, end * HOP
    if best is None:
        raise ValueError("The source is too short for the requested loop search")
    return best[1:]


def _splice(channels, start, end, day=False):
    result = []
    for channel in channels:
        loop = channel[start:end]
        n = len(channel) - end if day else min(round(.080 * SR), len(channel) - end)
        attack = min(n, round(.055 * SR)) if day else n
        for i in range(n):
            t = min(1.0, i / max(1, attack - 1))
            head = math.sin(.5 * math.pi * t)
            if day:
                tail = min(1.0, (n - 1 - i) / max(1, round(.050 * SR)))
            else:
                tail = math.cos(.5 * math.pi * t)
            loop[i] = channel[end+i] * tail + loop[i] * head
        result.append(loop)
    return tuple(result)


def _rotate(channels):
    n = len(channels[0])
    half = SR // 2

    def balance(k):
        energy = []
        for start in (k-half, k):
            energy.append(sum(c[i % n]**2 for c in channels
                              for i in range(start, start+half, 32)))
        return abs(10 * math.log10((energy[0]+1e-16)/(energy[1]+1e-16)))

    offsets = range(0, round(.40*SR), HOP)
    pivot = min(offsets, key=lambda k: max(0.0, balance(k)-3.0) + k/SR*.15)
    cut = min(range(pivot, pivot+HOP), key=lambda i:
              max(abs(c[i]-c[i-1]) for c in channels))
    out = tuple(c[cut:] + c[:cut] for c in channels) if cut else channels
    return out, cut


def _lufs(channels):
    proc = _run(["-v", "info", *_raw_input("f32le"),
                 "-af", "ebur128=framelog=verbose", "-f", "null", "-"],
                _wire(_interleave(channels)))
    summary = proc.stderr.decode("utf-8", "replace").rsplit("Summary:", 1)[-1]
    value = re.search(r"\bI:\s*(-?\d+(?:\.\d+)?)\s+LUFS", summary)
    if value is None:
        raise RuntimeError("Cannot read integrated loudness:\n" + summary[-1200:])
    return float(value.group(1))


def _master(channels, target):
    desired_peak = 10 ** ((_lufs(channels) - target - 3.0) / 20)
    left, right = channels
    n = len(left)
    block = SR // 100
    peaks, rms = [], []
    for i in range(0, n, block):
        a, b = left[i:i+block], right[i:i+block]
        peaks.append(max(max(a), -min(a), max(b), -min(b)))
        power = (sum(map(mul, a, a)) + sum(map(mul, b, b))) / (2*len(a))
        rms.append(math.sqrt(power))
    peak = max(peaks)
    if peak == 0:
        raise ValueError("Silent music loop")

    floor = desired_peak * 10**((-32.5 + 3.0)/20)
    lifts = [max(1.0, floor/max(v, 1e-9)) for v in rms]
    if desired_peak <= peak:
        trims = [min(1.0, desired_peak/max(p, 1e-12)) for p in peaks]
        join = min
    else:
        knee = .78 * peak
        trims = [1 + (desired_peak/peak-1) * max(0.0, (p-knee)/(peak-knee))**2
                 for p in peaks]
        join = max

    gains = [join(trims[i-1], trims[i]) * max(lifts[i-1], lifts[i])
             for i in range(len(peaks))]
    for j, start in enumerate(range(0, n, block)):
        a, b = gains[j], gains[(j+1) % len(gains)]
        if a == b == 1.0:
            continue
        end = min(start+block, n)
        step = (b-a)/(end-start)
        for i in range(start, end):
            g = a + (i-start)*step
            left[i] *= g
            right[i] *= g
    return _rotate(channels)


def music_day(rng):
    # The teammate's full performance, with its last ringing chord under the intro.
    pcm = _source()
    channels = tuple(array("d", (v/32768.0 for v in pcm[k::2])) for k in (0, 1))
    level, rise = _analysis(channels)
    duration = len(channels[0])/SR
    start, end = _match(level, rise, [0], duration-3.0, duration-2.05)
    print(f"music_day: source 0..{duration:.3f} s, ring folds at {end/SR:.3f} s",
          flush=True)
    loop = _splice(channels, start, end, day=True)
    del channels
    return _master(loop, -15.7)[0]


def _smooth(x):
    x = min(1.0, max(0.0, x))
    return x*x*(3-2*x)


def _cyclic_filter(loop, chain, frames=None, spectral=False):
    n = len(loop[0]) if frames is None else frames
    overlap = round(.060*SR) if spectral else 0
    trim = f",atrim=start_sample={n}:end_sample={2*n+overlap}"
    packed = _filter(_interleave(loop)*3, "f32le", chain+trim)
    if len(packed) != 2*(n+overlap):
        raise RuntimeError(f"Short middle period from FFmpeg: {chain}")
    result = []
    for ch in _stereo(packed):
        out = ch[:n]
        for i in range(overlap):
            k = _smooth(i/(overlap-1))
            out[i] = (1-k)*ch[n+i] + k*out[i]
        result.append(out)
    return tuple(result)


def _envelope(loop):
    _, rise = _analysis(loop)
    n = len(rise)
    return [(rise[(i-2) % n] + 2*rise[(i-1) % n] + 3*rise[i]
             + 2*rise[(i+1) % n] + rise[(i+2) % n])/9 for i in range(n)]


def _night_section():
    origin = 27
    pcm = _source()[2*origin*SR:2*85*SR]
    source = tuple(array("d", (v/32768 for v in pcm[k::2])) for k in (0, 1))
    level, rise = _analysis(source)
    starts = []
    for sec in range(3, 8):
        a, b = round(sec*SR/HOP), round((sec+1)*SR/HOP)
        starts.append(max(range(a, b), key=rise.__getitem__))
    a, b = _match(level, rise, starts, 44*.875, 46*.875)
    base = _splice(source, a, b)
    del source, pcm
    tempo = NIGHT_TEMPO
    n = round((b-a)/tempo)
    base = _cyclic_filter(base, f"rubberband=tempo={tempo:.10f}:pitch=1:"
                          "channels=together", frames=n, spectral=True)
    print(f"music_night: source {origin+a/SR:.3f}..{origin+b/SR:.3f} s, "
          f"tempo={tempo:.6f}, loop={n/SR:.3f} s", flush=True)
    return base, origin+a/SR


def _rms(loop, start=0, end=None):
    if end is None:
        end = len(loop[0])
    total = count = 0
    for ch in loop:
        part = ch[start:end:8]
        total += sum(map(mul, part, part))
        count += len(part)
    return math.sqrt(total/max(1, count))


def _double(base, cents, delay_ms, gain_db):
    flat = 2**(cents/1200)
    double = _cyclic_filter(base, f"rubberband=pitch={flat:.10f}:channels=together,"
                            f"adelay={delay_ms}|{delay_ms}", spectral=True)
    gain = 10**(gain_db/20)*_rms(base)/max(_rms(double), 1e-12)
    for k, (direct, copy) in enumerate(zip(base, double)):
        main_pan, copy_pan = ((1.0, .70), (.70, 1.0))[k]
        for i in range(len(direct)):
            direct[i] = main_pan*direct[i] + gain*copy_pan*copy[i]


def _hiss(loop, rng, level):
    for ch in loop:
        noise = array("f", (rng.uniform(-1, 1) for _ in range(len(ch))))
        previous = noise[-1]
        for i, value in enumerate(noise):
            ch[i] += level*(value-previous)
            previous = value


def _tape(loop, env, rng):
    n = len(loop[0])
    duration = n/SR
    cycles = round(.39*duration)
    knots = [rng.uniform(-1, 1) for _ in range(15)]
    mean = sum(knots)/len(knots)
    scale = max(abs(v-mean) for v in knots)
    knots = [(v-mean)*17.0/scale for v in knots]
    attacks = []
    for k in range(5):
        lo = round((k+.16)*len(env)/5)
        hi = round((k+.84)*len(env)/5)
        attacks.append((max(range(lo, hi), key=env.__getitem__)+.5)*HOP)
    depths = (136, 181, 149, 194, 163)
    widths = (.210, .258, .191, .273, .232)
    steps = math.ceil(n/128)
    edges = [round(i*n/steps) for i in range(steps+1)]

    def trajectory(starts):
        rates = []
        for a, b in zip(edges, edges[1:]):
            x = (a+b)/(2*n)
            q = x*len(knots)
            j = int(q)
            k = _smooth(q-j)
            wow = 38.0*math.sin(s.TAU*cycles*x)
            cents = wow + (1-k)*knots[j] + k*knots[(j+1) % len(knots)]
            t = x*duration
            for onset, width, depth in zip(starts, widths, depths):
                u = (t-onset)/width
                if 0 <= u < 1:
                    cents -= depth*math.sin(math.pi*u)**2
            rates.append(2**(cents/1200))
        travel = [0.0, *accumulate((b-a)*v for a, b, v
                                   in zip(edges, edges[1:], rates))]
        correction = n/travel[-1]
        positions = [p*correction for p in travel]
        positions[-1] = float(n)
        return positions

    starts = [p/SR for p in attacks]
    for _ in range(4):
        pos = trajectory(starts)
        adjusted = []
        for attack in attacks:
            j = bisect_right(pos, attack)-1
            k = (attack-pos[j])/(pos[j+1]-pos[j])
            adjusted.append((edges[j]+k*(edges[j+1]-edges[j]))/SR)
        starts = adjusted
    pos = trajectory(starts)
    result = []
    for ch in loop:
        triple = ch*3
        out = s.zeros(n)
        for j, (a, b) in enumerate(zip(edges, edges[1:])):
            p = n+pos[j]
            rate = (pos[j+1]-pos[j])/(b-a)
            for i in range(a, b):
                index = int(p)
                frac = p-index
                out[i] = triple[index] + frac*(triple[index+1]-triple[index])
                p += rate
        result.append(out)
    return tuple(result), starts, depths, widths, cycles/duration


def _render_night(rng):
    base, source_start = _night_section()
    env = _envelope(base)
    n = len(base[0])
    _double(base, -42, 21, -6)
    tape, starts, depths, widths, rate = _tape(base, env, rng)
    del base
    _hiss(tape, rng, .00072)
    dark = _cyclic_filter(
        tape, "highpass=f=33,equalizer=f=145:t=q:w=0.85:g=2.6,lowpass=f=3070,"
        "aecho=1:0.83:61|113|197:0.20|0.15|0.10,"
        "aecho=1:0.86:233|487|911|1379:0.15|0.10|0.065|0.035",
    )
    out, cut = _master(dark, -18.5)
    print(f"music_night: wow 38 cents at {rate:.4f} Hz, "
          "drift +/-17 cents, double -42 cents / 21 ms / -6 dB", flush=True)
    for t, depth, width in zip(starts, depths, widths):
        onset = (t-cut/SR) % (n/SR)
        print(f"  slip at {onset:.3f} s, dip -{depth} cents, "
              f"width {width:.3f} s", flush=True)
    return out, source_start, cut


def music_night(rng):
    # The original tune pulls against its late, flat double on the same worn tape.
    return _render_night(rng)[0]


def _percussion(rng):
    bank = {}

    def body(name, high, low, glide, decay, skin):
        drum = s.thud(high, low, glide, decay, 6*decay, drive=1.36)
        slap = s.biquad(s.burst(rng, .105, .014), "bp", skin, .80, warm=0)
        s.put(drum, .003, slap, .95)
        bank[name] = drum

    body("taiko", 124, 51, .048, .205, 1060)
    body("side", 172, 77, .033, .14, 1480)
    body("tom", 149, 69, .052, .17, 830)
    for name, midi in (("timA", 33), ("timE", 40)):
        f = s.mtof(midi)
        drum = s.pluck(f, [(1, .88, .34), (1.50, .37, .22),
                            (2.01, .27, .19), (2.46, .10, .10)],
                       maxdur=1.7)
        s.put(drum, 0, s.thud(1.45*f, f, .022, .14, .76), .55)
        bank[name] = drum

    bank["anvil"] = s.pluck(397, [(1, .30, .17), (1.51, .58, .16),
                                  (2.72, .72, .105), (4.18, .40, .08),
                                  (6.83, .17, .045)], maxdur=.87)
    bank["bell"] = s.pluck(s.mtof(57), [(.5, .28, .74), (1, .70, .83),
                                       (2.39, .44, .62), (3.01, .32, .42),
                                       (4.18, .18, .30)], maxdur=2.7)
    metal = s.biquad(s.burst(rng, 1.20, .205, .007), "bp", 2100, .68, warm=0)
    s.put(metal, 0, s.pluck(317, [(2.43, .15, .12), (3.69, .17, .17),
                                  (5.18, .12, .23)], maxdur=.85))
    bank["crash"] = metal
    breath = s.burst(rng, .25, .065, .005)
    ha = s.biquad(breath, "bp", 790, 1.5, warm=0)
    s.put(ha, .012, s.biquad(breath, "bp", 1260, 2.2, warm=0), .72)
    bank["breath"] = ha
    return bank


# The last night (Axel, 20/11): the validated night with drums only, no orchestra. Big drums, toms and a deep bass
# hammer from the first second on the night's own beat; the march gets heavier after 4 bars, a fill of toms closes
# every 4 bars, and the last 4 bars double the hits. The hits are placed around the loop (a tail past the end comes
# back at its start), so the loop stays seamless.
DRUM_LEVEL = 1.6  # the drums' RMS against the night's (B2 of the listening round, louder than B1 at 1.1)


def _place(bus, t, src, gain, pan, n):
    """Adds a mono hit to the stereo bus at t seconds, wrapping past the end of the loop."""
    left, right = bus
    i0 = int(round(t*SR)) % n
    gl, gr = gain*math.sqrt(1-pan), gain*math.sqrt(pan)
    for k, v in enumerate(src):
        j = (i0+k) % n
        left[j] += gl*v
        right[j] += gr*v


def _drums(n, down, beat, rng):
    bank = _percussion(rng)
    sub = s.thud(72, 41, .05, .36, 1.3, drive=1.2)
    bus = (s.zeros(n), s.zeros(n))
    length = n/SR
    bar = 4*beat
    bars = int((length-down)//bar)
    # The bar cut by the start of the loop is played too: its first hits wrap to the end.
    t = down-bar if down > .05 else down
    k = 0
    while t < length-1e-6:
        place = lambda off, name, gain, pan: _place(bus, t+off*beat, bank[name], gain, pan, n)  # noqa: E731
        # Each bar: the big drum, the deep bass and a low timpani on 1, the big drum on 3, the side drum on 2 and 4.
        place(0, "taiko", 1.0, .5)
        _place(bus, t, sub, .55, .5, n)
        place(0, "timA" if k % 4 != 2 else "timE", .45, .45)
        place(2, "taiko", .85, .5)
        place(1, "side", .42, .62)
        place(3, "side", .42, .62)
        if k >= 4:
            place(2.5, "taiko", .55, .42)
            place(3, "tom", .40, .35)
        if k >= bars-4:
            place(.5, "taiko", .6, .55)
            for h in range(8):
                place(h/2, "tom", .22, .3+.05*(h % 2))
        if k % 4 == 3:
            for off, name, gain, pan in ((3.0, "tom", .55, .30), (3.25, "tom", .6, .45),
                                         (3.5, "side", .6, .62), (3.75, "taiko", .75, .5)):
                place(off, name, gain, pan)
        k += 1
        t += bar
    hall = _cyclic_filter(
        bus, "volume=0.25,highpass=f=30,"
        "aecho=1:0.80:37|53|71:0.25|0.19|0.14,"
        "aecho=1:0.84:113|167|251:0.20|0.14|0.09,"
        "lowpass=f=3800",
    )
    return hall, bars


def music_final_night(rng):
    # The validated night, rendered again with its own seed, under the drums. A soft limiter (tanh) a little above the
    # night's peak keeps the drum hits from crushing the tune; render_sounds then scales the peak.
    bed, source_start, cut = _render_night(random.Random(seed_of("music_night")))
    n = len(bed[0])
    bpm = SOURCE_BPM*NIGHT_TEMPO
    beat = 60/bpm
    down = ((SOURCE_DOWNBEAT-source_start)/NIGHT_TEMPO-cut/SR) % (4*beat)
    hall, bars = _drums(n, down, beat, rng)
    gain = DRUM_LEVEL*_rms(bed)/max(_rms(hall), 1e-12)
    ceiling = 1.15*max(s.peak(ch) for ch in bed)
    print(f"music_final_night: grid {bpm:.3f} BPM, first downbeat {down:.3f} s, {bars} whole bars, "
          f"drums x{DRUM_LEVEL}", flush=True)
    return tuple(array("d", (ceiling*math.tanh((a+gain*b)/ceiling) for a, b in zip(dry, wet)))
                 for dry, wet in zip(bed, hall))


SOUNDS = {
    "music_day": music_day,
    "music_night": music_night,
    "music_final_night": music_final_night,
}
LOOPS = set(SOUNDS)
