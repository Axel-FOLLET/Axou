"""Mono farm, shop and interface sounds for the 2D game."""

import synth


# Each mode is (frequency ratio, amplitude, decay time in seconds).
WOOD = ((1.0, 1.0, 0.034), (2.38, 0.34, 0.014), (3.86, 0.13, 0.008))
COIN = ((1.0, 1.0, 0.039), (2.67, 0.23, 0.019), (4.12, 0.08, 0.011))
FELT_BELL = ((1.0, 1.0, 0.090), (2.0, 0.30, 0.060),
             (3.0, 0.09, 0.038), (4.1, 0.08, 0.024))


def _buffer(seconds):
    return synth.zeros(round(seconds * synth.SR))


def _rub(rng, duration, decay, cutoff):
    grain = synth.burst(rng, duration, decay, attack=0.002)
    return synth.biquad(grain, 'lp', cutoff, warm=0)


def _finish(sound, cutoff):
    sound = synth.biquad(sound, 'lp', cutoff, warm=0)
    return synth.finish(sound, drive=0.35, fade=0.020)


def plant(rng):
    # A palm pats loose earth, then a seed lands with a small dry tap.
    sound = _buffer(0.245)
    synth.put(sound, 0, _rub(rng, 0.125, 0.024, 1400), 0.95)
    synth.put(sound, 0, synth.thud(145, 86, 0.014, 0.021, 0.135, drive=0.4), 0.32)
    seed_gain = 0.19
    seed = synth.pluck(710, WOOD, attack=0.002, maxdur=0.065)
    synth.put(sound, 0.153, seed, seed_gain)
    synth.put(sound, 0.156, _rub(rng, 0.058, 0.009, 1950), 0.12)
    return _finish(sound, 3400)


def harvest(rng):
    # A leafy tug ends in a root pop, followed by two lightly ringing coins.
    sound = _buffer(0.465)
    synth.put(sound, 0, _rub(rng, 0.080, 0.015, 1450), 0.65)
    leaves = synth.whoosh(rng, 0.150, 550, 2250, 780, 0.85, 0.62, flutter=0.22)
    synth.put(sound, 0, leaves, 0.80)
    synth.put(sound, 0.101, synth.drop(rng, 174, 266, 0.039), 0.38)
    coin_gain = 0.34
    for start, hz, touch in ((0.189, 910, 0.82), (0.287, 1140, 1.0)):
        coin = synth.pluck(hz, COIN, attack=0.0035, maxdur=0.156)
        synth.put(sound, start, coin, coin_gain * touch)
    sound = synth.biquad(sound, 'lp', 3900, warm=0)
    return _finish(sound, 4900)


def defense_place(rng):
    # A wooden base meets the ground with a thud, then one corner ticks into place.
    sound = _buffer(0.330)
    synth.put(sound, 0, synth.thud(150, 82, 0.022, 0.037, 0.260, drive=0.45), 0.57)
    synth.put(sound, 0, synth.pluck(217, WOOD, attack=0.003, maxdur=0.215), 0.48)
    synth.put(sound, 0, _rub(rng, 0.080, 0.013, 1250), 0.30)
    tick_hz = 542
    tick = synth.pluck(tick_hz, WOOD, attack=0.002, maxdur=0.135)
    synth.put(sound, 0.161, tick, 0.22)
    return _finish(sound, 3500)


def defense_upgrade(rng):
    # Three felt-bell strikes rise through D, F-sharp and A, with the last note ringing on.
    sound = _buffer(0.680)
    transpose = 0
    for start, midi, touch in ((0, 74, 0.82), (0.128, 78, 0.90), (0.278, 81, 1.0)):
        note = synth.pluck(synth.mtof(midi + transpose), FELT_BELL,
                           attack=0.005, maxdur=0.380)
        synth.put(sound, start, note, touch)
    return _finish(sound, 5200)


def ui_click(rng):
    # A fingertip makes a single muted wooden click with a trace of surface noise.
    sound = _buffer(0.060)
    click_hz = 480
    click = synth.pluck(click_hz, WOOD, attack=0.0025, maxdur=0.044)
    synth.put(sound, 0, click)
    synth.put(sound, 0, _rub(rng, 0.025, 0.004, 1400), 0.24)
    return _finish(sound, 3000)


def ui_shop_open(rng):
    # Paper catches under a thumb, slides with a dry swish, and brushes to a stop.
    sound = _buffer(0.294)
    synth.put(sound, 0, _rub(rng, 0.065, 0.012, 1650), 0.67)
    slide = synth.whoosh(rng, 0.255, 680, 2180, 870, 0.85, 0.42,
                         flutter=0.30, flutter_hz=24)
    synth.put(sound, 0, slide)
    synth.put(sound, 0.218, _rub(rng, 0.057, 0.009, 1250), 0.33)
    for _ in range(2):
        sound = synth.biquad(sound, 'lp', 2850, q=1.05, warm=0)
    return _finish(sound, 3700)


def ui_refused(rng):
    # Two low, rounded pipe notes step down, with a breath of space between them.
    sound = _buffer(0.252)
    pipe = synth.wavetable(((1, 1.0), (2, 0.12), (3, 0.035)))
    first_hz = 196
    for start, ratio, hold, release, touch in ((0, 1.0, 0.047, 0.039, 1.0),
                                               (0.117, 0.84, 0.056, 0.061, 0.86)):
        note = synth.osc(pipe, first_hz * ratio, dur=hold, attack=0.006, release=release)
        synth.put(sound, start, note, touch)
    return _finish(sound, 1900)


SOUNDS = {
    'plant': plant,
    'harvest': harvest,
    'defense_place': defense_place,
    'defense_upgrade': defense_upgrade,
    'ui_click': ui_click,
    'ui_shop_open': ui_shop_open,
    'ui_refused': ui_refused,
}
