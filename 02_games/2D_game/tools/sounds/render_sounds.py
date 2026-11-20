"""Renders every sound of the 2D game to mp3, then measures each file.

Usage (WSL, from the 2D_game folder; Python standard library and ffmpeg only, see docs/sounds.md):
  python3 -B tools/sounds/render_sounds.py [--out assets/sounds] [--work DIR] [--only name1,name2]
      [--groups music,defenses]

Each group module (music, stings_neighbour, defenses, enemies, farm_ui) has a SOUNDS dictionary: name -> function(rng)
that returns a mono array('d') at synth.SR, or a (left, right) pair for stereo. A module may also have LOOPS, the
names that loop seamlessly. Fixed seeds: two runs give the same samples.

Each sound is scaled to its peak target (PEAK_SFX or PEAK_MUSIC), written as a wav in --work, encoded with ffmpeg
(libmp3lame) into --out/<name>.mp3, then measured: duration, peak, RMS, silence before the attack, level of the last
10 ms, seam of the loops; ffmpeg's ebur128 filter on the mp3 gives the true peak and, from 0.4 s, the loudness.
The measures are written to tools/sounds/manifest_sounds.json and printed: out of the assets, so the game does
not ship it.
"""
import argparse
import array
import importlib
import json
import math
import os
import random
import re
import subprocess
import sys
import tempfile
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import synth  # noqa: E402

GROUPS = ['music', 'stings_neighbour', 'defenses', 'enemies', 'farm_ui']
PEAK_SFX = -1.5      # dBFS before encoding, short sounds
PEAK_MUSIC = -3.0    # dBFS before encoding, music (more headroom for the encoder)
BITRATE_MONO = '96k'
BITRATE_STEREO = '112k'
SEED_BASE = 4100


def db(v):
    return 20.0 * math.log10(v) if v > 0 else -120.0


def seed_of(name):
    return SEED_BASE + zlib.crc32(name.encode('utf-8')) % 100000


def channels(x):
    return list(x) if isinstance(x, tuple) else [x]


def scale_to(chs, target_db):
    p = max(synth.peak(c) for c in chs)
    if p <= 0:
        sys.exit('silent sound')
    g = 10.0 ** (target_db / 20.0) / p
    return [synth.scaled(c, g) for c in chs], db(p)


def lead_ms(chs):
    """Milliseconds before the signal first reaches 10 % of its peak (-20 dB under the peak)."""
    p = max(synth.peak(c) for c in chs)
    n = len(chs[0])
    for i in range(n):
        if any(abs(c[i]) >= 0.1 * p for c in chs):
            return 1000.0 * i / synth.SR
    return 1000.0 * n / synth.SR


def tail_db(chs, ms=10.0):
    k = max(1, int(ms * synth.SR / 1000.0))
    return max(db(synth.rms(c[-k:])) for c in chs)


def seam(chs):
    """For a loop: jump between the last and the first sample, against the 99th percentile of the jumps inside."""
    worst = 0.0
    typical = 0.0
    for c in chs:
        worst = max(worst, abs(c[0] - c[-1]))
        steps = sorted(abs(c[i + 1] - c[i]) for i in range(0, len(c) - 1, 7))
        typical = max(typical, steps[int(0.99 * (len(steps) - 1))])
    return worst, typical


def encode(wav_path, mp3_path, stereo):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', wav_path,
                    '-c:a', 'libmp3lame', '-b:a', BITRATE_STEREO if stereo else BITRATE_MONO,
                    '-ac', '2' if stereo else '1', '-ar', str(synth.SR),
                    '-map_metadata', '-1', '-id3v2_version', '0', mp3_path], check=True)


def ebur128(mp3_path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', mp3_path, '-af', 'ebur128=peak=true',
                        '-f', 'null', '-'], capture_output=True, text=True)
    text = r.stderr[r.stderr.rfind('Summary:'):]
    lufs = re.search(r'I:\s+(-?[\d.]+|-inf) LUFS', text)
    tp = re.search(r'Peak:\s+(-?[\d.]+|-inf) dBFS', text)
    return (float(lufs.group(1)) if lufs and lufs.group(1) != '-inf' else None,
            float(tp.group(1)) if tp and tp.group(1) != '-inf' else None)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--out', default=os.path.join(HERE, '..', '..', 'assets', 'sounds'))
    ap.add_argument('--work', default=None)
    ap.add_argument('--only', default='')
    ap.add_argument('--groups', default=','.join(GROUPS))
    args = ap.parse_args()

    sounds = {}
    loops = set()
    for g in args.groups.split(','):
        mod = importlib.import_module(g)
        for name, fn in mod.SOUNDS.items():
            if name in sounds:
                sys.exit(f'sound {name} defined twice')
            sounds[name] = fn
        loops |= set(getattr(mod, 'LOOPS', ()))
    only = [n for n in args.only.split(',') if n]
    for n in only:
        if n not in sounds:
            sys.exit(f'unknown sound: {n}')
    work = args.work or tempfile.mkdtemp(prefix='2dgame_sounds_')
    os.makedirs(work, exist_ok=True)
    os.makedirs(args.out, exist_ok=True)
    manifest_path = os.path.join(HERE, 'manifest_sounds.json')
    manifest = {}
    if os.path.exists(manifest_path):
        with open(manifest_path, encoding='utf-8') as f:
            manifest = json.load(f)

    for name, fn in sounds.items():
        if only and name not in only:
            continue
        chs = channels(fn(random.Random(seed_of(name))))
        stereo = len(chs) == 2
        is_music = name in loops
        chs, raw_peak = scale_to(chs, PEAK_MUSIC if is_music else PEAK_SFX)
        wav_path = os.path.join(work, name + '.wav')
        mp3_path = os.path.join(args.out, name + '.mp3')
        if stereo:
            synth.write_wav_st(wav_path, chs[0], chs[1])
        else:
            synth.write_wav(wav_path, chs[0])
        encode(wav_path, mp3_path, stereo)
        lufs, true_peak = ebur128(mp3_path)
        m = {
            'seconds': round(len(chs[0]) / synth.SR, 3),
            'channels': len(chs),
            'loop': is_music,
            'raw_peak_db': round(raw_peak, 1),
            'rms_db': round(max(db(synth.rms(c)) for c in chs), 1),
            'lead_ms': round(lead_ms(chs), 1),
            'tail_db': round(tail_db(chs), 1),
            'lufs': lufs,
            'true_peak_db': true_peak,
            'bytes': os.path.getsize(mp3_path),
        }
        if is_music:
            jump, typical = seam(chs)
            m['seam_jump'] = round(jump, 4)
            m['seam_typical_p99'] = round(typical, 4)
        manifest[name] = m
        print(name, json.dumps(m), flush=True)

    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=1, sort_keys=True)
    total = sum(v['bytes'] for v in manifest.values())
    print(f'{len(manifest)} files, {total} bytes in all; wavs in {work}')


if __name__ == '__main__':
    main()
